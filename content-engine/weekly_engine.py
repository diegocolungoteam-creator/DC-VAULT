#!/usr/bin/env python3
"""Motor semanal de contenido — versión genérica (rellena el bloque CONFIG de abajo).

Bucle semanal, pensado para correr solo cuando el creador abre el portátil:

    1) FETCH     -> corre fetch_insights.py para refrescar insights.json
    2) SYNC      -> vuelca métricas de insights.json en la hoja Calendario
                    (sin LLM: solo lectura/escritura mecánica)
    3) ANÁLISIS  -> rankea las piezas publicadas desde la línea de salida y
                    añade una línea al historial de content_brain.md
                    (sin LLM: solo aritmética sobre los datos ya sincronizados)
    4) GENERACIÓN-> con lo aprendido en el paso 3, pide a Claude Sonnet nuevas
                    ideas para el Banco de ideas y el guión de la semana que
                    viene para el Calendario. Si la key falla, este paso se salta
                    con un aviso claro y el resto del motor sigue funcionando igual.
    5) ESCRITURA -> añade (nunca sobreescribe) las filas nuevas a las dos hojas,
                    siempre marcadas "Propuesta IA" — nunca "Aprobado"/"Subida".

Se ejecuta vía launchd con RunAtLoad=true (ver com.BRAND.contentengine.plist)
pero se auto-limita a una vez por semana con un archivo .last_run: si el portátil
se abre todos los días, el motor solo hace trabajo real ~una vez cada 7 días.

Diseño defensivo, en la misma línea que fetch_insights.py: cualquier paso que
pueda fallar por causas externas (red, API caída, key caducada) se degrada con
un aviso, nunca revienta el resto de la corrida.
"""
import argparse
import json
import pathlib
import re
import os
import subprocess
import sys
import time
import unicodedata
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Rutas y configuración
# ---------------------------------------------------------------------------
DIR = pathlib.Path(__file__).parent.resolve()
FETCH_SCRIPT = DIR / "fetch_insights.py"
INSIGHTS_JSON = DIR / "insights.json"
BRAIN_MD = DIR / "content_brain.md"
LAST_RUN_FILE = DIR / ".last_run"

# ===========================================================================
# >>> CONFIG — rellena TODO esto antes de la primera corrida <<<
# ===========================================================================
HANDLE = "TU_HANDLE"                 # sin @, p. ej. "micuenta"
MARCA = "TU_MARCA"                   # nombre corto de la marca / del creador
ID_PREFIX = "BRAND"                  # prefijo de los IDs del Banco de ideas: BRAND-001, BRAND-002…
SINCE_BASELINE = "2026-01-01"        # línea de salida (YYYY-MM-DD): lo anterior no cuenta
CTA_KEYWORD = "PALABRA"              # la palabra que comentan para pedir el recurso / lead
IDIOMA_CONTENIDO = "INGLÉS"          # idioma de TODO el texto de cara al público

CAL_SHEET_ID = "PON_AQUI_EL_ID_DE_LA_HOJA_CALENDARIO"
CAL_TAB = "Calendario"
IDEA_SHEET_ID = "PON_AQUI_EL_ID_DE_LA_HOJA_BANCO_DE_IDEAS"
IDEA_TAB = "Ideas"

# Credenciales: SIEMPRE en ficheros locales, nunca pegadas en un chat.
SA_KEY = pathlib.Path.home() / ".config" / "gcloud" / "content-engine-sa.json"
ENV_FILE = pathlib.Path.home() / ".config" / "content-engine" / ".env"   # ANTHROPIC_API_KEY=...
VENV_PIP = DIR / ".venv" / "bin" / "pip"

# Lo que el redactor necesita saber del creador y de su cliente. Sale de la entrevista
# (Step 1 de la guía) y de avatar.md / content_brain.md. Cuanto más concreto, mejor.
PERFIL = {
    "quien_es": "coach online de X en Y",  # una línea: qué hace y para quién
    "avatar": (
        "el cliente ideal, en una o dos frases: edad, situación, qué quiere, en qué está "
        "atascado, entre qué dos miedos está atrapado"
    ),
    "frases_avatar": [
        "\"frase textual 1 del cliente, sacada de DMs o llamadas reales\"",
        "\"frase textual 2\"",
        "\"frase textual 3\"",
    ],
    "miedo_profundo": "el miedo que nunca admite en voz alta",
    "creencia_a_romper": "la creencia central que TODO el contenido ataca",
    "voz": "cómo habla el creador: tono, ritmo, si suelta tacos, qué no diría jamás",
    "muletillas": ["'expresión suya 1'", "'expresión suya 2'"],  # máx. 1 por guión
    "credibilidad": "una línea de credibilidad, usada como puente, nunca como tema",
    "nicho_dentro": "temas que SÍ trata la cuenta, separados por comas",
    "nicho_fuera": "temas PROHIBIDOS aunque den alcance, separados por comas",
    "patrones_probados": "Myth-Bust Dialogue, Contrast List, Tactical Tip Stack, Specific Blueprint",
}
# ===========================================================================

WEEKLY_THROTTLE_SECONDS = 7 * 24 * 3600

# Redacción con Claude Sonnet vía la SDK oficial de Anthropic. Notas de la API:
#   · NO acepta temperature / top_p / top_k — enviarlos devuelve 400.
#   · El thinking adaptativo viene activado por defecto; aquí se apaga a propósito:
#     esto es redacción, no razonamiento en varios pasos.
#   · El JSON se fuerza con output_config.format (json_schema), no con response_format.
CLAUDE_MODEL = "claude-sonnet-5"
CLAUDE_MAX_TOKENS = 16000
CLAUDE_EFFORT = "high"

