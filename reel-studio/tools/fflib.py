"""Small ffmpeg helpers shared by the tools. Only needs ffmpeg (+ numpy for RMS)."""
import re, shutil, subprocess


def run(args, quiet=True):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"✗ {' '.join(map(str, args))}\n{r.stderr[-2000:]}")
    return r.stderr if quiet else r.stdout


def duration(path):
    if shutil.which("ffprobe"):
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout
        if out.strip():
            return float(out)
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def mean_volume(path, ss=None, to=None, af=None):
    args = ["ffmpeg", "-hide_banner", "-nostats"]
    if ss is not None:
        args += ["-ss", f"{ss:.3f}"]
    if to is not None:
        args += ["-to", f"{to:.3f}"]
    args += ["-i", str(path), "-vn", "-af", (af + "," if af else "") + "volumedetect", "-f", "null", "-"]
    err = run(args)
    m = re.search(r"mean_volume: (-?[\d.]+) dB", err)
    return float(m.group(1)) if m else -91.0


def rms_curve(path, ss, dur, win=0.05, sr=16000):
    """50 ms RMS curve in dB for [ss, ss+dur]. Returns (times, dbs)."""
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{ss:.3f}", "-t", f"{dur:.3f}", "-i", str(path),
                          "-vn", "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    n = int(win * sr)
    k = len(x) // n
    if k == 0:
        return [], []
    blocks = x[: k * n].reshape(k, n)
    db = 20 * np.log10(np.sqrt((blocks ** 2).mean(axis=1)) + 1e-9)
    return [ss + i * win for i in range(k)], db.tolist()


def silences(path, noise=-35, d=0.4):
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-vn",
               "-af", f"silencedetect=noise={noise}dB:d={d}", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    return list(zip(starts, ends + [None] * (len(starts) - len(ends))))
