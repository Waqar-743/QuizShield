"""Measure video offset by locating the progress-bar edge (x = t/total * 1920)
in the bottom 3px strip, sampled across the whole video, then fit a line."""

import json
import subprocess
import sys

import numpy as np

ff = subprocess.run(
    [sys.executable, "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
    capture_output=True, text=True, check=True,
).stdout.strip()

W, H = 1920, 1080
STRIP_Y0, STRIP_Y1 = 1076, 1080
THRESH = 80


def edge_x(video, t):
    p = subprocess.run(
        [ff, "-hide_banner", "-loglevel", "error", "-ss", f"{t}", "-i", video,
         "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
        capture_output=True, check=True,
    )
    a = np.frombuffer(p.stdout, dtype=np.uint8)
    if a.size != W * H:
        return None
    strip = a.reshape(H, W)[STRIP_Y0:STRIP_Y1, :].max(axis=0)
    xs = np.where(strip > THRESH)[0]
    return int(xs[-1]) if len(xs) else 0


if __name__ == "__main__":
    video = sys.argv[1]
    total = json.load(open("timings.json", encoding="utf-8"))["total"]
    vs, es = [], []
    for v in np.arange(4.0, total - 1.5, 3.5):
        x = edge_x(video, float(v))
        if x is None:
            continue
        vs.append(float(v))
        es.append(x)
        print(f"V={v:6.2f}  edge_x={x:5d}  t_est={x / W * total:6.2f}  L={v - x / W * total:6.3f}")
    vs = np.array(vs)
    ts_est = np.array(es) / W * total
    A = np.vstack([vs, np.ones_like(vs)]).T
    slope, intercept = np.linalg.lstsq(A, ts_est, rcond=None)[0]
    L = -intercept / slope
    pred = slope * vs + intercept
    resid = ts_est - pred
    print(f"\nfit: t_video = {slope:.5f}*V + {intercept:.3f}")
    print(f"lead at V=0: {L:.3f}s  |  drift over video: {(slope - 1) * total:.3f}s")
    print(f"residuals: max {np.abs(resid).max():.3f}s  std {resid.std():.3f}s")
