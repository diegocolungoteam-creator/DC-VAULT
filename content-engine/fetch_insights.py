#!/usr/bin/env python3
"""Trae métricas de Instagram y las vuelca en una hoja de Google.

Uso:
    python3 fetch_insights.py                 # trae y escribe en la hoja
    python3 fetch_insights.py --dry-run       # solo muestra, no escribe
    python3 fetch_insights.py --limit 50      # cuántas publicaciones

Credenciales en ~/.config/instagram/content-engine.json (las crea save_token.py). El token corto se
canjea automáticamente por uno de 60 días y se guarda de vuelta en el archivo,
así que solo hay que repetir el paso manual cada dos meses.

Diseño defensivo a propósito: Meta cambia y deprecia métricas con frecuencia y
sin avisar, y las disponibles varían según el tipo de publicación. El script pide
lo que espera, ignora lo que la API rechace, y deja constancia de qué faltó — es
preferible a que reviente entero por una métrica retirada.
"""
import argparse, json, pathlib, re, sys, time, unicodedata
from urllib.parse import urlencode
from urllib.request import urlopen
from urllib.error import HTTPError, URLError

CREDS = pathlib.Path.home() / ".config" / "instagram" / "content-engine.json"
GRAPH_FB = "https://graph.facebook.com/v21.0"   # API con login de Facebook (no da guardados en cuentas sin página)
GRAPH_IG = "https://graph.instagram.com/v21.0"  # API con login de Instagram (sí da guardados/alcance)
BASE = GRAPH_FB  # lo fija main() según qué credenciales haya

# Métricas por tipo. Meta retiró varias en 2024-2025 (impressions entre ellas);
# se piden las vigentes y el código sobrevive si alguna más desaparece.
METRICS = {
    "REELS":         ["reach", "likes", "comments", "saved", "shares", "total_interactions", "views"],
    "VIDEO":         ["reach", "likes", "comments", "saved", "shares", "total_interactions", "views"],
    "IMAGE":         ["reach", "likes", "comments", "saved", "shares", "total_interactions"],
    "CAROUSEL_ALBUM":["reach", "likes", "comments", "saved", "shares", "total_interactions"],
}


def api(path, token, base=None, **params):
    params["access_token"] = token
    url = f"{base or BASE}/{path.lstrip('/')}?{urlencode(params)}"
    # La red de Meta tiene picos de latencia; un timeout suelto no debería tirar
    # una corrida de 120+ llamadas. Reintentamos con espera creciente.
    last = None
    for intento in range(4):
        try:
            with urlopen(url, timeout=45) as r:
                return json.load(r)
        except HTTPError as e:
            body = e.read().decode("utf-8", "ignore")
            try:
                msg = json.loads(body)["error"]["message"]
            except Exception:
                msg = body[:200]
            # 4xx que no sean rate-limit no mejoran reintentando
            if e.code not in (429, 500, 502, 503):
                raise RuntimeError(f"API {e.code}: {msg}") from None
            last = RuntimeError(f"API {e.code}: {msg}")
        except (URLError, TimeoutError, OSError) as e:
            last = RuntimeError(f"red: {e}")
        time.sleep(2 * (intento + 1))
    raise last or RuntimeError("fallo de red repetido")


def load_creds():
    if not CREDS.exists():
        sys.exit(f"No encuentro {CREDS}\nEjecuta save_token.py primero (Step 4 de la guía).")
    return json.loads(CREDS.read_text())


def save_creds(c):
    CREDS.write_text(json.dumps(c, indent=2))
    CREDS.chmod(0o600)


