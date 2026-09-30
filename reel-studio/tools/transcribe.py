#!/usr/bin/env python3
"""Word-level transcription with Groq whisper-large-v3 (guide §8.4), hardened
against Whisper hallucinations.

  python3 tools/transcribe.py reel-01                  → the assembled master (drives captions)
  python3 tools/transcribe.py reel-01 raw/c01.mov      → one source clip (for the take list)
  python3 tools/transcribe.py reel-01 --force          → replace an existing words.json (backed up)
  python3 tools/transcribe.py reel-01 --lang en        → another language (default: es)

What it does beyond a single API call, and why:
- Picks the LOUDEST audio track. iPhones and cameras often carry several, and a
  silent first track makes Whisper invent English phrases on a loop.
- Cuts the audio into ~40 s chunks at silences. On long files Whisper loses the
  thread after the first seconds and starts repeating itself.
- Forces the language and passes the script (SCRIPT.md) as a prompt, so names,
  the CTA keyword and Spanish spelling come out right.
- Drops silent chunks, retries a chunk whose text repeats, and warns when the
  result doesn't cover the audio or doesn't look like the requested language.
"""
import json, pathlib, re, shutil, subprocess, sys, tempfile

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fflib import duration, mean_volume, run  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
API = "https://api.groq.com/openai/v1/audio/transcriptions"
CHUNK = 40.0      # target chunk length (s)
SEARCH = 8.0      # look this far either side of the target for a silence to cut at
SILENT_DB = -48.0 # a chunk/track quieter than this has no speech

STOP = {
    "es": {"que", "de", "el", "la", "y", "en", "los", "las", "es", "no", "un", "una", "por", "con", "para", "lo", "se", "del", "más", "pero"},
    "en": {"the", "and", "you", "to", "of", "is", "it", "that", "in", "this", "for", "on", "with", "i", "be", "are", "so", "was"},
}


def audio_streams(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    return [int(m) for m in re.findall(r"Stream #0:(\d+)(?:\[\w+\])?(?:\(\w+\))?: Audio", err)]


def pick_track(path, dur):
    streams = audio_streams(path)
    if not streams:
        sys.exit(f"✗ {path} no tiene pista de audio")
    probe_to = min(dur, 90.0)
    levels = []
    for idx in streams:
        err = run(["ffmpeg", "-hide_banner", "-nostats", "-t", f"{probe_to:.1f}", "-i", str(path),
                   "-map", f"0:{idx}", "-af", "volumedetect", "-f", "null", "-"])
        m = re.search(r"mean_volume: (-?[\d.]+) dB", err)
        levels.append((float(m.group(1)) if m else -91.0, idx))
    levels.sort(reverse=True)
    if len(levels) > 1:
        print("   pistas de audio: " + ", ".join(f"#{i} {db:.1f} dB" for db, i in levels) + f" → uso #{levels[0][1]}")
    if levels[0][0] < SILENT_DB:
        print(f"⚠️  la pista más fuerte está a {levels[0][0]:.1f} dB: casi silencio. ¿Es el archivo correcto?")
    return levels[0][1]


def cut_points(wav, dur):
    """Chunk boundaries at the middle of silences near every CHUNK seconds."""
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav),
               "-af", "silencedetect=noise=-35dB:d=0.25", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    mids = [(a + b) / 2 for a, b in zip(starts, ends)]
    cuts, t = [0.0], CHUNK
    while t < dur - CHUNK * 0.35:
        near = [m for m in mids if abs(m - t) <= SEARCH and m > cuts[-1] + 5]
        c = min(near, key=lambda m: abs(m - t)) if near else t
        cuts.append(c)
        t = c + CHUNK
    cuts.append(dur)
    return list(zip(cuts, cuts[1:]))


def call_groq(mp3, lang, prompt, temperature):
    args = ["curl", "-sS", API, "-H", f"Authorization: Bearer {KEY}",
            "-F", f"file=@{mp3}", "-F", "model=whisper-large-v3", "-F", f"language={lang}",
            "-F", "response_format=verbose_json", "-F", "timestamp_granularities[]=word",
            "-F", f"temperature={temperature}"]
    if prompt:
        args += ["-F", f"prompt={prompt}"]
    # curl, not Python urllib — urllib comes back 403 (guide §8.4)
    out = subprocess.run(args, capture_output=True, text=True).stdout
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        sys.exit(f"✗ respuesta inesperada de Groq: {out[:400]}")
    if "error" in data:
        sys.exit(f"✗ Groq: {data['error'].get('message', data['error'])}")
    return data.get("words", [])


def repeats(words):
    """Whisper's hallucination loop: a 1–8 word phrase repeated back to back 3+
    times ("thank you for watching thank you for watching …"), or a chunk with
    almost no vocabulary. Normal speech repeats words, not whole runs."""
    toks = [re.sub(r"\W", "", w["word"].lower()) for w in words]
    toks = [t for t in toks if t]
    if len(toks) >= 12 and len(set(toks)) / len(toks) < 0.35:
        return True
    for n in range(1, 9):
        times = 4 if n == 1 else 3  # "no no no" is emphasis, not a loop
        for i in range(len(toks) - times * n + 1):
            g = toks[i:i + n]
            if all(toks[i + k * n:i + (k + 1) * n] == g for k in range(1, times)):
                return True
    return False


def looks_like(words, lang):
    toks = [re.sub(r"\W", "", w["text"].lower()) for w in words]
    other = "en" if lang == "es" else "es"
    hit = sum(t in STOP.get(lang, set()) for t in toks)
    miss = sum(t in STOP.get(other, set()) for t in toks)
    return hit >= miss