# Estructura semanal fija del creador: NO se toca. Solo se afina guión/gancho/CTA con
# lo aprendido en el análisis. Por defecto: 4 piezas/semana + 2 secuencias de historias
# (día 1 reel, 2 historias DOLOR, 3 reel, 4 historias CASO, 5 caso de éxito, 6 descanso,
# 7 personal/recap). Si tu cadencia es otra, cambia paso5_escritura() y el prompt.
DIAS_SEMANA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Throttle semanal
# ---------------------------------------------------------------------------
def ya_corrio_esta_semana():
    if not LAST_RUN_FILE.exists():
        return False
    try:
        last = float(LAST_RUN_FILE.read_text().strip())
    except (ValueError, OSError):
        return False
    return (time.time() - last) < WEEKLY_THROTTLE_SECONDS


def marcar_corrida_ok():
    LAST_RUN_FILE.write_text(str(time.time()))


# ---------------------------------------------------------------------------
# Paso 1: refrescar insights.json
# ---------------------------------------------------------------------------
def paso1_fetch_insights():
    log("PASO 1/5 — refrescando métricas de Instagram (fetch_insights.py)…")
    try:
        r = subprocess.run(
            [sys.executable, str(FETCH_SCRIPT), "--limit", "60",
             "--keywords", CTA_KEYWORD, "--since", SINCE_BASELINE],
            cwd=str(DIR), capture_output=True, text=True, timeout=300,
        )
        for line in r.stdout.splitlines():
            log(f"  fetch> {line}")
        if r.returncode != 0:
            log(f"  fetch_insights.py devolvió código {r.returncode}: {r.stderr[:400]}")
    except Exception as e:
        log(f"  no se pudo correr fetch_insights.py ({e}); sigo con el insights.json que ya había")

    if not INSIGHTS_JSON.exists():
        log("  no hay insights.json todavía; nada que sincronizar esta vez")
        return {"handle": "", "generado": "", "publicaciones": []}
    try:
        return json.loads(INSIGHTS_JSON.read_text())
    except (json.JSONDecodeError, OSError) as e:
        log(f"  insights.json ilegible ({e}); trato como vacío")
        return {"handle": "", "generado": "", "publicaciones": []}


# ---------------------------------------------------------------------------
# Utilidades numéricas / de shortcode
# ---------------------------------------------------------------------------
def shortcode(url):
    """Saca el código de un permalink de IG (/reel/<code>/ o /p/<code>/)."""
    if not url:
        return None
    m = re.search(r"/(?:reel|p)/([^/?]+)/?", url)
    return m.group(1) if m else None


def a_num(v):
    """Convierte lo que venga (int, '', None, '3.5k'...) a número o None."""
    if v in (None, ""):
        return None
    if isinstance(v, (int, float)):
        return v
    try:
        return float(str(v).replace(",", "").rstrip("k")) * (1000 if str(v).endswith("k") else 1)
    except ValueError:
        return None


def fmt_k(n):
    """1900 -> '1.9k', 1000 -> '1k', 42 -> '42'. Vacío si n es None."""
    if n is None:
        return ""
    n = float(n)
    if n >= 1000:
        s = f"{n/1000:.1f}".rstrip("0").rstrip(".")
        return f"{s}k"
    return str(int(n))


# ---------------------------------------------------------------------------
# Cliente de Sheets (service account; NO puede crear/borrar archivos)
# ---------------------------------------------------------------------------
def sheets_client():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    scopes = ["https://www.googleapis.com/auth/spreadsheets",
              "https://www.googleapis.com/auth/drive"]
    creds = service_account.Credentials.from_service_account_file(str(SA_KEY), scopes=scopes)
    return build("sheets", "v4", credentials=creds)


def get_values(svc, sheet_id, a1_range):
    r = svc.spreadsheets().values().get(spreadsheetId=sheet_id, range=a1_range).execute()
    return r.get("values", [])


def update_range(svc, sheet_id, a1_range, rows):
    svc.spreadsheets().values().update(
        spreadsheetId=sheet_id, range=a1_range,
        valueInputOption="USER_ENTERED", body={"values": rows},
    ).execute()


def append_rows(svc, sheet_id, a1_range, rows):
    # RAW y no USER_ENTERED a propósito: con USER_ENTERED, Sheets en español
    # interpreta la etiqueta de día "mar-2" como la fecha 2 de marzo y la guarda
    # como número de serie (46083). Todo lo que se escribe aquí es texto.
    svc.spreadsheets().values().append(
        spreadsheetId=sheet_id, range=a1_range,
        valueInputOption="RAW", insertDataOption="INSERT_ROWS",
        body={"values": rows},
    ).execute()


# ---------------------------------------------------------------------------
# Auto-detección de reels: casar lo publicado con las filas del Calendario
# ---------------------------------------------------------------------------
# El creador no siempre pega la URL del post en el Calendario (en el build original, 1 de 38), así
# que el paso 2 no encontraba nada que sincronizar y el motor nunca aprendía. Aquí se
# intenta casar cada publicación con la fila que la planificó, comparando el texto del
# post con la idea y el guión de la fila. Lo que no case NO se descarta: se analiza
# igual como pieza improvisada — lo que de verdad importa es lo que se publicó.

