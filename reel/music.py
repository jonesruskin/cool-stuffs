"""
Soundtrack for the Claude motion reel, synthesized entirely from code.

128 BPM, 8 bars of 4/4 = 32 beats = exactly 15.000 s.
Every hit is placed on the same beat grid the visuals use (see reel.js).

    python3 music.py            -> writes assets/music.wav (48 kHz / 32-bit stereo) + assets/waveform.js
"""
import os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
BPM = 128
B = 60.0 / BPM              # one beat in seconds (0.46875)
DUR = 15.0
N = int(SR * (DUR + 3.0))   # generous tail buffer, trimmed at the end
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)
bus = {}                    # named stems for sidechain / effects


def stem(name):
    if name not in bus:
        bus[name] = np.zeros((2, N))
    return bus[name]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def at(beat):
    return int(round(beat * B * SR))


def place(name, x, beat, gain=1.0, pan=0.0):
    """Add mono or stereo signal x into stem `name` at a beat position."""
    s = stem(name)
    i = at(beat)
    if x.ndim == 1:
        lg = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
        rg = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        x = np.vstack([x * lg, x * rg])
    n = min(x.shape[1], N - i)
    s[:, i:i + n] += x[:, :n] * gain


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def sweep_lp(x, cutoff, block=128):
    """Time-varying low-pass; cutoff is an array (Hz) the same length as x."""
    y = np.zeros_like(x)
    zi = np.zeros((1, 2))
    for i in range(0, len(x), block):
        fc = float(np.clip(cutoff[min(i, len(cutoff) - 1)], 30, SR * 0.45))
        sos = signal.butter(2, fc, 'low', fs=SR, output='sos')
        y[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return y


def saw_os(freq, sec, phase=0.0, os=4):
    """Band-limited-ish saw via 4x oversampling + decimation. freq may be array (per oversampled sample)."""
    n = int(sec * SR * os)
    f = np.full(n, freq) if np.isscalar(freq) else freq
    ph = (phase + np.cumsum(f) / (SR * os)) % 1.0
    x = 2 * ph - 1
    return signal.resample_poly(x, 1, os)[: int(sec * SR)]


def env_adsr(n, a, d, s, r, sustain_len):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, int(sustain_len * SR) - a_n - d_n)
    e = np.concatenate([
        np.linspace(0, 1, max(a_n, 1)) ** 1.5,
        1 - (1 - s) * (1 - np.exp(-np.linspace(0, 5, max(d_n, 1)))),
        np.full(s_n, s),
        s * np.exp(-np.linspace(0, 6, max(r_n, 1))),
    ])
    out = np.zeros(n)
    m = min(n, len(e))
    out[:m] = e[:m]
    return out


# ----------------------------------------------------------------- instruments

def kick(punch=1.0, length=0.55):
    t = tt(length)
    f = 50 + 150 * np.exp(-t * 28) + 60 * np.exp(-t * 180)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 9.5) * (1 - np.exp(-t * 900))
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 260) * 0.35
    x = np.tanh((body + click) * 1.6 * punch) / np.tanh(1.6)
    return x


def boom(length=2.6):
    t = tt(length)
    f = 30 + 70 * np.exp(-t * 6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(np.sin(ph) * np.exp(-t * 1.6) * 1.8) * 0.9


def clap():
    t = tt(0.45)
    n = rng.standard_normal(len(t))
    e = np.zeros(len(t))
    for k, off in enumerate([0.0, 0.011, 0.022, 0.031]):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: len(t) - i]) * (140 if k < 3 else 16))
    return bp(n * e, 900, 5200) * 0.9


def snare(bright=1.0):
    t = tt(0.3)
    tone = np.sin(2 * np.pi * (180 + 60 * np.exp(-t * 40)) * t) * np.exp(-t * 30)
    nz = bp(rng.standard_normal(len(t)), 1500, 9000) * np.exp(-t * 22) * bright
    return (tone * 0.6 + nz * 0.8)


def hat(open_=False):
    t = tt(0.5 if open_ else 0.09)
    n = rng.standard_normal(len(t))
    # metallic flavour: a few square partials
    met = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (3140, 4270, 5190, 6840)) / 4
    x = hp(n * 0.7 + met * 0.4, 7200, 4)
    return x * np.exp(-t * (9 if open_ else 70)) * 0.5


