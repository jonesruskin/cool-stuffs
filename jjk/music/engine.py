"""
Audio engine for the score: a VSCO-2 CE (CC0) orchestral sampler plus synthesised hybrid
elements (808s, trap kit, taiko, distorted guitar, formant choir, risers) and mix utilities.
"""
import os, re, glob, functools
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
VSCO = os.environ.get('VSCO', '/tmp/claude-0/-home-user-cool-stuffs/4448074a-6ace-545e-bae1-102ccc16308b/scratchpad/jjk/src/vsco')
rng = np.random.default_rng(11)
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def midi_of(name):
    """'D#3' -> midi (C4 = 60)."""
    m = re.match(r'([A-G][#b]?)(-?\d)$', name)
    return 12 * (int(m.group(2)) + 1) + NOTE[m.group(1)]


@functools.lru_cache(maxsize=None)
def load_wav(path):
    sr, x = wavfile.read(path)
    if x.dtype == np.int16: x = x.astype(np.float32) / 32768
    elif x.dtype == np.int32: x = x.astype(np.float32) / 2147483648
    elif x.dtype == np.uint8: x = (x.astype(np.float32) - 128) / 128
    else: x = x.astype(np.float32)
    if x.ndim == 1: x = np.stack([x, x], 1)
    x = x[:, :2]
    if sr != SR:
        g = np.gcd(sr, SR)
        x = signal.resample_poly(x, SR // g, sr // g, axis=0).astype(np.float32)
    # trim leading silence
    env = np.abs(x).max(1)
    thr = env.max() * 0.004
    i0 = max(0, int(np.argmax(env > thr)) - 32)
    return x[i0:]


def detect_f0(x):
    """rough autocorrelation pitch of a mono signal (for octave-calibrating sample names)."""
    n = len(x)
    seg = x[min(int(.08 * SR), n // 3): min(int(.08 * SR) + 8192, n)]
    if len(seg) < 2048: return None
    seg = seg - seg.mean()
    ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]
    lo, hi = int(SR / 1500), int(SR / 30)
    if hi >= len(ac): return None
    k = lo + int(np.argmax(ac[lo:hi]))
    return SR / k if ac[k] > 0.3 * ac[0] else None


class Instrument:
    """Multi-sampled instrument. Samples are grouped by midi note and velocity layer; notes are
    played from the nearest sample, re-pitched by resampling."""

    def __init__(self, folder, gain=1.0, calibrate=True, vel_re=r'_v(\d+)', note_re=r'_([A-G]#?-?\d)(?=[_.])'):
        self.name = folder
        self.gain = gain
        files = sorted(glob.glob(os.path.join(VSCO, folder, '*.wav')))
        self.map = {}
        for f in files:
            b = os.path.basename(f)
            mn = re.search(note_re, b)
            if not mn: continue
            m = midi_of(mn.group(1))
            mv = re.search(vel_re, b)
            v = int(mv.group(1)) if mv else 1
            self.map.setdefault(m, []).append((v, f))
        self.offset = 0
        if calibrate and self.map:
            offs = []
            for m in sorted(self.map)[:: max(1, len(self.map) // 5)]:
                v, f = sorted(self.map[m])[-1]
                f0 = detect_f0(load_wav(f).mean(1))
                if f0:
                    det = 69 + 12 * np.log2(f0 / 440)
                    offs.append(round((det - m) / 12) * 12)
            if offs: self.offset = int(np.median(offs))
        self.notes = np.array(sorted(self.map))
        self.rr = {}

    def sample(self, midi, vel):
        m0 = midi - self.offset
        k = self.notes[np.argmin(np.abs(self.notes - m0))]
        layers = sorted(self.map[k])
        vmax = max(v for v, _ in layers)
        want = max(1, round(vel * vmax))
        cand = [f for v, f in layers if v == min((v for v, _ in layers), key=lambda q: abs(q - want))]
        i = self.rr.get(k, 0); self.rr[k] = i + 1
        return load_wav(cand[i % len(cand)]), m0 - k

    def note(self, midi, dur, vel=.8, release=.25, attack=0.0):
        x, semis = self.sample(midi, vel)
        if semis:
            ratio = 2 ** (semis / 12)
            n = int(len(x) / ratio)
            t = np.arange(n) * ratio
            x = np.stack([np.interp(t, np.arange(len(x)), x[:, c]) for c in range(2)], 1)
        L = int((dur + release) * SR)
        if len(x) < L: x = np.pad(x, ((0, L - len(x)), (0, 0)))
        x = x[:L].copy()
        r0 = int(dur * SR); rl = L - r0
        if rl > 0: x[r0:] *= np.linspace(1, 0, rl)[:, None] ** 2
        if attack > 0:
            a = int(attack * SR); x[:a] *= np.linspace(0, 1, a)[:, None]
        return x * self.gain * (.35 + .65 * vel)


# ---------------------------------------------------------------- synth voices
def tt(sec): return np.arange(int(sec * SR)) / SR


def st(x, pan=0.0):
    lg, rg = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2), np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    return np.stack([x * lg, x * rg], 1)


def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * .45), 'low', fs=SR, output='sos'); return signal.sosfilt(sos, x, axis=0)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos'); return signal.sosfilt(sos, x, axis=0)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'); return signal.sosfilt(sos, x, axis=0)