PALABRAS_VACIAS = {
    # inglés
    "the", "and", "for", "you", "your", "that", "this", "with", "not", "but",
    "are", "was", "were", "have", "has", "had", "will", "would", "can", "could",
    "from", "they", "them", "then", "than", "what", "when", "why",
    "how", "all", "any", "get", "got", "out", "off", "how", "just", "like", "more",
    "most", "some", "into", "over", "only", "also", "its", "it's", "don't", "doesn't",
    # español (notas internas y algún post)
    "que", "los", "las", "del", "por", "con", "una", "uno", "para", "como", "más",
    "pero", "sus", "sin", "sobre", "este", "esta", "esto", "eso", "ese", "ya", "muy",
    "hay", "son", "está", "están", "tiene", "tienes", "hacer", "cuando", "porque",
}


def _tokens(txt):
    """Palabras significativas en minúscula, sin acentos ni signos, sin vacías."""
    if not txt:
        return set()
    txt = unicodedata.normalize("NFKD", str(txt).lower())
    txt = "".join(c for c in txt if not unicodedata.combining(c))
    palabras = re.findall(r"[a-z0-9]+", txt)
    return {p for p in palabras if len(p) > 2 and p not in PALABRAS_VACIAS}


def _parecido(post, fila):
    """Cuántas palabras significativas comparten el post y la fila, y qué proporción
    del post cubren. Devuelve (nº compartidas, proporción)."""
    t_post = _tokens(post.get("gancho", ""))
    if not t_post:
        return 0, 0.0
    idea = fila[1] if len(fila) > 1 else ""
    guion = fila[6] if len(fila) > 6 else ""
    t_fila = _tokens(f"{idea} {guion}")
    comunes = t_post & t_fila
    return len(comunes), len(comunes) / len(t_post)


# Umbrales deliberadamente conservadores: es mejor dejar una pieza sin casar (se
# analiza igual como improvisada) que atribuir métricas a la fila equivocada, porque
# eso envenenaría el aprendizaje sin que se note.
MIN_PALABRAS_COMUNES = 4
MIN_PROPORCION = 0.30


def autodetectar_posts(svc, insights, filas, escribir=True):
    """Rellena la columna Post de las filas que se puedan casar con una publicación.
    Devuelve {shortcode: nº de fila} con TODO lo casado (lo que ya estaba + lo nuevo)."""
    por_fila = {}
    usados = set()

    # 1) lo que el creador ya pegó a mano manda siempre
    for i, fila in enumerate(filas[1:], start=2):
        sc = shortcode(fila[8] if len(fila) > 8 else "")
        if sc:
            por_fila[sc] = i
            usados.add(sc)

    # 2) filas candidatas: pieza real, sin URL todavía y con idea escrita
    candidatas = []
    for i, fila in enumerate(filas[1:], start=2):
        if shortcode(fila[8] if len(fila) > 8 else ""):
            continue
        idea = (fila[1] if len(fila) > 1 else "").strip()
        tipo = (fila[13] if len(fila) > 13 else "").strip()
        if not idea or idea == "—" or tipo in ("Historias", "Descanso"):
            continue
        candidatas.append((i, fila))

    # 3) cada publicación busca su mejor fila; una fila solo se usa una vez
    nuevos = 0
    for post in insights.get("publicaciones", []):
        sc = shortcode(post.get("url", ""))
        if not sc or sc in usados or post.get("fecha", "") < SINCE_BASELINE:
            continue

        mejor, mejor_puntos = None, (0, 0.0)
        for i, fila in candidatas:
            if i in por_fila.values():
                continue
            puntos = _parecido(post, fila)
            if puntos > mejor_puntos:
                mejor, mejor_puntos = i, puntos

        n_comunes, proporcion = mejor_puntos
        if mejor and n_comunes >= MIN_PALABRAS_COMUNES and proporcion >= MIN_PROPORCION:
            por_fila[sc] = mejor
            usados.add(sc)
            nuevos += 1
            log(f"  auto-detectado: {post.get('fecha')} {sc} -> fila {mejor} "
                f"({n_comunes} palabras en común, {proporcion:.0%} del post)")
            if escribir:
                update_range(svc, CAL_SHEET_ID, f"{CAL_TAB}!I{mejor}", [[post["url"]]])
                notas = filas[mejor - 1][12] if len(filas[mejor - 1]) > 12 else ""
                marca = "auto-detectado — revisa que sea la pieza correcta"
                if marca not in notas:
                    nuevas = f"{notas} · {marca}" if notas else marca
                    update_range(svc, CAL_SHEET_ID, f"{CAL_TAB}!M{mejor}", [[nuevas]])

    if nuevos:
        log(f"  {nuevos} publicaciones casadas automáticamente con su fila del Calendario")
    return por_fila


# ---------------------------------------------------------------------------
# Paso 2: SYNC de métricas (Calendario <- insights.json). Sin LLM.
# ---------------------------------------------------------------------------
NOTAS_TAG_RE = re.compile(r"reach [\d.]+k? · save \d+ · share \d+")


