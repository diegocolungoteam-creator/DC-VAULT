#!/usr/bin/env python3
"""50 ms RMS level curve around a moment (guide §8.6–8.7).

  python3 tools/rms.py reel-01 raw/c01.mp4 63.4        # ±2 s window around 63.4 s
  python3 tools/rms.py reel-01 raw/c01.mp4 63.4 --end  # suggest the take END after the last word at 63.4

A restart hidden inside a long Whisper "word" shows as a 0.15–0.3 s dip of
−10 to −35 dB in the middle. Take end = first point after the last word where
the level stays below −30 dB for two windows, +0.04 s. Take start = first word −0.06 s.
"""
import pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fflib import rms_curve  # noqa: E402

if len(sys.argv) < 4:
    sys.exit(__doc__)
reel, clip, t = sys.argv[1], sys.argv[2], float(sys.argv[3])
path = pathlib.Path(__file__).resolve().parents[1] / "public" / reel / clip
ss = max(0.0, t - 2.0)
ts, db = rms_curve(path, ss, 4.0)

if "--end" in sys.argv:
    for i in range(len(db) - 1):
        if ts[i] >= t and db[i] < -30 and db[i + 1] < -30:
            print(f"fin de toma sugerido: {ts[i] + 0.04:.2f} s")
            break
    else:
        print("no baja de −30 dB dos ventanas seguidas en +2 s — mira la curva")

for x, d in zip(ts, db):
    bar = "█" * max(0, int((d + 60) / 1.5))
    mark = "  ◀" if abs(x - t) < 0.025 else ""
    print(f"{x:8.2f}  {d:6.1f} dB  {bar}{mark}")