def kick808(note=26, dur=.9, punch=1.0, glide=0):
    t = tt(dur)
    f0 = hz(note)
    f = f0 * (1 + 2.2 * np.exp(-t * 38)) * (2 ** (glide * np.clip(t / dur, 0, 1) / 12))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * (1.6 / dur)) * (1 - np.exp(-t * 900))
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 300) * .25 * punch
    return np.tanh((x + click) * 2.2) * .8


def kick_hard(dur=.45):
    t = tt(dur)
    f = 48 + 170 * np.exp(-t * 30) + 90 * np.exp(-t * 200)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) * (1 - np.exp(-t * 900))
    x += hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 250) * .3
    return np.tanh(x * 2) * .9


def snare(tone=190, bright=1.0, dur=.35):
    t = tt(dur)
    body = np.sin(2 * np.pi * (tone + 80 * np.exp(-t * 40)) * t) * np.exp(-t * 28)
    nz = bp(rng.standard_normal(len(t)), 1800, 10000) * np.exp(-t * 18) * bright
    return np.tanh((body * .6 + nz * .9) * 1.5) * .7


def clap():
    t = tt(.4); n = rng.standard_normal(len(t)); e = np.zeros(len(t))
    for k, off in enumerate([0, .009, .019, .028]):
        i = int(off * SR); e[i:] += np.exp(-t[:len(t) - i] * (160 if k < 3 else 17))
    return bp(n * e, 1000, 6000) * .8


def hat(open_=False, dur=None):
    d = dur or (.45 if open_ else .07); t = tt(d)
    met = sum(np.sign(np.sin(2 * np.pi * f * t + rng.uniform(0, 6))) for f in (3140, 4270, 5190, 6840, 8120)) / 5
    x = hp(rng.standard_normal(len(t)) * .6 + met * .5, 7500, 4)
    return x * np.exp(-t * (7 if open_ else 75)) * .45


def taiko(note=36, dur=1.4, hard=1.0):
    t = tt(dur)
    f = hz(note) * (1 + .6 * np.exp(-t * 25))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    skin = lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 22) * .9 * hard
    slap = hp(rng.standard_normal(len(t)), 1500) * np.exp(-t * 90) * .3 * hard
    return np.tanh((body + skin + slap) * 1.6) * .8


def rim():
    t = tt(.08); return hp(np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 90) + rng.standard_normal(len(t)) * np.exp(-t * 200) * .3, 400) * .5