def crash(length=3.0):
    t = tt(length)
    n = rng.standard_normal(len(t))
    met = sum(np.sign(np.sin(2 * np.pi * f * t + rng.uniform(0, 6))) for f in (2230, 3350, 4780, 6120, 8110, 9870)) / 6
    x = hp(n * 0.8 + met * 0.5, 4500, 2)
    return x * np.exp(-t * 1.5) * (1 - np.exp(-t * 400)) * 0.45


def pluck(m, length=0.9, bright=1.0, decay=5.0):
    """Additive saw where upper partials die faster -> natural pluck."""
    t = tt(length)
    f0 = hz(m)
    x = np.zeros(len(t))
    h = 1
    while h * f0 < 15000 and h < 60:
        a = (1.0 / h) * np.exp(-t * (decay + 2.2 * h / bright))
        x += a * np.sin(2 * np.pi * f0 * h * t + (h * 0.7))
        h += 1
    x *= (1 - np.exp(-t * 2000))
    return x * 0.6


def supersaw(notes, length, detune=0.18, voices=7, cutoff=None):
    """Stereo supersaw chord. Returns (2, n)."""
    n = int(length * SR)
    out = np.zeros((2, n))
    for m in notes:
        f0 = hz(m)
        for v in range(voices):
            d = (v - (voices - 1) / 2) / ((voices - 1) / 2)          # -1..1
            f = f0 * 2 ** (d * detune / 12)
            x = saw_os(f, length, phase=rng.uniform())[:n]
            g = 1.0 if v == voices // 2 else 0.7
            pan = d * 0.9
            out[0] += x * g * np.cos((pan + 1) * np.pi / 4)
            out[1] += x * g * np.sin((pan + 1) * np.pi / 4)
    out /= (len(notes) * voices * 0.5)
    if cutoff is not None:
        c = np.full(n, cutoff) if np.isscalar(cutoff) else cutoff[:n]
        out = np.vstack([sweep_lp(out[0], c), sweep_lp(out[1], c)])
    return out


def bass(m, length):
    t = tt(length)
    f = hz(m)
    saw = saw_os(f, length)[: len(t)]
    cut = 180 + 1600 * np.exp(-t * 18)
    x = sweep_lp(saw, cut) * 0.9 + np.sin(2 * np.pi * f / 2 * t) * 0.45
    e = (1 - np.exp(-t * 600)) * np.exp(-t * 3.0)
    tail = np.clip((length - t) / 0.02, 0, 1)
    return np.tanh(x * e * tail * 1.4)


def bell(m, length=3.0):
    t = tt(length)
    f = hz(m)
    idx = 3.2 * np.exp(-t * 3)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t))
    x += 0.35 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 4)
    return x * np.exp(-t * 1.3) * (1 - np.exp(-t * 3000)) * 0.35


def boing(m, strength=1.0):
    """Cartoon bounce: pitch pops up then settles."""
    t = tt(0.35)
    f = hz(m) * (1 + 0.9 * np.exp(-t * 35))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.25 * np.sin(2 * ph)
    return x * np.exp(-t * 11) * (1 - np.exp(-t * 1500)) * 0.55 * strength


def thock(m):
    """Woodblock-ish hit for tiles landing."""
    t = tt(0.25)
    f = hz(m) * (1 + 0.6 * np.exp(-t * 90))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 35)
    x += bp(rng.standard_normal(len(t)), 1800, 6000) * np.exp(-t * 180) * 0.4
    return x * 0.6


def riser(length, f_lo=300, f_hi=9000, curve=2.5):
    t = tt(length)
    p = (t / length) ** curve
    n = rng.standard_normal(len(t))
    cut = f_lo * (f_hi / f_lo) ** p
    x = sweep_lp(n, cut) * p ** 1.2
    # pitched component
    f = 110 * 2 ** (p * 3)
    x += saw_os(np.repeat(f, 4), length)[: len(t)] * 0.12 * p
    return x * 0.5


