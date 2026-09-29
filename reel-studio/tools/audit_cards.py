#!/usr/bin/env python3
"""Every card against what is SAID in its exact window (guide §9). Read every pair.

  python3 tools/audit_cards.py reel-01
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
reel = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
words = json.loads((ROOT / "public" / reel / "tx/words.json").read_text())
cards = json.loads((ROOT / "src/reels" / reel / "cards.json").read_text())


def copy(c):
    return {
        "hook": lambda: c["text"],
        "quote": lambda: c["text"],
        "strike": lambda: f"~~{c['wrong']}~~ → {c.get('right', '')}",
        "number": lambda: f"{c['label']}: " + " | ".join(c["items"]),
        "cta": lambda: f"{c.get('lead', 'Comenta')} {c['keyword']} {c.get('sub', '')}",
    }[c["type"]]()


for c in sorted(cards, key=lambda c: c["start"]):
    s, e = c["start"], c["end"]
    said = " ".join(w["text"] for w in words if w["start"] >= s - 0.35 and w["end"] <= e + 0.35)
    print(f"── {c.get('id', c['type'])} [{s:.1f}–{e:.1f}]\n   DICE:    {said}\n   TARJETA: {copy(c)}\n")

overlaps = [(a, b) for i, a in enumerate(cards) for b in cards[i + 1:]
            if a.get("slot", "top") == b.get("slot", "top") and a["start"] < b["end"] and b["start"] < a["end"]]
for a, b in overlaps:
    print(f"⚠️  {a.get('id')} y {b.get('id')} se solapan en el mismo hueco ({a.get('slot', 'top')})")