def get_long_token(c):
    """Devuelve un token de 60 días, canjeando el corto la primera vez."""
    if c.get("long_lived_token") and c.get("expires_at", 0) > time.time() + 86400:
        return c["long_lived_token"]

    src = c.get("long_lived_token") or c.get("short_lived_token")
    if not src:
        sys.exit("Falta el token en el archivo de credenciales.")

    print("  canjeando token por uno de larga duración…")
    r = api("oauth/access_token", src, base=GRAPH_FB,
            grant_type="fb_exchange_token",
            client_id=c["app_id"], client_secret=c["app_secret"],
            fb_exchange_token=src)

    c["long_lived_token"] = r["access_token"]
    c["expires_at"] = time.time() + r.get("expires_in", 5184000)
    c.pop("short_lived_token", None)
    save_creds(c)
    dias = int((c["expires_at"] - time.time()) / 86400)
    print(f"  token válido {dias} días (guardado)")
    return c["long_lived_token"]


def get_ig_long_token(c):
    """Igual que get_long_token pero para la API de Instagram (graph.instagram.com).

    El canje es distinto: grant_type=ig_exchange_token y solo pide client_secret.
    Un token largo de IG dura 60 días y se puede refrescar sin re-loguear mientras
    tenga menos de 60 y más de 1 día de vida (ig_refresh_token)."""
    ahora = time.time()
    long_ok = c.get("ig_long_token") and c.get("ig_expires_at", 0) > ahora + 86400
    if long_ok:
        # refresco proactivo si le queda menos de una semana
        if c["ig_expires_at"] < ahora + 7 * 86400:
            try:
                r = api("refresh_access_token", c["ig_long_token"], base=GRAPH_IG,
                        grant_type="ig_refresh_token")
                c["ig_long_token"] = r["access_token"]
                c["ig_expires_at"] = ahora + r.get("expires_in", 5184000)
                save_creds(c)
                print("  token de Instagram refrescado (+60 días)")
            except RuntimeError:
                pass  # si falla el refresco, el token actual sigue sirviendo
        return c["ig_long_token"]

    short = c.get("ig_user_token")
    if not short:
        sys.exit("Falta 'ig_user_token' en las credenciales — ejecuta save_token.py.")

    # El token que genera el panel de Meta ("Generar identificador") ya es de larga
    # duración, así que NO se canjea con ig_exchange_token (da "Session key invalid").
    # Se normaliza con refresh_access_token, que además devuelve la caducidad real.
    print("  normalizando token de Instagram (refresh)…")
    try:
        r = api("refresh_access_token", short, base=GRAPH_IG, grant_type="ig_refresh_token")
        c["ig_long_token"] = r["access_token"]
        c["ig_expires_at"] = ahora + r.get("expires_in", 5184000)
        c.pop("ig_user_token", None)
        save_creds(c)
        dias = int((c["ig_expires_at"] - ahora) / 86400)
        print(f"  token de Instagram válido {dias} días (guardado)")
        return c["ig_long_token"]
    except RuntimeError as e:
        # Si el refresco falla, el token del panel sirve tal cual; lo usamos directo.
        print(f"  (refresh no disponible: {e}; uso el token tal cual)")
        c["ig_long_token"] = short
        c["ig_expires_at"] = ahora + 55 * 86400  # estimación conservadora
        c.pop("ig_user_token", None)
        save_creds(c)
        return short


def find_ig_account(token, creds, expected_handle=None):
    """Localiza la cuenta de Instagram profesional.

    Las cuentas profesionales del "nuevo tipo" de Meta ya no se vinculan a una
    página de Facebook, así que la ruta clásica (página → instagram_business_account)
    devuelve vacío. Si el archivo de credenciales trae un `ig_id`, se consulta la
    cuenta directamente por ese ID (lo que sí funciona). Si no, se prueba la ruta
    por página como respaldo para cuentas antiguas.
    """
    ig_id = creds.get("ig_id")
    if ig_id:
        info = api(ig_id, token, fields="id,username,followers_count")
        if "username" in info:
            print(f"  cuenta: @{info['username']}  ·  {info.get('followers_count','?')} seguidores")
            return info["id"], info["username"]
        print(f"  (el ig_id guardado no responde; probando por página…)")

    pages = api("me/accounts", token, fields="id,name").get("data", [])
    for p in pages:
        info = api(p["id"], token, fields="instagram_business_account{id,username,followers_count}")
        ig = info.get("instagram_business_account")
        if not ig:
            continue
        if expected_handle and ig["username"].lower() != expected_handle.lower():
            print(f"  (encontrada @{ig['username']}, no es la que buscamos)")
            continue
        print(f"  cuenta: @{ig['username']}  ·  {ig.get('followers_count','?')} seguidores")
        return ig["id"], ig["username"]

    sys.exit("No encuentro la cuenta de Instagram.\n"
             "Si es una cuenta profesional nueva, añade su ID a "
             f"{CREDS} con la clave \"ig_id\".")