def paso2_sync_metrics(svc, insights, escribir=True):
    """Devuelve TODO lo publicado desde la línea de salida, esté o no en el Calendario.

    Antes solo devolvía las piezas que tenían URL pegada a mano en la hoja, así que si
    el creador no seguía el calendario al pie de la letra el motor se quedaba ciego. Ahora la
    hoja sirve para enriquecer (ángulo, formato, idea planificada) pero no para filtrar:
    lo que se publicó cuenta, se hubiera planificado o no."""
    log("PASO 2/5 — sincronizando métricas en el Calendario…")

    filas = get_values(svc, CAL_SHEET_ID, f"{CAL_TAB}!A1:N2000")
    if not filas:
        log("  no pude leer el Calendario (¿hoja vacía o sin permiso?)")
        return [], filas

    por_fila = autodetectar_posts(svc, insights, filas, escribir=escribir)

    publicadas = []
    for post in insights.get("publicaciones", []):
        if post.get("fecha", "") < SINCE_BASELINE:
            continue
        sc = shortcode(post.get("url", ""))
        if not sc:
            continue

        repro = a_num(post.get("repro"))
        coment = a_num(post.get("comentarios"))
        alcance = a_num(post.get("alcance"))
        guard = a_num(post.get("guardados"))
        comp = a_num(post.get("compartidos"))

        partes = []
        if alcance is not None:
            partes.append(f"reach {fmt_k(alcance)}")
        if guard is not None:
            partes.append(f"save {int(guard)}")
        if comp is not None:
            partes.append(f"share {int(comp)}")

        i = por_fila.get(sc)
        if i:
            fila = filas[i - 1]
            if escribir:
                if repro is not None:
                    update_range(svc, CAL_SHEET_ID, f"{CAL_TAB}!J{i}", [[fmt_k(repro)]])
                if coment is not None:
                    update_range(svc, CAL_SHEET_ID, f"{CAL_TAB}!K{i}", [[int(coment)]])
                if partes:
                    tag = " · ".join(partes)
                    notas_actual = fila[12] if len(fila) > 12 else ""
                    notas_limpia = NOTAS_TAG_RE.sub("", notas_actual).strip(" ·")
                    notas_final = f"{notas_limpia} · {tag}" if notas_limpia else tag
                    update_range(svc, CAL_SHEET_ID, f"{CAL_TAB}!M{i}", [[notas_final]])
            log(f"  fila {i} ({fila[0] if fila else '?'}): {sc} -> "
                f"views={fmt_k(repro)} coment={coment} {' '.join(partes)}")
            publicadas.append({
                "fila": i, "planificada": True,
                "angulo": fila[3] if len(fila) > 3 else "",
                "formato": fila[4] if len(fila) > 4 else "",
                "idea": fila[1] if len(fila) > 1 else "",
                "post": post,
            })
        else:
            log(f"  improvisada: {post.get('fecha')} {sc} (no está en el Calendario) -> "
                f"{' '.join(partes)}")
            publicadas.append({
                "fila": None, "planificada": False,
                "angulo": "", "formato": post.get("tipo", ""),
                "idea": (post.get("gancho") or "").strip()[:70],
                "post": post,
            })

    if not publicadas:
        log("  todavía no hay nada publicado desde la línea de salida")
    else:
        n_plan = sum(1 for p in publicadas if p["planificada"])
        log(f"  {len(publicadas)} piezas publicadas analizables "
            f"({n_plan} planificadas, {len(publicadas) - n_plan} improvisadas)")
    return publicadas, filas


# ---------------------------------------------------------------------------
# Paso 3: ANÁLISIS (ranking + aprendizaje). Sin LLM.
# ---------------------------------------------------------------------------
def paso3_analisis(publicadas, escribir=True):
    """Rankea TODO lo publicado — planificado o no. Los guardados por 1k de alcance
    mandan (predicen autoridad), luego compartidos, luego leads por palabra clave."""
    log("PASO 3/5 — analizando qué rindió mejor…")
    hoy = datetime.now().strftime("%Y-%m-%d")

    if not publicadas:
        linea = f"- {hoy}: sin piezas publicadas aún desde {SINCE_BASELINE} — nada que rankear todavía."
        if escribir:
            _append_a_brain(linea)
        log(f"  {linea}")
        return None

    def metricas(item):
        p = item["post"]
        alcance = a_num(p.get("alcance")) or 0
        guard = a_num(p.get("guardados")) or 0
        comp = a_num(p.get("compartidos")) or 0
        leads = p.get("leads_kw") or 0
        return alcance, guard, comp, leads

    def score(item):
        alcance, guard, comp, leads = metricas(item)
        saves_per_1k = (guard / alcance * 1000) if alcance else 0
        return (saves_per_1k, comp, leads)

    ranking = sorted(publicadas, key=score, reverse=True)

    resumen_top = []
    for item in ranking[:3]:
        alcance, guard, comp, leads = metricas(item)
        resumen_top.append({
            "gancho": (item["post"].get("gancho") or "").strip()[:90],
            "fecha": item["post"].get("fecha", ""),
            "angulo": item["angulo"], "formato": item["formato"],
            "planificada": item["planificada"],
            "alcance": alcance, "guardados": int(guard), "compartidos": int(comp),
            "saves_por_1k": round((guard / alcance * 1000), 1) if alcance else 0,
        })

    top = resumen_top[0]
    cta_kw = [CTA_KEYWORD.lower(), "comment", "comenta", "dm", "link in bio", "link en bio"]
    cta = next((k for k in cta_kw if k in top["gancho"].lower()), None)
    n_plan = sum(1 for p in publicadas if p["planificada"])

    linea = (
        f"- {hoy}: {len(publicadas)} piezas analizadas ({n_plan} del calendario, "
        f"{len(publicadas) - n_plan} improvisadas) · "
        f"top ángulo/formato: {top['angulo'] or '?'}/{top['formato'] or '?'}"
        f"{'' if top['planificada'] else ' (improvisada)'} · "
        f"mejor gancho: \"{top['gancho']}\" · "
        f"mejor CTA: {cta or 'sin CTA claro detectado — pendiente de fijar uno fijo'} · "
        f"aprendizaje: {fmt_k(top['alcance'])} alcance con {top['guardados']} guardados "
        f"({top['saves_por_1k']} por 1k reach) fue lo mejor de esta tanda; repetir este "
        f"patrón de gancho/formato en próximas piezas."
    )
    if escribir:
        _append_a_brain(linea)
    log(f"  {linea}")
    return {
        "n": len(publicadas), "n_planificadas": n_plan,
        "angulo": top["angulo"], "formato": top["formato"],
        "gancho": top["gancho"], "cta": cta, "saves_per_1k": top["saves_por_1k"],
        "top3": resumen_top,
    }


