"""
QuizShield explainer - audio builder.
Trims SAPI narration per scene, computes the master timeline, synthesizes
an ambient music bed + SFX, mixes and exports narration_mix.wav + timings.json.

Choreography constants here MUST match index.html cue offsets.
"""

import json
import wave
from pathlib import Path

import numpy as np

SR = 44100
HERE = Path(__file__).parent
AUDIO = HERE / "audio"

SCENES = [1, 2, 3, 4, 5, 6, 7]

MIN_DUR = {1: 7.0, 2: 7.0, 3: 9.0, 4: 14.0, 5: 13.5, 6: 10.0, 7: 6.8}
TAIL = 1.25
LEAD_IN = 0.55
START0 = 0.5
OUTRO_HOLD = 3.4

CUE_REL = {
    "match": 10.2,
    "token": 13.1,
    "tab": 3.0,
    "focus": 5.2,
    "face": 7.8,
    "armed": 11.8,
    "logo": 0.7,
}

CHORD_STEP = 3.2
CHORDS = [
    [45, 52, 57, 60],
    [41, 48, 53, 57],
    [48, 55, 60, 64],
    [43, 50, 55, 59],
]
PLUCK = [64, 67, 69, 72]
PLUCK_STEP = 1.6


def midi2f(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def read_wav(path):
    with wave.open(str(path), "rb") as w:
        assert w.getsampwidth() == 2, path
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        if w.getnchannels() > 1:
            data = data.reshape(-1, w.getnchannels()).mean(axis=1).astype(np.int16)
        assert w.getframerate() == SR, (path, w.getframerate())
    return data.astype(np.float64) / 32768.0


def trim_speech(x, pad=0.13):
    thr = 0.02
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * SR))
    b = min(len(x), idx[-1] + int(pad * SR))
    return x[a:b]


def synth_pad(notes, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for i, m in enumerate(notes):
        f = midi2f(m)
        vib = 0.30 * np.sin(2 * np.pi * 0.13 * t + i)
        ph = 2 * np.pi * f * t + vib
        gain = [0.50, 0.34, 0.22, 0.16][min(i, 3)]
        out += gain * (
            np.sin(ph)
            + 0.22 * np.sin(2 * ph + 0.7)
            + 0.08 * np.sin(3 * ph + 1.3)
        )
    attack = int(1.05 * SR)
    release = int(1.5 * SR)
    env = np.ones(n)
    env[:attack] = np.linspace(0, 1, attack) ** 1.6
    env[-release:] *= np.linspace(1, 0, release) ** 1.4
    return out * env


def synth_pluck(f, dur=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.exp(-t / 0.30) * np.minimum(t / 0.012, 1.0)
    return (np.sin(2 * np.pi * f * t) + 0.28 * np.sin(4 * np.pi * f * t)) * env


def whoosh(dur=0.55, gain=0.05):
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(n)
    a = 0.06
    lp = np.zeros(n)
    for i in range(1, n):
        lp[i] = lp[i - 1] + a * (noise[i] - lp[i - 1])
    hp = noise - lp
    env = (t / dur) ** 1.5 * np.exp(-3.2 * t / dur)
    sweep = np.sin(2 * np.pi * (np.linspace(320, 90, n)) * t) * env * 0.5
    return (hp * env * 0.8 + sweep) * gain


def blip(gain=0.07):
    dur = 0.38
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 880 * 2 ** (0.7 * t / dur)
    env = np.exp(-t / 0.13)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 1760 * t)) * env * gain


def thump(gain=0.075):
    dur = 0.26
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = np.linspace(112, 84, n)
    env = np.exp(-t / 0.07)
    click = np.random.default_rng(3).standard_normal(n) * np.exp(-t / 0.006) * 0.25
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * t / 2) + click) * env * gain


def armed_tone(gain=0.05):
    dur = 0.8
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 220 * 2 ** (t / dur)
    env = np.minimum(t / 0.12, 1.0) * np.exp(-1.6 * t / dur)
    return (np.sin(2 * np.pi * f * t) + 0.22 * np.sin(4 * np.pi * f * t)) * env * gain