def fetch_media(ig_id, token, limit):
    fields = "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count"
    out, url_params = [], {"fields": fields, "limit": min(limit, 100)}
    data = api(f"{ig_id}/media", token, **url_params)
    out.extend(data.get("data", []))
    # paginar si hace falta
    while len(out) < limit and data.get("paging", {}).get("next"):
        for intento in range(4):
            try:
                with urlopen(data["paging"]["next"], timeout=45) as r:
                    data = json.load(r)
                break
            except (URLError, TimeoutError, OSError):
                time.sleep(2 * (intento + 1))
        else:
            break
        out.extend(data.get("data", []))
    return out[:limit]


def fetch_insights(media_id, kind, token):
    """Pide las métricas del tipo correspondiente. Si la API rechaza alguna,
    reintenta sin ella en vez de perder la publicación entera."""
    wanted = METRICS.get(kind, METRICS["IMAGE"])
    faltan = []
    while wanted:
        try:
            r = api(f"{media_id}/insights", token, metric=",".join(wanted))
            vals = {d["name"]: d["values"][0]["value"] for d in r.get("data", [])}
            if faltan:
                vals["_no_disponibles"] = ",".join(faltan)
            return vals
        except RuntimeError as e:
            msg = str(e)
            culpable = next((m for m in wanted if m in msg), None)
            if not culpable:
                return {"_error": msg[:120]}
            wanted.remove(culpable)
            faltan.append(culpable)
    return {"_error": "ninguna métrica disponible"}


def keyword_hits(media_id, token, keywords):
    """Cuenta comentarios que contienen una palabra clave — nuestro proxy de leads,
    ya que la API no expone 'leads' como métrica."""
    if not keywords:
        return 0, ""
    try:
        cs = api(f"{media_id}/comments", token, fields="text", limit=200).get("data", [])
    except RuntimeError:
        return 0, ""
    # Palabra completa, sin mayúsculas ni acentos: "IA" no debe contar "energía",
    # y "sueno" sí cuenta como "Sueño".
    patrones = [re.compile(rf"\b{re.escape(_norm(k))}\b") for k in keywords]
    hits = [c["text"] for c in cs
            if any(p.search(_norm(c.get("text", ""))) for p in patrones)]
    return len(hits), " | ".join(hits[:3])


