#!/usr/bin/env python3
"""Replay the caption chunker (src/lib/chunk.ts) and flag seam problems (guide §9).

  python3 tools/chunk_preview.py reel-01

Flags single-word blocks, blocks shorter than 0.45 s and words within 0.1 s
of a cut — fix those 5–7 timings by hand in tx/words.json BEFORE rendering.
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
reel = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
words = json.loads((ROOT / "public" / reel / "tx/words.json").read_text())
TARGET, CAP = 4, 6
ends = lambda w: re.search(r"[.,!?;:…]$", w["text"].strip())
mk = lambda ws: {"words": ws, "start": ws[0]["start"], "end": ws[-1]["end"]}
short = lambda b: len(b["words"]) < 2 or b["end"] - b["start"] < 0.45

blocks, cur = [], []
for w in words:
    cur.append(w)
    if ends(w) or len(cur) >= TARGET:
        blocks.append(mk(cur)); cur = []
if cur:
    blocks.append(mk(cur))
i = len(blocks) - 1
while i >= 0:
    if i < len(blocks) and short(blocks[i]) and len(blocks) > 1:
        b, prev = blocks[i], blocks[i - 1] if i > 0 else None
        nxt = blocks[i + 1] if i + 1 < len(blocks) else None
        if prev and not ends(prev["words"][-1]) and len(prev["words"]) + len(b["words"]) <= CAP:
            blocks[i - 1:i + 1] = [mk(prev["words"] + b["words"])]
        elif nxt and len(nxt["words"]) + len(b["words"]) <= CAP:
            blocks[i:i + 2] = [mk(b["words"] + nxt["words"])]
        elif prev and len(prev["words"]) + len(b["words"]) <= CAP:
            blocks[i - 1:i + 1] = [mk(prev["words"] + b["words"])]
    i -= 1
for a, b in zip(blocks, blocks[1:]):
    a["end"] = min(a["end"], b["start"])

cuts = []
tl = ROOT / "public" / reel / "cuts.json"  # optional: [t, t, ...] seam times written by you
if tl.exists():
    cuts = json.loads(tl.read_text())
for b in blocks:
    txt = " ".join(w["text"] for w in b["words"])
    flags = []
    if len(b["words"]) == 1:
        flags.append("1 palabra")
    if b["end"] - b["start"] < 0.45:
        flags.append(f"{b['end'] - b['start']:.2f}s")
    if any(abs(w["start"] - c) < 0.1 or abs(w["end"] - c) < 0.1 for w in b["words"] for c in cuts):
        flags.append("junto a un corte")
    print(f"{b['start']:7.2f}–{b['end']:7.2f}  {txt}{'   ⚠️ ' + ', '.join(flags) if flags else ''}")