def logo_hit(gain=0.09):
    dur = 2.6
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(t / 0.04, 1.0) * np.exp(-t / 0.9)
    out = np.zeros(n)
    for m, g in [(45, 1.0), (52, 0.7), (57, 0.5), (69, 0.25)]:
        out += g * np.sin(2 * np.pi * midi2f(m) * t)
    return out * env * gain


def add(buf, sig, at):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if i >= len(buf):
        return
    buf[i:j] += sig[: j - i]


def main():
    speech = {}
    for k in SCENES:
        speech[k] = trim_speech(read_wav(AUDIO / f"scene{k}.wav"))
        dur = len(speech[k]) / SR
        print(f"scene{k}: trimmed {dur:6.2f}s")

    starts, durs = {}, {}
    cursor = START0
    for k in SCENES:
        d = max(len(speech[k]) / SR + TAIL, MIN_DUR[k])
        starts[k], durs[k] = cursor, d
        cursor += d
    total = cursor + OUTRO_HOLD
    print(f"total: {total:6.2f}s")
    for k in SCENES:
        print(f"  scene{k}: start={starts[k]:6.2f} dur={durs[k]:5.2f} speechAt={starts[k]+LEAD_IN:6.2f}")

    n = int(total * SR)
    narration = np.zeros(n)
    for k in SCENES:
        add(narration, speech[k], starts[k] + LEAD_IN)
    peak = np.abs(narration).max()
    if peak > 0:
        narration *= 0.82 / peak

    music = np.zeros(n)
    step = int(CHORD_STEP * SR)
    idx = 0
    pos = 0
    while pos < n:
        ch = CHORDS[idx % len(CHORDS)]
        add(music, synth_pad(ch, CHORD_STEP + 1.5), pos / SR)
        idx += 1
        pos += step
    pos = 1.0
    pi_ = 0
    while pos < n / SR:
        add(music, synth_pluck(midi2f(PLUCK[pi_ % len(PLUCK)])), pos)
        pi_ += 1
        pos += PLUCK_STEP
    rng = np.random.default_rng(11)
    noise = rng.standard_normal(n)
    lp = np.zeros(n)
    a = 0.12
    for i in range(1, n):
        lp[i] = lp[i - 1] + a * (noise[i] - lp[i - 1])
    lfo = 0.4 + 0.6 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * np.arange(n) / SR))
    music += lp * lfo * 0.012
    fi = int(1.2 * SR)
    music[:fi] *= np.linspace(0, 1, fi)
    fo = int(3.0 * SR)
    music[-fo:] *= np.linspace(1, 0, fo)
    music *= 0.9

    sfx = np.zeros(n)
    for k in SCENES:
        add(sfx, whoosh(), starts[k])
    add(sfx, blip(), starts[4] + CUE_REL["match"])
    for cue in ("tab", "focus", "face"):
        add(sfx, thump(), starts[5] + CUE_REL[cue])
    add(sfx, armed_tone(), starts[5] + CUE_REL["armed"])
    add(sfx, logo_hit(), starts[7] + CUE_REL["logo"])

    mix = narration + music + sfx
    mix = np.tanh(mix * 1.05) * 0.97
    fade = int(2.2 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    peak = np.abs(mix).max()
    print(f"mix peak: {peak:.3f}")

    out = np.int16(np.clip(mix, -1, 1) * 32767)
    stereo = np.repeat(out[:, None], 2, axis=1)
    with wave.open(str(AUDIO / "narration_mix.wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(stereo.tobytes())

    timings = {
        "total": round(total, 3),
        "scenes": [
            {
                "start": round(starts[k], 3),
                "dur": round(durs[k], 3),
                "speechAt": round(starts[k] + LEAD_IN, 3),
            }
            for k in SCENES
        ],
        "cues": {
            name: round(starts[scene] + rel, 3)
            for scene, name, rel in [
                (4, "match", CUE_REL["match"]),
                (4, "token", CUE_REL["token"]),
                (5, "tab", CUE_REL["tab"]),
                (5, "focus", CUE_REL["focus"]),
                (5, "face", CUE_REL["face"]),
                (5, "armed", CUE_REL["armed"]),
                (7, "logo", CUE_REL["logo"]),
            ]
        },
    }
    (HERE / "timings.json").write_text(json.dumps(timings, indent=2), encoding="utf-8")
    print("wrote narration_mix.wav + timings.json")


if __name__ == "__main__":
    main()