def _norm(txt):
    txt = unicodedata.normalize("NFKD", str(txt or "").lower())
    return "".join(ch for ch in txt if not unicodedata.combining(ch))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=60)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--handle", default="")
    ap.add_argument("--since", default="",
                    help="solo analiza publicaciones desde esta fecha (YYYY-MM-DD). "
                         "Empezamos de cero: el contenido anterior no cuenta.")
    ap.add_argument("--keywords", default="",
                    help="palabras clave de CTA para contar como leads (p. ej. WORLDS,GENETICS)")
    a = ap.parse_args()

    global BASE
    print("Instagram Insights")
    c = load_creds()

    # Preferimos la API con login de Instagram si hay credenciales: es la única que
    # entrega guardados y alcance para cuentas profesionales sin página de Facebook.
    if c.get("ig_user_token") or c.get("ig_long_token"):
        BASE = GRAPH_IG
        print("  vía: API de Instagram (graph.instagram.com)")
        token = get_ig_long_token(c)
        me = api("me", token, fields="id,username,followers_count,media_count")
        ig_id, handle = "me", me.get("username", a.handle)
        print(f"  cuenta: @{handle}  ·  {me.get('followers_count','?')} seguidores")
    else:
        BASE = GRAPH_FB
        print("  vía: API con login de Facebook (sin guardados/alcance)")
        token = get_long_token(c)
        ig_id, handle = find_ig_account(token, c, a.handle)

    print(f"  trayendo hasta {a.limit} publicaciones…")
    media = fetch_media(ig_id, token, a.limit)
    # Empezamos de cero: solo cuenta lo subido desde la línea de salida.
    if a.since:
        antes = len(media)
        media = [m for m in media if (m.get("timestamp", "")[:10] >= a.since)]
        print(f"  {len(media)} publicaciones desde {a.since} (ignoradas {antes - len(media)} anteriores)")
    else:
        print(f"  {len(media)} publicaciones")

    if not media:
        print(f"\n  Todavía no hay publicaciones desde {a.since}.")
        print("  Sube 3-5 vídeos nuevos y vuelve a ejecutar esto; entonces habrá qué analizar.")
        return

    kws = [k.strip() for k in a.keywords.split(",") if k.strip()]
    rows = []
    for i, m in enumerate(media, 1):
        kind = m.get("media_product_type") or m.get("media_type") or "IMAGE"
        ins = fetch_insights(m["id"], kind, token)
        n_kw, ejemplos = keyword_hits(m["id"], token, kws)
        cap = (m.get("caption") or "").replace("\n", " ")

        likes = ins.get("likes", m.get("like_count", 0)) or 0
        coment = ins.get("comments", m.get("comments_count", 0)) or 0
        guard = ins.get("saved", 0) or 0
        comp = ins.get("shares", 0) or 0
        # total_interactions a veces vuelve 0 aunque haya likes; lo recomponemos.
        inter = ins.get("total_interactions", 0) or 0
        if not inter:
            inter = likes + coment + guard + comp

        rows.append({
            "fecha": m.get("timestamp", "")[:10],
            "tipo": kind,
            "gancho": cap[:90],
            "texto": cap,  # pie de foto completo: la CTA suele ir al final
            "url": m.get("permalink", ""),
            "alcance": ins.get("reach", ""),
            "repro": ins.get("views", ""),
            "likes": likes,
            "comentarios": coment,
            "guardados": guard,
            "compartidos": comp,
            "interacciones": inter,
            "leads_kw": n_kw,
            "ejemplos_kw": ejemplos,
            "incidencias": ins.get("_error", "") or ins.get("_no_disponibles", ""),
        })
        print(f"\r  {i}/{len(media)}", end="", flush=True)
    print()

    out = pathlib.Path(__file__).parent / "insights.json"
    out.write_text(json.dumps({"handle": handle, "generado": time.strftime("%Y-%m-%d %H:%M"),
                               "publicaciones": rows}, indent=2, ensure_ascii=False))
    print(f"  guardado -> {out}")

    if rows:
        print("\n  últimas publicaciones:")
        print(f"  {'fecha':<11}{'tipo':<16}{'alcance':>9}{'guard.':>8}{'comp.':>7}{'leads':>7}  gancho")
        for r in rows[:8]:
            print(f"  {r['fecha']:<11}{r['tipo']:<16}{str(r['alcance']):>9}"
                  f"{str(r['guardados']):>8}{str(r['compartidos']):>7}{str(r['leads_kw']):>7}"
                  f"  {r['gancho'][:44]}")
        prob = [r for r in rows if r["incidencias"]]
        if prob:
            print(f"\n  {len(prob)} publicaciones con métricas no disponibles "
                  f"(normal en posts antiguos o tipos que Meta ya no mide)")

    if a.dry_run:
        print("\n  --dry-run: no se ha escrito en la hoja")


if __name__ == "__main__":
    main()
