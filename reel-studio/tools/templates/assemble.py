#!/usr/bin/env python3
"""Take list → public/__REEL__/video.mp4 (guide §8.6, §16).

Edit SEGMENTS, then:  python3 public/__REEL__/assemble.py [--denoise]
"""
import pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "tools"))
from assemble_lib import Seg, assemble  # noqa: E402

HERE = pathlib.Path(__file__).parent

# (clip in raw/, in, out, [internal silences to remove], label)
SEGMENTS = [
    # Seg("c01.mp4", 0.00, 6.16, [], "hook"),
    # Seg("c03.mp4", 63.42, 70.08, [(65.73, 65.91)], "bloque 1"),
]

# Script-specified beats: black gap after a segment (s), freeze on last frame (s)
BLACK_AFTER = {}      # {"hook": 0.45}
FREEZE_END = 0.0      # e.g. 1.3 under the CTA card

if __name__ == "__main__":
    assemble(HERE, SEGMENTS, black_after=BLACK_AFTER, freeze_end=FREEZE_END,
             denoise="--denoise" in sys.argv)