def whoosh(length=0.6, reverse=False):
    t = tt(length)
    n = rng.standard_normal(len(t))
    p = t / length
    cut = 400 + 7000 * np.sin(np.pi * p) ** 2
    x = sweep_lp(n, cut) * np.sin(np.pi * p) ** 2
    return (x[::-1] if reverse else x) * 0.6


# ---------------------------------------------------------------- arrangement

# -- Bar 1 (beats 0-4): IGNITION. Dot pulses on every beat.
pad1 = supersaw([53, 57, 60, 64, 67], 4 * B + 0.8, detune=0.12,
                cutoff=np.linspace(300, 2200, int((4 * B + 0.8) * SR)) ** 1.0)
pad1 *= np.linspace(0, 1, pad1.shape[1]) ** 1.5
place('pad', pad1, 0, 0.35)
for i, m in enumerate([69, 72, 76, 79]):
    place('pluck', pluck(m, 1.2, bright=0.8), i, 0.55, pan=[-0.3, 0.3, -0.15, 0.15][i])
    place('drums', kick(0.45, 0.35), i, 0.35)               # soft heartbeat under the dot
place('fx', riser(2 * B, 200, 7000), 2, 0.55)
place('fx', whoosh(0.5), 3.4, 0.5)

# -- Bar 2 (beats 4-8): "motion" -> "emotion"
place('drums', kick(), 4, 1.0)
place('drums', crash(2.2), 4, 0.5)
place('stab', supersaw([57, 60, 64, 67, 71], 1.2, cutoff=np.linspace(6000, 900, int(1.2 * SR))) *
      np.exp(-tt(1.2) * 2.5), 4, 0.6)
place('bass', bass(45, 1.6), 4, 0.6)
# letter tumble ticks as "motion" rises in (staggered letters)
for k in range(6):
    place('pluck', thock(84 + [0, 3, 5, 7, 10, 12][k]) * 0.35, 4 + 0.06 + k * 0.09, 0.45, pan=-0.6 + k * 0.24)
# the "e" drops in and bounces (landings must match timeline.js E_BOUNCES)
for k, (bt, s) in enumerate(zip([6.0, 6.5, 6.75, 6.875], [1.0, 0.6, 0.38, 0.22])):
    place('pluck', boing(72 + k * 2, s), bt, 0.9)
    place('drums', kick(0.8 * s + 0.2, 0.4), bt, 0.7 * s)
for k in range(4):
    place('drums', hat(), 6 + k * 0.5 + 0.25, 0.25)
place('pad', supersaw([57, 60, 64, 67, 71], 3 * B, cutoff=1200) * np.linspace(1, 0.6, int(3 * B * SR)), 5, 0.18)
place('drums', snare(0.7), 7.5, 0.3)
place('drums', snare(0.8), 7.75, 0.45)
place('fx', whoosh(0.45, reverse=True), 7.05, 0.6)

# -- Bars 3-4 (beats 8-16): SPECIMEN GRID. One tile (and one note) per beat.
tile_notes = [65, 69, 72, 76, 79, 83, 86, 88]
for i, m in enumerate(tile_notes):
    b = 8 + i
    place('pluck', pluck(m, 1.0, bright=1.2), b, 0.55, pan=[-0.5, 0.5][i % 2] * 0.6)
    place('pluck', thock(m - 12), b, 0.35)
    if b < 15:
        place('drums', kick(), b, 0.9)
    place('drums', hat(), b + 0.5, 0.35)
    place('drums', hat(), b + 0.75, 0.15)
    if i % 2 == 1 and b < 15:
        place('drums', clap(), b, 0.45)
for b, root in [(8, 41), (12, 43)]:
    for k in range(8):
        if b + k * 0.5 >= 15:
            break
        place('bass', bass(root, 0.22), b + k * 0.5 + 0.25, 0.5)
place('pad', supersaw([53, 57, 60, 64], 4 * B, cutoff=1500), 8, 0.2)
place('pad', supersaw([55, 59, 62, 64], 4 * B, cutoff=np.linspace(1500, 5000, int(4 * B * SR))), 12, 0.22)
# build: snare roll 14 -> 16, accelerating
roll = []
b = 14.0
while b < 16.0:
    roll.append(b)
    b += 0.25 if b < 15 else 0.125