def script_prompt(reel):
    """First ~600 characters of SCRIPT.md below the '---' line, as a spelling/vocabulary hint."""
    p = ROOT / "src/reels" / reel / "SCRIPT.md"
    if not p.exists():
        return ""
    body = p.read_text().split("\n---\n", 1)[-1]
    body = re.sub(r"^\s*[#>*(].*$", "", body, flags=re.M)
    body = " ".join(body.split())
    return body[:600]


def main():
    global KEY
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    if not argv:
        sys.exit(__doc__)
    lang = "es"
    for i, a in enumerate(sys.argv):
        if a == "--lang" and i + 1 < len(sys.argv):
            lang = sys.argv[i + 1]
            argv = [x for x in argv if x != lang]
    force = "--force" in flags
    reel = argv[0]
    rel = argv[1] if len(argv) > 1 else "video.mp4"
    src = ROOT / "public" / reel / rel
    if not src.exists():
        sys.exit(f"✗ no existe {src.relative_to(ROOT)}")
    import os
    KEY = os.environ.get("GROQ_API_KEY", "")
    if not KEY:
        sys.exit("✗ falta GROQ_API_KEY — añádela a ~/.zshrc (console.groq.com) y abre una terminal nueva")
    if not shutil.which("ffmpeg"):
        sys.exit("✗ falta ffmpeg (brew install ffmpeg)")

    name = "master" if len(argv) == 1 else pathlib.Path(rel).stem
    tx = ROOT / "public" / reel / "tx"
    tx.mkdir(parents=True, exist_ok=True)
    dur = duration(src)
    print(f"→ {src.relative_to(ROOT)}  {dur:.1f} s  idioma: {lang}")

    tmp = pathlib.Path(tempfile.mkdtemp(prefix="tx-"))
    try:
        track = pick_track(src, dur)
        wav = tmp / "a.wav"
        run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-map", f"0:{track}", "-vn",
             "-ac", "1", "-ar", "16000", str(wav)])
        chunks = cut_points(wav, dur)
        hint = script_prompt(reel)
        if not hint:
            print("⚠️  SCRIPT.md vacío: sin guion, nombres y el CTA pueden salir mal (guía §5)")

        words, raw_all, prev_text = [], [], ""
        for n, (a, b) in enumerate(chunks):
            mp3 = tmp / f"c{n:03d}.mp3"
            run(["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", str(wav),
                 "-b:a", "64k", str(mp3)])
            level = mean_volume(mp3)
            if level < SILENT_DB:
                print(f"   trozo {n + 1}/{len(chunks)}  {a:6.1f}–{b:6.1f} s  silencio ({level:.0f} dB), lo salto")
                continue
            prompt = (hint if n == 0 else prev_text[-400:] or hint)
            got = call_groq(mp3, lang, prompt, 0)
            retried = False
            if repeats(got):
                got = call_groq(mp3, lang, hint, 0.2)
                retried = True
            raw_all.append({"start": a, "end": b, "words": got})
            chunk_words = [{"text": w["word"].strip(), "start": round(a + w["start"], 3), "end": round(a + w["end"], 3)}
                           for w in got if w["word"].strip()]
            words += chunk_words
            prev_text = " ".join(w["text"] for w in chunk_words)
            flag = "  ⚠️ se repite, reintentado" if retried else ""
            if retried and repeats(got):
                flag = "  ⚠️ SIGUE REPITIENDO — revisa este tramo a mano"
            print(f"   trozo {n + 1}/{len(chunks)}  {a:6.1f}–{b:6.1f} s  {len(chunk_words):3d} palabras{flag}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    (tx / f"{name}.raw.json").write_text(json.dumps(raw_all, ensure_ascii=False, indent=0))
    out = tx / f"{name}.whisper.json"
    out.write_text(json.dumps(words, ensure_ascii=False, indent=0))
    print(f"\n✅ {len(words)} palabras → {out.relative_to(ROOT)}")

    problems = []
    if not words:
        problems.append("no ha salido ninguna palabra")
    else:
        covered = words[-1]["end"] - words[0]["start"]
        if covered < dur * 0.6:
            problems.append(f"las palabras solo cubren {words[0]['start']:.1f}–{words[-1]['end']:.1f} s de {dur:.1f} s")
        if not looks_like(words, lang):
            problems.append(f"el texto no parece estar en '{lang}'")
    for p in problems:
        print(f"⚠️  {p}")

    sus = [w for w in words if w["end"] - w["start"] > 0.9]
    if sus:
        print(f"⚠️  {len(sus)} palabras > 0.9 s — posibles reinicios ocultos (guía §8.6):")
        for w in sus[:15]:
            print(f"     {w['start']:7.2f}–{w['end']:7.2f}  {w['text']}")
        print(f"   Revísalas:  python3 tools/rms.py {reel} {rel} <segundo>")

    if name != "master":
        return
    wj = tx / "words.json"
    cur = wj.read_text().strip() if wj.exists() else "[]"
    if cur in ("", "[]") or force:
        if cur not in ("", "[]"):
            bak = tx / "words.bak.json"
            bak.write_text(cur)
            print(f"   copia de la versión anterior → {bak.relative_to(ROOT)}")
        if problems and not force:
            print(f"   NO lo copio a words.json por los avisos de arriba. Revisa {out.name} y usa --force si está bien.")
            return
        wj.write_text(out.read_text())
        print(f"   → {wj.relative_to(ROOT)}. CORRÍGELO contra SCRIPT.md antes de renderizar (guía §5).")
    else:
        print(f"   {wj.relative_to(ROOT)} ya tiene una versión: no la piso.\n"
              f"   Compara con {out.name}, o usa --force para reemplazarla (se guarda copia).")


KEY = ""
if __name__ == "__main__":
    main()
