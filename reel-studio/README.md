# Reel Studio

Estudio de reels en código ([Remotion](https://remotion.dev)): de metraje en
bruto a reel de Instagram/TikTok terminado, con subtítulos palabra a palabra,
tarjetas de marca, cámara motivada y sonido — renderizado directo a MP4.

La guía completa (el *por qué* de cada regla) está en
[`docs/GUIA-ESTUDIO.md`](docs/GUIA-ESTUDIO.md). Los números de sección (§) de
los comentarios del código apuntan a ella.

---

## 1. Instalar en tu Mac (una vez)

Abre **Terminal** y pega:

```bash
cd ~
git clone https://github.com/diegocolungoteam-creator/DC-VAULT.git
cd DC-VAULT
git checkout claude/new-session-nx3jy7
cd reel-studio
./setup-mac.sh
```

El script instala Homebrew, ffmpeg, Node y Python/numpy si faltan, luego las
dependencias del proyecto, y comprueba que todo compila.

Para transcribir (recomendado), crea una clave gratis en
[console.groq.com](https://console.groq.com) y añádela:

```bash
echo 'export GROQ_API_KEY="tu_clave"' >> ~/.zshrc && source ~/.zshrc
```

Comprueba que funciona:

```bash
npm run studio          # abre el editor en el navegador → elige "ejemplo"
```

---

## 2. Tu marca — PRIME-X (ya configurada)

`src/brand.ts` ya tiene tu marca, con los colores sacados de los archivos del logo:

| token | valor | uso |
|---|---|---|
| `accent` | `#8B2FD6` | bloques de relleno (texto blanco encima, contraste 6:1) |
| `accentText` | `#B06CF0` | palabras de color sobre el vídeo (se lee sobre fondos claros) |
| `surface` / `black` | `#0C0819` | el fondo del logo: capturas y cierre |
| fuente | Montserrat 500–900 | se parece a la de tu logo, con licencia libre para uso comercial |

Logos en `public/brand/`: `logo-mark.png` (hexágono con la hélice de ADN, arriba a
la derecha en cada reel, se aparta cuando hay una tarjeta arriba),
`logo-vertical.png` y `logo-horizontal.png` (Academy). Están recortados de
JPG; si tienes el PNG/SVG original, reemplázalos con el mismo nombre.

Para ver todas las tarjetas y el cierre con tu marca:

```bash
npx remotion still brand out/brand.png --frame=130
npm run studio   # → composición "brand"
```

---

## 3. Cada reel

| paso | comando / archivo |
|---|---|
| Crear el reel | `python3 tools/new_reel.py reel-01` |
| **Pegar el guion** (obligatorio) | `src/reels/reel-01/SCRIPT.md` |
| Copiar los clips | `public/reel-01/raw/` (convierte HEVC a H.264 si hace falta, guía §8.3) |
| Ver el metraje | `tools/contactsheet.sh public/reel-01/raw/c01.mp4` |
| Transcribir cada clip | `tools/transcribe.sh reel-01 raw/c01.mp4` |
| Elegir tomas | `public/reel-01/TAKELIST.md` → `SEGMENTS` en `public/reel-01/assemble.py` |
| Revisar reinicios / cortes | `python3 tools/rms.py reel-01 raw/c01.mp4 63.4 [--end]` |
| Montar el master | `python3 public/reel-01/assemble.py` (`--denoise` solo si hay ruido) |
| Transcribir el master | `tools/transcribe.sh reel-01` → **corrige** `tx/words.json` contra el guion |
| Revisar subtítulos | `python3 tools/chunk_preview.py reel-01` |
| Tarjetas | `src/reels/reel-01/cards.json` |
| Cámara, sonido, zona segura | `src/reels/reel-01/index.tsx` |
| Auditar tarjetas vs. audio | `python3 tools/audit_cards.py reel-01` |
| Foto de zona segura IG | `npx remotion still reel-01-ig out/ig.png --frame=300` |
| Renderizar (nombre nuevo cada vez) | `npx remotion render reel-01 out/reel-01-v1.mp4` |
| Versión sin música | `npx remotion render reel-01-nomusic out/reel-01-v1-nm.mp4` |
| Control de calidad | `tools/qc.sh out/reel-01-v1.mp4` |

### Tipos de tarjeta (`cards.json`)

```json
{"id": "hook",   "type": "hook",   "text": "Entrenas 5 días y no cambias", "highlight": "no cambias", "start": 0.4, "end": 3.5}
{"id": "mito",   "type": "strike", "wrong": "Más cardio", "right": "Más fuerza", "start": 7.3, "end": 10.3}
{"id": "tres",   "type": "number", "label": "3 cosas", "items": ["Duerme 7 h", "Proteína", "Pesas"], "at": [11.5, 12.9, 14.9], "start": 10.4, "end": 16.6}
{"id": "frase",  "type": "quote",  "text": "La constancia gana.", "author": "Diego", "start": 5, "end": 7, "slot": "center"}
{"id": "cta",    "type": "cta",    "keyword": "PLAN", "lead": "Comenta", "sub": "y te mando la guía", "start": 16.7, "end": 20.3}
```

`slot`: `top` (por defecto), `center`, `lower`, `side`. Todos quedan dentro de
la caja legible y 432–1430 de Instagram.

---

## 4. Reglas que no se negocian

- **Guion con cada vídeo.** La transcripción se equivoca justo en el CTA y los nombres.
- **Si una frase se dice dos veces, gana la última.**
- **Subtítulos de la primera a la última palabra, siempre.** Nunca se ocultan.
- **Nada legible fuera de y 432–1430.** Haz la foto `-ig` antes de cada render.
- **Nunca tapar la cara.** Encuadre ideal al grabar: cabeza al 30 %, barbilla al 62 %.
- **Cada zoom con un motivo** (`reason` es obligatorio en el código).
- **Renderiza a un nombre de archivo nuevo cada vez.**
- **TypeScript en 5.x.** Remotion no funciona con TS 7.

## Estructura

```
reel-studio/
├── setup-mac.sh
├── docs/GUIA-ESTUDIO.md      la guía completa
├── editing-pack/             tu librería de sonidos, música, overlays (fuera de git)
├── footage/                  metraje original sin tocar (fuera de git)
├── tools/                    transcribir, montar, auditar, QC
├── public/
│   ├── fonts/  fx/  music/  sfx/  brand/
│   └── <reel>/raw/ tx/ img/ TAKELIST.md assemble.py video.mp4
└── src/
    ├── brand.ts  ig-safe.ts  fonts.tsx  types.ts  Root.tsx
    ├── components/           Reel, Footage, Captions, Wash, Grain, IgSafeOverlay, cards/
    └── reels/<reel>/         index.tsx  cards.json  SCRIPT.md
```

## Pendiente de ti

- Logo original en PNG/SVG para sustituir los recortados de JPG.
- Tu pack de sonidos: normaliza efectos (`loudnorm=I=-20:TP=-3`) a `public/sfx/`,
  una pista de fondo a `public/music/`, grano H.264 a `public/fx/grain.mp4` (guía §10–11, §15).
- Medir la UI de Instagram con una captura tuya si cambia (`src/ig-safe.ts`).
