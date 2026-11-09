#!/usr/bin/env python3
"""Subtítulos en el idioma del estudio, en un solo paso.

  python3 tools/subtitulos.py reel-01            → un reel
  python3 tools/subtitulos.py reel-01 reel-02    → varios
  python3 tools/subtitulos.py --todos            → todos los reels que tienen video.mp4

El idioma se configura UNA vez en studio.config.json ("idioma": "es").
Por cada reel: transcribe con Whisper en ese idioma; si el resultado no es
bueno (otro idioma, se repite, no cubre el vídeo) o no hay GROQ_API_KEY, usa
el guion (SCRIPT.md) sincronizado con la voz. La versión anterior de
words.json queda en tx/words.bak.json.
"""
import os, pathlib, subprocess, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from captions_from_script import has_script, make  # noqa: E402
from transcribe import default_lang  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]


def reels_with_video():
    return sorted(p.parent.name for p in (ROOT / "public").glob("*/video.mp4") if p.parent.name != "ejemplo")


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    reels = reels_with_video() if "--todos" in args else [a for a in args if not a.startswith("--")]
    if not reels:
        sys.exit("✗ no hay reels con public/<reel>/video.mp4")
    lang = default_lang()
    key = bool(os.environ.get("GROQ_API_KEY"))
    print(f"Idioma: {lang}  (cámbialo en studio.config.json)")
    if not key:
        print("Sin GROQ_API_KEY: uso el guion de cada reel.")
    failed = []
    for reel in reels:
        print(f"\n══ {reel}")
        if not (ROOT / "public" / reel / "video.mp4").exists():
            print(f"✗ falta public/{reel}/video.mp4 (monta el master primero)")
            failed.append(reel)
            continue
        if key:
            r = subprocess.run([sys.executable, str(ROOT / "tools/transcribe.py"), reel, "--auto"])
            if r.returncode:
                failed.append(reel)
        elif has_script(reel):
            make(reel)
        else:
            print(f"✗ sin GROQ_API_KEY y src/reels/{reel}/SCRIPT.md está vacío")
            failed.append(reel)
    print(f"\n{'✅ listo' if not failed else '⚠️  revisar: ' + ', '.join(failed)}  →  npm run studio")


if __name__ == "__main__":
    main()
