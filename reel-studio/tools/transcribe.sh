#!/usr/bin/env bash
# Word-level transcription with Groq whisper-large-v3 (guide §8.4).
#   tools/transcribe.sh reel-01                 → the assembled master (drives captions)
#   tools/transcribe.sh reel-01 raw/c01.mp4     → one source clip (for the take list)
# Transcripts are versioned in public/<reel>/tx/. Never overwrites a corrected words.json.
set -euo pipefail
cd "$(dirname "$0")/.."
R="${1:?uso: tools/transcribe.sh <reel> [clip relativo a public/<reel>/]}"
IN="public/$R/${2:-video.mp4}"
LANG_CODE="${WHISPER_LANG:-es}"
[ -f "$IN" ] || { echo "✗ no existe $IN"; exit 1; }
: "${GROQ_API_KEY:?falta GROQ_API_KEY — añádela a ~/.zshrc (console.groq.com)}"

NAME=$(basename "${2:-master}"); NAME="${NAME%.*}"
TX="public/$R/tx"; mkdir -p "$TX"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

ffmpeg -v error -y -i "$IN" -vn -ac 1 -ar 16000 -b:a 64k "$TMP/a.mp3"
# curl, not Python urllib — urllib comes back 403 (guide §8.4)
curl -sS https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F file=@"$TMP/a.mp3" -F model=whisper-large-v3 -F language="$LANG_CODE" \
  -F response_format=verbose_json -F 'timestamp_granularities[]=word' \
  -o "$TX/$NAME.raw.json"

python3 - "$TX" "$NAME" <<'PY'
import json, sys, pathlib
tx, name = pathlib.Path(sys.argv[1]), sys.argv[2]
raw = json.loads((tx / f"{name}.raw.json").read_text())
if "words" not in raw:
    sys.exit(f"✗ respuesta sin palabras: {json.dumps(raw)[:400]}")
words = [{"text": w["word"].strip(), "start": round(w["start"], 3), "end": round(w["end"], 3)} for w in raw["words"]]
out = tx / f"{name}.whisper.json"
out.write_text(json.dumps(words, ensure_ascii=False, indent=0))
print(f"✅ {len(words)} palabras → {out}")
sus = [w for w in words if w["end"] - w["start"] > 0.9]
if sus:
    print(f"⚠️  {len(sus)} palabras > 0.9 s — posibles reinicios ocultos (guía §8.6):")
    for w in sus:
        print(f"     {w['start']:7.2f}–{w['end']:7.2f}  {w['text']}")
    print("   Revísalas:  python3 tools/rms.py", tx.parent.name, "<clip> <segundo>")
if name == "master":
    words_json = tx / "words.json"
    cur = words_json.read_text().strip() if words_json.exists() else "[]"
    if cur in ("", "[]"):
        words_json.write_text(out.read_text())
        print(f"   → copiado a {words_json}. CORRÍGELO contra SCRIPT.md antes de seguir (guía §5).")
    else:
        print(f"   {words_json} ya tiene una versión corregida: no la piso. Compara con {out.name}.")
PY