def _append_a_brain(linea):
    actual = BRAIN_MD.read_text(encoding="utf-8") if BRAIN_MD.exists() else ""
    if not actual.endswith("\n"):
        actual += "\n"
    BRAIN_MD.write_text(actual + linea + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Paso 4: GENERACIÓN vía Claude (se salta con gracia si la key falla)
# ---------------------------------------------------------------------------
def cargar_anthropic_key():
    """Variable de entorno primero, luego el .env local. Nunca se imprime."""
    val = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if val:
        return val
    for archivo in (ENV_FILE,):
        if not archivo.exists():
            continue
        try:
            lineas = archivo.read_text().splitlines()
        except OSError:
            continue
        for line in lineas:
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY="):
                val = line.split("=", 1)[1].strip().strip("'\"")
                if val:
                    return val
    return None


# Esquema de la respuesta. Con output_config.format el modelo no puede devolver otra
# cosa, así que desaparece el "respondió pero no es JSON válido" que había con Groq.
# Ojo: la API no admite minLength/maxItems ni esquemas recursivos, y todos los objetos
# necesitan additionalProperties:false y su lista completa de required.
# dia_num va 1/3/5/7 porque los días 2 y 4 son historias y el 6 descanso: esos los pone
# el motor por su cuenta (estructura fija del creador, no la decide el modelo).
ESQUEMA_SALIDA = {
    "type": "object",
    "properties": {
        "ideas": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "idea": {"type": "string", "description": "Gancho o titular, en el idioma del contenido"},
                    "objecion": {"type": "string", "description": "Obj. N — 'miedo textual del cliente'"},
                    "funcion": {"type": "string", "enum": ["Educar", "Vender", "Conectar", "Aportar"]},
                    "formato": {"type": "string", "enum": ["Reel", "Carrusel", "Story"]},
                    "plataforma": {"type": "string"},
                },
                "required": ["idea", "objecion", "funcion", "formato", "plataforma"],
                "additionalProperties": False,
            },
        },
        "calendario": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "dia_num": {"type": "integer", "enum": [1, 3, 5, 7]},
                    "idea": {"type": "string", "description": "Título de la pieza, en el idioma del contenido"},
                    "objetivo": {"type": "string", "enum": ["Educar", "Vender", "Conectar", "Aportar"]},
                    "angulo": {"type": "string", "description": "Etiqueta corta de 1-3 palabras"},
                    "formato": {"type": "string", "enum": ["Reel", "Carrusel"]},
                    "guion": {"type": "string", "description": "Guion hablado con etiquetas [HOOK]/[BODY]/[CTA]"},
                    "necesita_evidencia": {"type": "boolean"},
                },
                "required": ["dia_num", "idea", "objetivo", "angulo", "formato",
                             "guion", "necesita_evidencia"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["ideas", "calendario"],
    "additionalProperties": False,
}


