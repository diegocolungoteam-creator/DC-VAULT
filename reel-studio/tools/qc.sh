#!/usr/bin/env bash
# Verify the EXPORTED file, not the preview (guide §19).   tools/qc.sh out/reel-01-v3.mp4
set -uo pipefail
F="${1:?uso: tools/qc.sh <render.mp4>}"
echo "── frames / tamaño"
ffprobe -v error -count_frames -select_streams v:0 \
  -show_entries stream=nb_read_frames,width,height -of default=noprint_wrappers=1 "$F"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "$F"
echo "── errores de decodificación (vacío = bien)"
ffmpeg -v error -i "$F" -f null - 2>&1 | head -20
echo "── silencios > 0.4 s a −35 dB (no debería haber aire muerto)"
ffmpeg -hide_banner -nostats -i "$F" -af "silencedetect=noise=-35dB:d=0.4" -f null - 2>&1 | grep -E "silence_(start|end)" || echo "   ninguno"
echo "── nivel de voz"
ffmpeg -hide_banner -nostats -i "$F" -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
echo "── picos (cuenta, no nivel)"
ffmpeg -hide_banner -nostats -i "$F" -af "astats=metadata=1:reset=0" -f null - 2>&1 | grep -E "Peak count|Flat factor" | tail -2