def sub_bass(note, dur, glide_to=None):
    t = tt(dur); f0 = hz(note)
    f = np.full(len(t), f0) if glide_to is None else f0 * (2 ** ((glide_to - note) / 12)) ** np.clip((t - dur * .6) / (dur * .4), 0, 1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + .25 * np.sin(2 * ph)
    e = (1 - np.exp(-t * 400)) * np.clip((dur - t) / .03, 0, 1)
    return np.tanh(x * e * 1.4) * .7


def saw(f, sec, os_=4):
    n = int(sec * SR * os_)
    fr = np.full(n, f) if np.isscalar(f) else f
    ph = (rng.uniform() + np.cumsum(fr) / (SR * os_)) % 1
    return signal.resample_poly(2 * ph - 1, 1, os_)[:int(sec * SR)]


def guitar_chord(notes, dur, mute=False):
    """distorted power-chord: detuned saws through drive + cabinet EQ (stereo double-tracked)."""
    out = []
    for side in (-1, 1):
        x = np.zeros(int(dur * SR))
        for m in notes:
            for d in (-.06, .06):
                x += saw(hz(m) * 2 ** ((d + side * .04) / 12), dur)
        t = tt(dur)
        env = (1 - np.exp(-t * 300)) * (np.exp(-t * (14 if mute else 1.2)))
        x = np.tanh(x * env * 4.5)
        x = bp(x, 90, 4200); x = x + .5 * bp(x, 900, 2400)
        out.append(x * .35)
    return np.stack(out, 1)


def choir(notes, dur, vowel='a', attack=.6, bright=1.0):
    """formant 'ah' choir: ensemble of slightly detuned glottal-ish pulses through vowel formants."""
    F = {'a': [(800, 80), (1150, 90), (2900, 120)], 'o': [(450, 70), (800, 80), (2830, 100)], 'u': [(325, 50), (700, 60), (2530, 100)]}[vowel]
    t = tt(dur)
    out = np.zeros((len(t), 2))
    for m in notes:
        for v in range(6):
            det = (v - 2.5) * .08 + rng.normal(0, .02)
            vib = 1 + .006 * np.sin(2 * np.pi * (4.8 + v * .3) * t + v)
            f = hz(m) * 2 ** (det / 12) * vib
            ph = np.cumsum(f) / SR % 1
            src = (ph < .3).astype(float) * np.sin(np.pi * ph / .3) ** 2  # glottal pulse
            src = src - src.mean()
            y = np.zeros(len(t))
            for i, (fc, bw) in enumerate(F):
                y += bp(src, fc - bw, fc + bw) * (1.0, .6, .25 * bright)[i]
            pan = (v - 2.5) / 3
            out += st(y, pan)
    env = np.minimum(1, t / attack) * np.clip((dur - t) / min(.8, dur * .3), 0, 1)
    out *= env[:, None]
    return out / (len(notes) * 6) * 9


def riser(dur, lo=200, hi=9000):
    t = tt(dur); p = (t / dur) ** 2.3
    n = rng.standard_normal(len(t))
    y = np.zeros(len(t)); blk = 512; zi = np.zeros((1, 2))
    for i in range(0, len(t), blk):
        fc = lo * (hi / lo) ** p[min(i, len(p) - 1)]
        sos = signal.butter(2, min(fc, SR * .45), 'low', fs=SR, output='sos')
        y[i:i + blk], zi = signal.sosfilt(sos, n[i:i + blk], zi=zi)
    y += saw(np.repeat(80 * 2 ** (p * 4), 4), dur)[:len(t)] * .15 * p
    return st(y * p ** 1.3 * .6)


def reverse_swell(x):
    return x[::-1] * np.linspace(0, 1, len(x))[:, None] ** 2


def braam(root, dur=2.5):
    """hybrid 'braam': low brass-like stack of saws with a growling filter + distortion."""
    t = tt(dur)
    x = np.zeros(len(t))
    for m, g in ((root, 1), (root + 7, .7), (root + 12, .6), (root - 12, .8)):
        for d in (-.1, 0, .1): x += saw(hz(m) * 2 ** (d / 12), dur) * g
    env = (1 - np.exp(-t * 20)) * np.exp(-t * (1.2 / dur * 2))
    cut = 300 + 2500 * np.exp(-t * 3)
    y = np.zeros(len(t)); zi = np.zeros((1, 2))
    for i in range(0, len(t), 512):
        sos = signal.butter(2, cut[i], 'low', fs=SR, output='sos'); y[i:i + 512], zi = signal.sosfilt(sos, x[i:i + 512], zi=zi)
    y = np.tanh(y * env * 1.8) * .5
    return np.stack([y, np.roll(y, 240)], 1)


def noise_burst(dur, lo, hi, decay):
    t = tt(dur); return bp(rng.standard_normal(len(t)), lo, hi) * np.exp(-t * decay)


# ---------------------------------------------------------------- mix bus
class Bus:
    def __init__(self, seconds):
        self.n = int(seconds * SR); self.x = np.zeros((self.n, 2), np.float32)

    def add(self, sig, t, gain=1.0, pan=0.0):
        if sig.ndim == 1: sig = st(sig, pan)
        elif pan: sig = sig * np.array([1 - max(0, pan), 1 + min(0, pan)])
        i = int(round(t * SR))
        if i >= self.n: return
        if i < 0: sig = sig[-i:]; i = 0
        m = min(len(sig), self.n - i)
        self.x[i:i + m] += (sig[:m] * gain).astype(np.float32)


def hall_ir(rt=2.8, pre=.02, dark=4000):
    n = int(rt * SR); t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        nz = rng.standard_normal(n)
        ir[:, c] = (lp(nz, 9000) * np.exp(-t * 3) + lp(nz, dark) * (1 - np.exp(-t * 3))) * np.exp(-6.9 * t / rt)
    ir = np.pad(ir, ((int(pre * SR), 0), (0, 0)))[:n]
    return ir / np.sqrt((ir ** 2).sum() / 2)


def convolve(x, ir):
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)


def sidechain(x, hits, depth=.6, rel=.18):
    n = len(x); g = np.ones(n)
    for h in hits:
        i = int(h * SR)
        if i >= n: continue
        seg = np.arange(n - i) / SR
        g[i:] = np.minimum(g[i:], 1 - depth * np.exp(-seg / rel) * (1 - np.exp(-seg / .005)))
    return x * g[:, None]