for i, b in enumerate(roll):
    place('drums', snare(0.6 + i / len(roll)), b, 0.12 + 0.35 * (i / len(roll)) ** 1.5)
place('fx', riser(2 * B, 300, 12000, 2.0), 14, 0.7)

# -- Bars 5-6 (beats 16-24): THE DROP
place('drums', crash(3.0), 16, 0.7)
place('sub', boom(2.2), 16, 0.75)
chords = [(16, [57, 60, 64, 67, 71], 45), (18, [53, 57, 60, 64, 67], 41),
          (20, [55, 60, 64, 67, 71], 48), (22, [55, 59, 62, 64, 67], 43)]
for b, notes, root in chords:
    ch = supersaw(notes, 2 * B + 0.05, detune=0.22, cutoff=5200)
    place('lead', ch, b, 0.55)
    for k in range(8):                       # rolling 16th bass that leaves room for the kick
        if k % 4 == 0:
            continue
        place('bass', bass(root + (12 if k in (3, 6) else 0), 0.2), b + k * 0.25, 0.6 if k % 2 == 0 else 0.45)
    # 16th arp through chord tones, 1-2 octaves up
    pattern = [0, 2, 4, 1, 3, 4, 2, 4]
    for k in range(8):
        m = notes[pattern[k]] + 12
        place('arp', pluck(m, 0.35, bright=1.6, decay=9), b + k * 0.25, 0.28, pan=np.sin(k * 1.3) * 0.7)
for b in range(16, 24):
    place('drums', kick(1.05), b, 1.0)
    place('drums', hat(open_=True), b + 0.5, 0.22)
    place('drums', hat(), b + 0.25, 0.14)
    place('drums', hat(), b + 0.75, 0.14)
    if b % 2 == 1:
        place('drums', clap(), b, 0.6)
# visual event accents inside the drop
place('fx', whoosh(0.5, reverse=True), 17.45, 0.45)          # particles gather -> CLAUDE (beat 18)
place('fx', crash(1.5), 20, 0.35)                             # explode -> sphere (beat 20)
place('fx', riser(1.5 * B, 800, 9000, 1.6), 22.5, 0.45)       # collapse -> exit (beat 24)

# -- Bar 7 (beats 24-28): CREDITS. One word per beat.
stabs = [(24, [48, 55, 59, 64]), (25, [50, 57, 60, 65]), (26, [52, 59, 62, 67]), (27, [53, 60, 64, 69])]
for b, notes in stabs:
    s = supersaw(notes, 0.9, cutoff=np.linspace(7000, 700, int(0.9 * SR))) * np.exp(-tt(0.9) * 4)
    place('stab', s, b, 0.7)
    place('drums', kick(), b, 0.95)
    place('bass', bass(notes[0] - 12, 0.4), b, 0.6)
    place('drums', hat(), b + 0.5, 0.25)
    if b in (25, 27):
        place('drums', clap(), b, 0.5)
place('drums', crash(1.2), 24, 0.35)
rc = crash(1.0)[::-1] * np.linspace(0, 1, SR) ** 2
place('fx', rc, 28 - 1.0 / B, 0.6)

# -- Bar 8 (beats 28-32): SIGNATURE
place('sub', boom(2.8), 28, 0.9)
place('drums', kick(1.1), 28, 1.0)
final = [41, 48, 57, 64, 67, 71, 76]
fl = int(4 * B * SR + SR)
cut = 900 + 6000 * np.exp(-np.arange(fl) / SR * 1.2)
pad = supersaw(final, fl / SR, detune=0.2, cutoff=cut) * np.exp(-np.arange(fl) / SR * 0.55)
place('pad', pad, 28, 0.55)
place('bass', bass(29, 1.8), 28, 0.55)
place('pluck', bell(81), 30, 0.55, pan=-0.2)
place('pluck', bell(88), 30.25, 0.35, pan=0.25)


# ------------------------------------------------------------------- mixing

n_samples = N
t_all = np.arange(n_samples) / SR

