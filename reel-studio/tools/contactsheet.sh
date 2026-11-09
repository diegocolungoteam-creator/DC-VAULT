#!/usr/bin/env bash
# Look at the footage (guide §8.2).
#   tools/contactsheet.sh public/reel-01/video.mp4              → 6-frame overview with 10 % gridlines
#   tools/contactsheet.sh public/reel-01/video.mp4 12.8 6       → 3 fps sheet of 12.8–18.8 s (cell n = START + n/3 s)
set -euo pipefail
IN="${1:?uso: tools/contactsheet.sh <video> [inicio] [duración]}"
OUT="out/sheet-$(basename "${IN%.*}")${2:+-$2}.jpg"
mkdir -p out
if [ -z "${2:-}" ]; then
  TOTAL=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$IN")
  ffmpeg -y -v error -i "$IN" -vf \
    "select='not(mod(n,$((TOTAL/6))))',drawgrid=w=iw:h=ih/10:t=2:c=yellow@0.6,scale=250:-1,tile=6x1" \
    -frames:v 1 "$OUT"
else
  ffmpeg -y -v error -ss "$2" -t "${3:-6}" -i "$IN" -vf "fps=3,scale=150:-1,tile=6x3" -frames:v 1 "$OUT"
fi
echo "→ $OUT"; [ "$(uname)" = Darwin ] && open "$OUT" || true
