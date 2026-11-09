#!/usr/bin/env bash
# One-time setup on macOS. Run from the reel-studio folder:  ./setup-mac.sh
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v brew >/dev/null; then
  echo "→ Instalando Homebrew (te pedirá la contraseña del Mac)…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
fi

echo "→ Instalando ffmpeg, Node y Python…"
brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg
command -v node >/dev/null || brew install node
command -v python3 >/dev/null || brew install python
python3 -c "import numpy" 2>/dev/null || python3 -m pip install --user numpy || brew install numpy

echo "→ Dependencias del proyecto…"
npm install

echo "→ Comprobando tipos…"
npm run typecheck

mkdir -p footage out editing-pack/{Sounds,Music,Overlays,Transitions,PNGs}
chmod +x tools/*.sh

cat <<MSG

✅ Listo.

  node   $(node -v)
  ffmpeg $(ffmpeg -version | head -1 | awk '{print $3}')

Siguientes pasos:
  npm run studio                      # abre el editor en el navegador
  npx remotion still brand out/brand.png --frame=130   # prueba rápida de la marca

Para transcribir con Groq (recomendado), añade a ~/.zshrc:
  export GROQ_API_KEY="tu_clave"
La primera vez que renderices, Remotion descarga su propio Chrome (~100 MB).
MSG
