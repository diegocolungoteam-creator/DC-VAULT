# Instalar el motor de contenido en tu Mac

Todo se hace desde la app **Terminal** del Mac. Copia cada bloque, pégalo y pulsa Enter.
Si prefieres, abre Claude Code en el Mac dentro de esta carpeta y dile: "sigue INSTALAR.md conmigo".

Ninguna clave se pega en un chat: cada comando te la pide en la terminal y la guarda en un archivo
que solo tú puedes leer.

## 1. Bajar el repo

```bash
cd ~
git clone https://github.com/diegocolungoteam-creator/DC-VAULT.git DC-VAULT 2>/dev/null || (cd ~/DC-VAULT && git pull)
cd ~/DC-VAULT && git checkout claude/new-session-0b5jy0 && git pull
cd ~/DC-VAULT/content-engine
```

(Si ya tienes el repo en otra carpeta, usa esa ruta en vez de `~/DC-VAULT`. Cuando la rama se fusione con `main`, basta con `git checkout main && git pull`.)

## 2. Instalar Python y las librerías

```bash
cd ~/DC-VAULT/content-engine
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## 3. Clave de Google (la cuenta de servicio)

El JSON que descargaste de Google Cloud está en Descargas (empieza por `motor-contenido-`).

```bash
mkdir -p ~/.config/gcloud
mv ~/Downloads/motor-contenido-*.json ~/.config/gcloud/content-engine-sa.json
chmod 600 ~/.config/gcloud/content-engine-sa.json
```

## 4. Clave de Anthropic

Este comando te pide la clave sin mostrarla en pantalla:

```bash
mkdir -p ~/.config/content-engine
read -s -p "Pega la clave de Anthropic y pulsa Enter: " K; echo
printf 'ANTHROPIC_API_KEY=%s\n' "$K" > ~/.config/content-engine/.env; unset K
chmod 600 ~/.config/content-engine/.env
```

## 5. Token de Instagram

Requisito: app de Meta creada, tú como tester de Instagram y la invitación aceptada.

1. En developers.facebook.com → tu app → Instagram → **API setup with Instagram login**.
2. En **Generate access tokens**, pulsa **Generate token** junto a @diegocolungo, inicia sesión y acepta
   los permisos (`instagram_business_basic`, `instagram_business_manage_insights`,
   `instagram_business_manage_comments`).
3. En la misma página ten a mano el **Instagram App ID** y el **Instagram App Secret** (botón "Mostrar").
4. Ejecuta esto y pega los tres datos cuando te los pida:

```bash
cd ~/DC-VAULT/content-engine
python3 save_token.py
```

## 6. Prueba manual

Primero sin escribir nada (pasos 1-3: métricas, cruce con el calendario y análisis):

```bash
cd ~/DC-VAULT/content-engine
.venv/bin/python weekly_engine.py --force --dry-run
```

Comprueba en lo que sale: aparece `@diegocolungo`, cuántas publicaciones desde el 2026-10-01 y cuántas
piezas son analizables.

Después, la corrida completa (escribe en las hojas y genera la semana):

```bash
.venv/bin/python weekly_engine.py --force
```

Abre el Calendario y el Banco de ideas: filas nuevas abajo, todas con `Propuesta IA`. Lee dos guiones
en voz alta. Si suenan a marketero y no a ti, se corrige el prompt, no el guion.

## 7. Activar la ejecución semanal

Solo cuando la prueba manual haya salido limpia:

```bash
cd ~/DC-VAULT/content-engine
sed "s#__ENGINE_DIR__#$PWD#g" com.dcteam.contentengine.plist > ~/Library/LaunchAgents/com.dcteam.contentengine.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.dcteam.contentengine.plist
```

El Mac lo intenta cada 6 horas, pero el motor solo trabaja una vez cada 7 días. Para pararlo:

```bash
launchctl bootout gui/$(id -u)/com.dcteam.contentengine
```

El registro de cada ejecución queda en `engine.log` dentro de esta carpeta.

## Tu rutina semanal

1. Abre el Calendario: filas nuevas con `Propuesta IA`.
2. Graba los guiones que te gusten, edítalos si quieres, ignora el resto. No hace falta aprobar nada.
3. Publica. No hace falta pegar la URL: el motor encuentra el post por el texto. Deja el gancho o el
   título en el pie de foto para que lo encuentre. Si lo enlaza mal, corrige la columna Post a mano.
4. ¿Has publicado algo fuera del plan? Se analiza igual.
5. Las notas `NEEDS EVIDENCE` piden datos reales del cliente y su permiso. `RECURSO NUEVO` significa que
   hay que crear ese recurso y añadir su palabra a `recursos_cta.md` y a `LEAD_KEYWORDS` en
   `weekly_engine.py`.
6. De vez en cuando, lee el "Historial de análisis" al final de `content_brain.md`.

Expectativas: las primeras semanas son pocos datos (tendencias, no conclusiones). La señal fiable llega
hacia los 2-3 meses y unas 40-50 piezas.
