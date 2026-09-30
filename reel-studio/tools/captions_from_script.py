#!/usr/bin/env python3
"""Captions from the SCRIPT, timed to the voice — no Whisper involved.

  python3 tools/captions_from_script.py reel-01
  python3 tools/captions_from_script.py reel-01 raw/c01.mov   # another file than video.mp4

Use it when transcription comes out in the wrong language, repeats itself or
misses chunks. The words are always exactly the script (right language, right
spelling, right CTA); the timing comes from where the voice is in the audio:
speech stretches are found with silencedetect and the script's words are laid
across them in order, each word taking time in proportion to its length.

Timing is approximate (usually within a few tenths of a second on steady
speech). Captions follow the SCRIPT, so if the speaker improvised or skipped a
line, edit SCRIPT.md (or tx/words.json) to match what was actually said.
Writes public/<reel>/tx/words.json; the previous one is kept as words.bak.json.
"""
import json, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fflib import duration, run  # noqa: E402
from transcribe import pick_track  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOISE_DB = -35   # below this is silence (−30 eats consonants, guide §8.7)
MIN_GAP = 0.18   # pauses shorter than this are rhythm inside a sentence, not a gap
MIN_SPEECH = 0.12


def script_words(reel):
    p = ROOT / "src/reels" / reel / "SCRIPT.md"
    if not p.exists():
        sys.exit(f"✗ no existe {p.relative_to(ROOT)}")
    text = p.read_text()
    body = text.split("\n---\n", 1)[1] if "\n---\n" in text else text
    lines = [l for l in body.splitlines() if l.strip() and not re.match(r"\s*(#|>|\*\*|\(pega)", l)]
    words = " ".join(lines).split()
    if not words:
        sys.exit(f"✗ {p.relative_to(ROOT)} no tiene guion: pégalo debajo de la línea ---")
    return words


def speech_regions(path, dur):
    track = pick_track(path, dur)  # the loudest audio track, not a silent first one
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-map", f"0:{track}", "-ac", "1",
               "-af", f"silencedetect=noise={NOISE_DB}dB:d={MIN_GAP}", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    silences = list(zip(starts, ends + [dur] * (len(starts) - len(ends))))
    regions, t = [], 0.0
    for a, b in silences:
        if a - t >= MIN_SPEECH:
            regions.append((t, a))
        t = max(t, b)
    if dur - t >= MIN_SPEECH:
        regions.append((t, dur))
    return regions


def weight(w):
    """Rough spoken length: letters/digits, with a floor so short words still get time."""
    core = re.sub(r"[^\wáéíóúüñÁÉÍÓÚÜÑ]", "", w)
    return max(len(core), 2) + (3 if re.search(r"[.!?…]$", w) else 1 if re.search(r"[,;:]$", w) else 0)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    reel = args[0]
    rel = args[1] if len(args) > 1 else "video.mp4"
    src = ROOT / "public" / reel / rel
    if not src.exists():
        sys.exit(f"✗ no existe {src.relative_to(ROOT)}")

    words = script_words(reel)
    dur = duration(src)
    regions = speech_regions(src, dur)
    if not regions:
        sys.exit("✗ no encuentro voz en el audio (¿pista en silencio?)")
    talk = sum(b - a for a, b in regions)
    print(f"→ {src.relative_to(ROOT)}  {dur:.1f} s, voz en {len(regions)} tramos ({talk:.1f} s)")
    print(f"→ guion: {len(words)} palabras")

    # Lay words along the speech timeline, which skips the silences.
    ws = [weight(w) for w in words]
    per = talk / sum(ws)

    def at(offset):
        """Map 'seconds of speech consumed' → absolute time on the video."""
        acc = 0.0
        for a, b in regions:
            if offset <= acc + (b - a):
                return a + (offset - acc)
            acc += b - a
        return regions[-1][1]

    out, pos = [], 0.0
    for w, k in zip(words, ws):
        s, e = at(pos), at(pos + k * per)
        # A word must not straddle a pause: keep it in the region holding most of it.
        reg = next(((a, b) for a, b in regions if a <= s < b), None)
        if reg and e > reg[1]:
            nxt = next(((a, b) for a, b in regions if a >= reg[1]), None)
            if nxt and (reg[1] - s) < (e - nxt[0]):
                s = nxt[0]
            else:
                e = reg[1]
        # A new sentence starts when the voice starts again: snap back to a nearby region start.
        if not out or re.search(r"[.!?…]$", out[-1]["text"]):
            back = [a for a, _ in regions if s - 0.8 <= a <= s and (not out or a >= out[-1]["end"])]
            if back:
                s = back[-1]
        out.append({"text": w, "start": round(s, 3), "end": round(max(e, s + 0.08), 3)})
        pos += k * per

    tx = ROOT / "public" / reel / "tx"
    tx.mkdir(parents=True, exist_ok=True)
    wj = tx / "words.json"
    if wj.exists() and wj.read_text().strip() not in ("", "[]"):
        (tx / "words.bak.json").write_text(wj.read_text())
        print(f"   copia de la versión anterior → {(tx / 'words.bak.json').relative_to(ROOT)}")
    wj.write_text(json.dumps(out, ensure_ascii=False, indent=0))
    (tx / "script-timed.json").write_text(json.dumps(out, ensure_ascii=False, indent=0))
    print(f"✅ {len(out)} palabras del guion → {wj.relative_to(ROOT)}")
    print(f"   {out[0]['start']:.2f}s  {' '.join(w['text'] for w in out[:8])} …")
    print(f"   … {' '.join(w['text'] for w in out[-6:])}  {out[-1]['end']:.2f}s")
    print("   Revisa en el Studio que cada frase entra a tiempo; si una va desfasada, ajusta su")
    print("   start/end en words.json. Si dijiste algo distinto al guion, corrígelo ahí también.")


if __name__ == "__main__":
    main()