# sidechain envelope from every four-on-the-floor kick
duck = np.ones(n_samples)
kick_beats = list(range(4, 5)) + list(range(8, 15)) + list(range(16, 24)) + list(range(24, 29))
for b in kick_beats:
    i = at(b)
    seg = np.arange(n_samples - i) / SR
    d = 1 - 0.75 * np.exp(-seg / 0.11) * (1 - np.exp(-seg / 0.004))
    duck[i:] = np.minimum(duck[i:], d)


def reverb_ir(rt=2.4, predelay=0.012):
    n = int(rt * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        nz = rng.standard_normal(n)
        # darker as it decays
        bright = lp(nz, 9000)
        dark = lp(nz, 1800)
        mix = np.exp(-t * 2.5)
        ir[c] = (bright * mix + dark * (1 - mix)) * np.exp(-6.9 * t / rt)
    pd = int(predelay * SR)
    ir = np.pad(ir, ((0, 0), (pd, 0)))[:, :n]
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


IR = reverb_ir()


def reverb(x, wet):
    y = np.vstack([signal.fftconvolve(x[0], IR[0])[:n_samples],
                   signal.fftconvolve(x[1], IR[1])[:n_samples]])
    return hp(y, 250) * wet


def delay(x, time, fb=0.35, wet=0.3):
    d = int(time * SR)
    y = np.zeros_like(x)
    tap = x.copy()
    for k in range(1, 6):
        tap = np.roll(tap, d, axis=1)
        tap[:, :d] = 0
        tap = tap[::-1] * fb                  # ping-pong: swap channels each repeat
        y += lp(tap, 5000) if tap.ndim == 1 else np.vstack([lp(tap[0], 5000), lp(tap[1], 5000)])
    return y * wet / fb


def S(name):
    return bus.get(name, np.zeros((2, n_samples)))


mix = np.zeros((2, n_samples))
mix += S('drums') * 0.9
mix += S('sub') * 0.5
mix += S('bass') * duck * 0.75
mix += S('pad') * duck * 1.15
mix += S('lead') * (0.25 + 0.75 * duck) * 1.3
mix += S('stab') * 1.2
mix += S('arp') * (0.4 + 0.6 * duck) * 1.4
mix += S('pluck') * 1.15
mix += S('fx') * 0.8

send = S('pluck') * 0.8 + S('pad') * 0.5 + S('stab') * 0.5 + S('arp') * 0.6 + S('lead') * 0.25 + S('drums') * 0.08
mix += reverb(send, 0.32)
mix += delay(S('pluck') + S('arp') * 0.8, 0.75 * B, fb=0.4, wet=0.22)

# master: low cut, gentle glue saturation, true-peak-ish normalise, fade
mix = np.vstack([hp(mix[0], 28), hp(mix[1], 28)])
mix = mix + 0.25 * np.vstack([hp(mix[0], 3500), hp(mix[1], 3500)])   # air / presence lift
mix = mix[:, : int(DUR * SR)]
peak = np.max(np.abs(mix))
mix = mix / peak * 1.35
mix = np.tanh(mix) / np.tanh(1.35)
fade = np.ones(mix.shape[1])
fo = int(0.6 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 2
fi = int(0.01 * SR)
fade[:fi] = np.linspace(0, 1, fi)
mix *= fade
tp = max(np.max(np.abs(signal.resample_poly(mix[c], 4, 1))) for c in range(2))   # true peak
mix *= 10 ** (-1.0 / 20) / tp

os.makedirs('assets', exist_ok=True)
pcm = np.clip(mix.T, -1, 1)
wavfile.write('assets/music.wav', SR, (pcm * (2 ** 31 - 1)).astype(np.int32))

# waveform envelope for the visuals (credits scene draws the real track)
bins = 600
hop = pcm.shape[0] // bins
env = [float(np.sqrt(np.mean(pcm[i * hop:(i + 1) * hop] ** 2))) for i in range(bins)]
m = max(env)
with open('assets/waveform.js', 'w') as f:
    f.write('window.WAVEFORM=[' + ','.join(f'{v / m:.3f}' for v in env) + '];\n')
print('wrote assets/music.wav', pcm.shape[0] / SR, 's')