def construir_prompt(analisis, max_idea_num):
    """Prompt compacto: resumen del análisis + patrón ganador + esquema exacto
    del Banco de ideas. NO mandamos el histórico completo para cuidar tokens."""
    if analisis:
        # Se le pasan los ganchos REALES que mejor rindieron, con sus números y si
        # eran del calendario o improvisados. Es la única forma de que la generación
        # aprenda de lo que el creador publica de verdad y no de lo que estaba planificado.
        lineas_top = []
        for i, t in enumerate(analisis.get("top3", []), start=1):
            origen = "del calendario" if t["planificada"] else "improvisada, fuera del calendario"
            lineas_top.append(
                f"  {i}. \"{t['gancho']}\" ({t['fecha']}, {origen}) — "
                f"{fmt_k(t['alcance'])} alcance, {t['guardados']} guardados, "
                f"{t['compartidos']} compartidos, {t['saves_por_1k']} guardados por 1k."
            )
        detalle = "\n".join(lineas_top)
        resumen = (
            f"{analisis['n']} piezas publicadas analizadas "
            f"({analisis.get('n_planificadas', 0)} del calendario, "
            f"{analisis['n'] - analisis.get('n_planificadas', 0)} improvisadas).\n"
            f"Lo que MEJOR ha rendido hasta ahora, en orden:\n{detalle}\n"
            f"Mejor ángulo/formato: {analisis['angulo'] or '?'}/{analisis['formato'] or '?'}. "
            f"CTA que mejor funcionó: {analisis['cta'] or 'ninguno claro todavía, prueba uno directo tipo comenta una palabra clave'}.\n"
            f"Fíjate en QUÉ tienen en común los ganchos de arriba (tema, estructura, "
            f"promesa) y aplica ese patrón a las piezas nuevas — sin copiar sus frases."
        )
    else:
        resumen = (f"Todavía no hay piezas nuevas con métricas desde la línea de salida "
                   f"({SINCE_BASELINE}). Usa las hipótesis de partida de content_brain.md: "
                   f"los patrones probados son {PERFIL['patrones_probados']}.")

    P = PERFIL
    system = (
        f"Eres el redactor de contenido de {MARCA} (@{HANDLE}), {P['quien_es']}. "
        f"Le escribes a su cliente ideal: {P['avatar']} "
        f"Frases textuales del cliente (útiles como ganchos): {' · '.join(P['frases_avatar'])}. "
        f"Su miedo más profundo: {P['miedo_profundo']}. "
        f"Creencia a romper SIEMPRE: {P['creencia_a_romper']}. "
        f"VOZ DEL CREADOR: {P['voz']}. Muletillas suyas (con moderación, 1 por guión máx.): "
        f"{', '.join(P['muletillas'])}. JAMÁS vendehumos ni hype falso. "
        f"Credibilidad (máx. 1 línea por guión, como puente, nunca el tema): {P['credibilidad']}. "
        f"REGLAS DURAS: (1) TODO el texto de cara al público en {IDIOMA_CONTENIDO} (los campos "
        f"internos objecion/funcion/formato pueden ir en español). (2) Nicho: {P['nicho_dentro']}. "
        f"NADA de: {P['nicho_fuera']}. (3) Cero relleno motivacional ('start your journey', "
        f"'today!' PROHIBIDOS). (4) CTA por defecto: 'Comment {CTA_KEYWORD}'. "
        f"Genera SOLO JSON válido, sin texto fuera del JSON."
    )
    user = f"""ANÁLISIS DE RENDIMIENTO:
{resumen}

TAREA 1 — Banco de ideas: genera 8 ideas nuevas siguiendo EXACTO este esquema de columnas
(ID · Idea/gancho · Objeción o miedo que ataca · Función estratégica · Formato · Plataforma).
Los IDs deben continuar la secuencia {ID_PREFIX}-{max_idea_num+1:03d} en adelante.
Cada objeción debe tener el formato "Obj. N — 'miedo textual del cliente'".
Función estratégica es una de: Educar, Vender, Conectar, Aportar.
Formato es uno de: Reel, Carrusel, Story.

TAREA 2 — Calendario de la semana que viene: sigue la estructura fija del creador, NO la cambies:
día 1 = Reel aporte/técnica, día 2 = secuencia de historias DOLOR (sin guión, solo idea),
día 3 = Reel dolor/creencia, día 4 = secuencia de historias CASO/TESTIMONIO (sin guión),
día 5 = Caso de éxito (carrusel; si necesita una prueba real que no tenemos, escribe
"NEEDS EVIDENCE" en notas y NO inventes números ni testimonios), día 6 = descanso,
día 7 = Personal/recap. TODO en {IDIOMA_CONTENIDO}: las ideas del banco, los ganchos y los
guiones (otro idioma = respuesta inválida). Para cada pieza (no las de historias/descanso)
escribe gancho y guión con la voz del creador, siguiendo el REELS WRITING SYSTEM:
- Guión = palabra hablada a cámara, entre 80 y 150 palabras (menos de 80 = inválido;
  hasta 200 si es tip-stack). Cada línea = UNA frase hablada, separadas con \\n.
- Estructura con etiquetas: línea 1 "[PATRÓN · ToF/MoF/BoF]", luego "[HOOK]" y el gancho
  hablado, "[BODY]" y el desarrollo (el error concreto, por qué pasa, qué hacer en su
  lugar — SIEMPRE con números, kilos, semanas o ejercicios concretos), "[CTA]" y UNA
  sola llamada: por defecto "Comment {CTA_KEYWORD} and I'll send you ..." (BoF: link in bio).
- Patrones permitidos: {PERFIL['patrones_probados']} — y cada guión de la semana usa un
  patrón DIFERENTE (nada de repetir
  Myth-Bust en todos). NO uses Vulnerable Origin Story ni Live Sales Roleplay
  (no hay historias/objeciones reales cargadas — nunca se inventan).
- Cada guión trata un tema distinto con SU PROPIA receta técnica (ejercicio, porcentajes,
  progresión o error diferentes) y su propia promesa en la CTA. Repetir la misma receta
  o frase en dos guiones = respuesta inválida.
- Día 5 (caso de éxito) y día 7 (personal): NO inventes historias, números de clientes
  ni anécdotas. TODA cifra de resultado va entre corchetes, incluidos los kilos y las
  semanas: se escribe "[CLIENT NAME] added [X] kg in [N] weeks", NUNCA "added 15 kg in
  12 weeks". Un número de resultado sin corchetes en estas piezas = respuesta inválida.
  Escribe el guión con huecos [IN BRACKETS] para que el creador meta lo real y pon
  necesita_evidencia: true. El día 7 es recap/personal: resume las lecciones de la
  semana en la voz del creador, con huecos [IN BRACKETS] para sus detalles personales.
- No garantices resultados con cifra ("you'll add 12 kg in 12 weeks" PROHIBIDO):
  formula objetivos como rango realista o como aquello a lo que apunta el método.
- No cites estadísticas ni estudios inventados ("the data shows X%", "research says"
  PROHIBIDO): argumenta con mecanismos y experiencia de coaching, no con datos falsos.
  Los números válidos son los del método (pasos, porcentajes, series, tiempos, semanas).
- En "calendario", el campo "idea" es el TÍTULO en inglés de la pieza (texto, nunca
  un ID tipo {ID_PREFIX}-###).

EJEMPLO de guión válido — SOLO para copiar el FORMATO y el nivel de detalle. PROHIBIDO
reutilizar sus frases, su receta (80%/2.5 kg) o su tema en tu respuesta:
[Myth-Bust Dialogue · ToF]\\n[HOOK]\\nStop maxing out every Friday. It's why your bench
is stuck.\\n[BODY]\\nLet's be real.\\nTesting your 1RM every week feels like training.\\nIt
isn't. It's just checking.\\nYou don't get stronger by checking.\\nHere's what actually
moves your bench: three to five reps at around 80 percent, adding 2.5 kg only when every
rep is clean.\\nBoring? Maybe.\\nBut boring is what takes a 100 kg bench to 120.\\nTesting
just tells you you're still at 100.\\n[CTA]\\nComment {CTA_KEYWORD} and I'll send you the exact
progression.\\nON-SCREEN: Testing is not training.

Aplica lo que mejor rindió arriba. Guía completa: reels-writing-system.md.

Responde con este JSON exacto:
{{
  "ideas": [
    {{"idea": "...", "objecion": "...", "funcion": "...", "formato": "...", "plataforma": "..."}}
  ],
  "calendario": [
    {{"dia_num": 1, "idea": "...", "objetivo": "...", "angulo": "...", "formato": "...",
      "guion": "...", "necesita_evidencia": false}}
  ]
}}"""
    return system, user


