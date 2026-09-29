#!/usr/bin/env python3
"""Create a new reel from the template:  python3 tools/new_reel.py reel-01"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if len(sys.argv) != 2 or not re.fullmatch(r"[a-z0-9-]+", sys.argv[1]):
    sys.exit("uso: python3 tools/new_reel.py <id>   (minúsculas, números y guiones, p. ej. reel-01)")
rid = sys.argv[1]
var = "r" + re.sub(r"[^a-zA-Z0-9]", "_", rid)
src, pub = ROOT / "src/reels" / rid, ROOT / "public" / rid
if src.exists():
    sys.exit(f"src/reels/{rid} ya existe")

for d in ("raw", "tx", "img", "music"):
    (pub / d).mkdir(parents=True, exist_ok=True)
src.mkdir(parents=True)
(pub / "tx/words.json").write_text("[]\n")
(src / "cards.json").write_text("[]\n")

tpl = ROOT / "tools/templates"
(src / "SCRIPT.md").write_text((tpl / "SCRIPT.md").read_text())
(pub / "TAKELIST.md").write_text((tpl / "TAKELIST.md").read_text())
(pub / "assemble.py").write_text((tpl / "assemble.py").read_text().replace("__REEL__", rid))
(src / "index.tsx").write_text((tpl / "index.tsx").read_text().replace("__REEL__", rid))

reg = ROOT / "src/reels/registry.ts"
s = reg.read_text()
s = s.replace("import ejemplo from './ejemplo';", f"import ejemplo from './ejemplo';\nimport {var} from './{rid}';")
s = s.replace("  ejemplo,\n", f"  ejemplo,\n  '{rid}': {var},\n")
reg.write_text(s)

print(f"""✅ {rid} creado:
   src/reels/{rid}/SCRIPT.md          ← pega el guion (obligatorio, guía §5)
   public/{rid}/raw/                  ← copia aquí los clips
   public/{rid}/TAKELIST.md           ← qué toma lleva cada frase
   public/{rid}/assemble.py           ← la lista de tomas → video.mp4
   src/reels/{rid}/index.tsx + cards.json  ← el reel como datos""")
