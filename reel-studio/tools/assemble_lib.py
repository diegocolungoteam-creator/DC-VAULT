"""Multi-take assembly engine (guide §8.6, §8.7, §16). Used by public/<reel>/assemble.py.

Per segment: cut with -ss BEFORE -i (a 4K master is never decoded from the
start), drop internal silences, gain-match to a -22 dB mean (80 % of the
difference), 10 ms fades at every join. Raw voice by default; --denoise is opt-in.
"""
import pathlib, shutil, tempfile
from dataclasses import dataclass, field

from fflib import duration, mean_volume, run

TARGET_DB = -22.0
# mono → stereo upmix drops the mean ~3 dB, so aim 3 dB higher before it (guide §16)
PRE_UPMIX = TARGET_DB + 3.0
FADE = 0.010
VF = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p,setsar=1"
DENOISE = "highpass=f=60:poles=1,afftdn=nr=12:nf=-50:nt=w:om=o,acompressor=threshold=-16dB:ratio=1.6"


@dataclass
class Seg:
    clip: str
    start: float
    end: float
    cut: list = field(default_factory=list)  # internal silences [(a, b), ...] to remove
    label: str = ""


def _source(here: pathlib.Path, clip: str) -> pathlib.Path:
    """Prefer the master in raw/, fall back to raw/proxy/ (card unmounted)."""
    for p in (here / "raw" / clip, here / "raw" / "proxy" / clip):
        if p.exists():
            return p
    raise SystemExit(f"✗ no encuentro {clip} en raw/ ni raw/proxy/")


def _pieces(seg: Seg):
    out, t = [], seg.start
    for a, b in sorted(seg.cut):
        if a > t:
            out.append((t, a))
        t = max(t, b)
    if seg.end > t:
        out.append((t, seg.end))
    return [(a, b) for a, b in out if b - a >= 0.08]


def assemble(here: pathlib.Path, segments, black_after=None, freeze_end=0.0, denoise=False):
    if not segments:
        raise SystemExit("✗ SEGMENTS está vacío — rellena la lista de tomas en assemble.py")
    if not shutil.which("ffmpeg"):
        raise SystemExit("✗ falta ffmpeg (brew install ffmpeg)")
    black_after = black_after or {}
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="assemble-"))
    parts = []
    print(f"{'#':>2}  {'etiqueta':<14} {'clip':<14} {'in':>7} {'out':>7}  {'media':>7}  gain")
    for i, seg in enumerate(segments):
        src = _source(here, seg.clip)
        pre = DENOISE if denoise else None
        mean = mean_volume(src, seg.start, seg.end, af=f"aformat=channel_layouts=mono,{pre}" if pre else "aformat=channel_layouts=mono")
        gain = 0.8 * (PRE_UPMIX - mean)
        print(f"{i:>2}  {seg.label:<14} {seg.clip:<14} {seg.start:7.2f} {seg.end:7.2f}  {mean:6.1f}dB  {gain:+.1f}dB")
        for j, (a, b) in enumerate(_pieces(seg)):
            d = b - a
            af = ["aformat=channel_layouts=mono:sample_rates=48000"]
            if denoise:
                af.append(DENOISE)
            af += [f"volume={gain:.2f}dB", f"afade=t=in:st=0:d={FADE}", f"afade=t=out:st={max(0, d - FADE):.3f}:d={FADE}"]
            out = tmp / f"p{i:03d}_{j:02d}.mov"
            run(["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.3f}", "-i", str(src), "-t", f"{d:.3f}",
                 "-vf", VF, "-af", ",".join(af), "-c:v", "libx264", "-preset", "fast", "-crf", "16",
                 "-g", "30", "-c:a", "pcm_s16le", str(out)])
            parts.append(out)
        if seg.label in black_after:
            out = tmp / f"p{i:03d}_black.mov"
            d = black_after[seg.label]
            run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s=1080x1920:r=30:d={d}",
                 "-f", "lavfi", "-i", "anullsrc=channel_layout=mono:sample_rate=48000", "-t", f"{d}",
                 "-vf", "format=yuv420p,setsar=1", "-c:v", "libx264", "-crf", "16", "-g", "30",
                 "-c:a", "pcm_s16le", str(out)])
            parts.append(out)

    lst = tmp / "list.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts))
    vf = ["null"]
    af = ["aformat=channel_layouts=stereo", "alimiter=limit=0.89"]
    if freeze_end:
        vf = [f"tpad=stop_mode=clone:stop_duration={freeze_end}"]
        af.insert(0, f"apad=pad_dur={freeze_end}")
    dst = here / "video.mp4"
    if dst.exists():
        dst.rename(here / f"video.prev.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
         "-vf", ",".join(vf), "-af", ",".join(af), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
         "-g", "30", "-keyint_min", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", str(dst)])
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n✅ {dst.relative_to(here.parents[1])}  {duration(dst):.2f} s  media {mean_volume(dst):.1f} dB"
          f"{'  (con denoise)' if denoise else ''}")
    print("   Siguiente: transcribe el MASTER →  tools/transcribe.sh", here.name)