def llamar_claude(key, system, user):
    """Una llamada a Claude. El esquema garantiza el JSON, así que devuelve ya el dict.

    El import va aquí dentro y no arriba, igual que el cliente de Sheets: si algún día
    falta el paquete, el motor sigue haciendo los pasos 1-3 en vez de no arrancar."""
    import anthropic

    cliente = anthropic.Anthropic(api_key=key)
    resp = cliente.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=CLAUDE_MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
        thinking={"type": "disabled"},
        output_config={
            "effort": CLAUDE_EFFORT,
            "format": {"type": "json_schema", "schema": ESQUEMA_SALIDA},
        },
    )

    # Si los clasificadores rechazan la petición, content viene vacío: hay que mirar
    # stop_reason antes de leerlo o esto revienta con un error poco claro.
    if resp.stop_reason == "refusal":
        raise RuntimeError("Claude rechazó la petición por sus filtros de seguridad")
    if resp.stop_reason == "max_tokens":
        log(f"  aviso: se alcanzó el tope de {CLAUDE_MAX_TOKENS} tokens; "
            f"la tanda puede venir incompleta")

    texto = next((b.text for b in resp.content if b.type == "text"), "")
    if not texto:
        raise RuntimeError("Claude respondió sin bloque de texto")
    u = resp.usage
    log(f"  {CLAUDE_MODEL} (effort {CLAUDE_EFFORT}, sin thinking): "
        f"{u.input_tokens} tokens de entrada, {u.output_tokens} de salida")
    return json.loads(texto)


def _motivo_claude(e):
    """Traduce la excepción de la SDK a algo accionable en el log, de lo más concreto
    a lo más general. Si la SDK no está, devuelve el error tal cual."""
    try:
        import anthropic
    except ImportError:
        return str(e)[:200]
    if isinstance(e, anthropic.AuthenticationError):
        return "ANTHROPIC_API_KEY inválida o caducada — renuévala"
    if isinstance(e, anthropic.RateLimitError):
        return "límite de peticiones alcanzado; se reintenta en la corrida que viene"
    if isinstance(e, anthropic.APIStatusError):
        return f"la API devolvió {e.status_code}: {str(e)[:160]}"
    if isinstance(e, anthropic.APIConnectionError):
        return "no hubo red para llegar a la API"
    return str(e)[:200]


def paso4_generacion(analisis):
    log("PASO 4/5 — generación de contenido nuevo (Claude)…")
    key = cargar_anthropic_key()
    if not key:
        log(f"  generación pendiente de key — pon ANTHROPIC_API_KEY en {ENV_FILE}")
        return None

    svc = sheets_client()
    ideas_actuales = get_values(svc, IDEA_SHEET_ID, f"{IDEA_TAB}!A2:A2000")
    nums = [int(m.group(1)) for row in ideas_actuales for m in [re.search(ID_PREFIX + r"-(\d+)", row[0] if row else "")] if m]
    max_num = max(nums) if nums else 0

    system, user = construir_prompt(analisis, max_num)
    try:
        return llamar_claude(key, system, user)
    except ImportError:
        log(f"  falta el paquete 'anthropic' en el venv — instálalo con: '{VENV_PIP}' install anthropic")
    except json.JSONDecodeError as e:
        log(f"  la respuesta no era JSON válido ({e}); descarto esta tanda")
    except Exception as e:
        log(f"  fallo generando con Claude: {_motivo_claude(e)}")
    return None


# ---------------------------------------------------------------------------
# Paso 5: ESCRITURA (solo si el paso 4 produjo contenido)
# ---------------------------------------------------------------------------
def paso5_escritura(svc, generado, max_idea_num, ultima_fila_cal, ultimo_dia_num):
    log("PASO 5/5 — escribiendo ideas y calendario nuevos…")

    ideas = generado.get("ideas", [])
    if ideas:
        filas_ideas = []
        for i, idea in enumerate(ideas, start=max_idea_num + 1):
            filas_ideas.append([
                f"{ID_PREFIX}-{i:03d}", idea.get("idea", ""), idea.get("objecion", ""),
                idea.get("funcion", ""), idea.get("formato", ""), "Instagram",
            ])
        append_rows(svc, IDEA_SHEET_ID, f"{IDEA_TAB}!A:F", filas_ideas)
        log(f"  {len(filas_ideas)} ideas nuevas añadidas al Banco de ideas "
            f"({ID_PREFIX}-{max_idea_num+1:03d}..{ID_PREFIX}-{max_idea_num+len(filas_ideas):03d})")

    piezas = {p["dia_num"]: p for p in generado.get("calendario", [])}
    filas_cal = []
    dia_num = ultimo_dia_num
    for offset in range(1, 8):  # semana completa: 7 días, estructura fija del creador
        dia_num += 1
        etiqueta = f"{DIAS_SEMANA[(dia_num - 1) % 7]}-{dia_num}"
        if offset == 2:
            filas_cal.append([etiqueta, "Secuencia de historias · DOLOR", "Conectar",
                               "Problema", "Story", "", "", "Propuesta IA", "", "", "", "", "", "Historias"])
        elif offset == 4:
            filas_cal.append([etiqueta, "Secuencia de historias · CASO/TESTIMONIO", "Vender",
                               "Prueba Social", "Story", "", "", "Propuesta IA", "", "", "", "", "", "Historias"])
        elif offset == 6:
            filas_cal.append([etiqueta, "—", "", "", "", "", "", "Propuesta IA", "", "", "", "", "", "Descanso"])
        else:
            p = piezas.get(offset, {})
            notas = "NEEDS EVIDENCE — datos y consentimiento reales" if p.get("necesita_evidencia") else ""
            # Red de seguridad: si el guión afirma un resultado con cifra sin corchetes,
            # se marca para revisión en vez de colarse como si fuera un caso real.
            if not notas and re.search(r"\b(added|gained|lost|dropped|put on)\s+\d+\s*(kg|kgs|lb|lbs|%)",
                                       p.get("guion", ""), re.I):
                notas = "REVISAR — cifra de resultado sin corchetes; confirmar que es real"
            filas_cal.append([
                etiqueta, p.get("idea", ""), p.get("objetivo", ""), p.get("angulo", ""),
                p.get("formato", ""), "", p.get("guion", ""), "Propuesta IA",
                "", "", "", "", notas, "Pieza",
            ])
    append_rows(svc, CAL_SHEET_ID, f"{CAL_TAB}!A:N", filas_cal)
    log(f"  {len(filas_cal)} filas nuevas añadidas al Calendario, todas con Estado = 'Propuesta IA'")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true",
                     help="ignora el throttle semanal (para pruebas manuales)")
    ap.add_argument("--dry-run", action="store_true",
                     help="enseña qué haría (incluida la auto-detección de reels) sin "
                          "escribir nada en las hojas, sin generar y sin gastar el throttle")
    a = ap.parse_args()

    log("=== Motor semanal de contenido — arrancando ===")

    if not a.force and ya_corrio_esta_semana():
        log("ya corrió hace menos de 7 días — salgo sin hacer nada (throttle semanal)")
        return

    insights = paso1_fetch_insights()

    try:
        svc = sheets_client()
    except Exception as e:
        log(f"no pude conectar con Google Sheets ({e}); abortando esta corrida sin marcarla como OK")
        return

    publicadas, filas_cal = paso2_sync_metrics(svc, insights, escribir=not a.dry_run)
    analisis = paso3_analisis(publicadas, escribir=not a.dry_run)

    if a.dry_run:
        log("--dry-run: no escribo en las hojas, no genero y no toco el throttle")
        log("=== Motor semanal de contenido — terminado ===")
        return

    # Pasos 1-3 completados: esto ya cuenta como corrida "OK" de verdad, según el
    # encargo (la generación puede depender de una key caducada y eso no debe
    # bloquear el throttle ni considerarse un fallo del motor).
    marcar_corrida_ok()
    log("pasos 1-3 completados OK — throttle semanal actualizado")

    # último número de idea e id/fila de calendario, para la generación/escritura
    max_idea_num = 0
    try:
        idea_rows = get_values(svc, IDEA_SHEET_ID, f"{IDEA_TAB}!A2:A2000")
        nums = [int(m.group(1)) for row in idea_rows for m in [re.search(ID_PREFIX + r"-(\d+)", row[0] if row else "")] if m]
        max_idea_num = max(nums) if nums else 0
    except Exception:
        pass

    ultima_fila_cal = len(filas_cal) if filas_cal else 1
    ultimo_dia_num = (ultima_fila_cal - 1) if ultima_fila_cal > 1 else 0  # fila1=cabecera

    generado = paso4_generacion(analisis)
    if generado:
        try:
            paso5_escritura(svc, generado, max_idea_num, ultima_fila_cal, ultimo_dia_num)
        except Exception as e:
            log(f"la generación llegó pero falló la escritura en las hojas: {e}")
    else:
        log("paso 4/5 saltado — no hubo generación esta vez")

    log("=== Motor semanal de contenido — terminado ===")


if __name__ == "__main__":
    main()
