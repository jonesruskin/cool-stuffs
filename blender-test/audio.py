"""
Sound for the Blender test, built from the animation itself:
  · rain bed, puddle plinks and awning drips
  · wet footsteps on the soldier's real foot plants (measured from the mocap)
  · the dancer's headphones: a samba groove at the tempo of her hip bob (measured from the mocap),
    heard as a tinny leak until the camera circles close and we fall into her music.
usage: python3 audio.py motion.json out.wav
motion.json: per-frame hip height of the dancer (made by motion.py)
"""
import sys, os, json
import numpy as np
from scipy import signal
from scipy.io import wavfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'jjk', 'music'))
from engine import SR, tt, st, lp, hp, bp, hz, Bus, hall_ir, convolve

FPS, DUR, CUT = 24, 10.0, 108 / 24
rng = np.random.default_rng(5)
mot = json.load(open(sys.argv[1]))

# ---------------------------------------------------------------- tempo + downbeat from the dance
hipz = np.array(mot['hipz']); z = hipz - hipz.mean()
F = np.abs(np.fft.rfft(z * np.hanning(len(z)), 1 << 14)); fr = np.fft.rfftfreq(1 << 14, 1 / FPS)
band = (fr > .8) & (fr < 5); BEAT = 1 / fr[np.argmax(F * band)]          # seconds per beat
lows = [f for f in range(110, 239) if z[f] < z[f - 1] and z[f] <= z[f + 1]]
PH = (lows[0] / FPS) % BEAT                                               # a hip drop lands on a beat
print(f'tempo {60 / BEAT:.1f} bpm, phase {PH:.3f}s')

# ---------------------------------------------------------------- instruments
def pluck(f, dur, bright=.5, damp=.996):
    """Karplus-Strong string"""
    n = int(dur * SR); p = max(2, int(SR / f)); buf = rng.uniform(-1, 1, p)
    buf = lp(buf, 2000 + 6000 * bright)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = damp * .5 * (buf[i % p] + buf[(i + 1) % p])
    return out

def surdo(hard=1.0, muted=False):
    t = tt(.9); f = 62 * (1 + .5 * np.exp(-t * 30))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (14 if muted else 4.5))
    x += lp(rng.standard_normal(len(t)), 500) * np.exp(-t * 40) * .4 * hard
    return np.tanh(x * 1.5 * hard) * .8

def tamborim(acc=1.0):
    t = tt(.09); x = np.sin(2 * np.pi * 980 * t) * np.exp(-t * 70) + hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 150) * .6
    return x * .35 * acc

def ganza(acc=1.0):
    t = tt(.11); e = np.exp(-((t - .025) / .02) ** 2)
    return bp(rng.standard_normal(len(t)), 4000, 11000) * e * .22 * acc

def agogo(high=True):
    t = tt(.5); f = 1180 if high else 885
    x = sum(np.sin(2 * np.pi * f * k * t) * a for k, a in ((1, 1), (2.76, .4), (5.4, .15))) * np.exp(-t * 9)
    return x * .16

def apito():
    t = tt(.32); trill = 1 + .5 * (np.sin(2 * np.pi * 32 * t) > 0)
    f = 2900 + 60 * np.sin(2 * np.pi * 32 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * .7 + bp(rng.standard_normal(len(t)), 2500, 4000) * .3
    return x * trill * np.clip(t / .01, 0, 1) * np.clip((.32 - t) / .04, 0, 1) * .16

def chord(notes, dur, strum=.012):
    out = np.zeros(int(dur * SR))
    for k, m in enumerate(notes):
        s = pluck(hz(m), dur - k * strum, bright=.7, damp=.9985); i = int(k * strum * SR); out[i:i + len(s)] += s
    return out * .2

# ---------------------------------------------------------------- the groove (full range, dry)
music = Bus(DUR + 1)
PROG = [(50, [62, 66, 69, 71, 76]), (47, [63, 66, 69, 71]), (52, [62, 67, 71, 74]), (45, [61, 64, 67, 71])]   # D6/9 B7 Em7 A7
b0 = PH - BEAT * np.ceil(PH / BEAT)
n = 0; t = b0
while t < DUR:
    bar = n // 2; beat2 = n % 2 == 1
    root, notes = PROG[bar % 4]
    if t >= 0 or t + BEAT > 0:
        music.add(surdo(1.0 if beat2 else .55, muted=not beat2), t, .9)
        for s in range(4):                                       # 16ths
            ts = t + s * BEAT / 4
            music.add(ganza(1.0 if s == 0 else (.7 if s == 2 else .45)), ts, 1, pan=.35)
            if (n * 4 + s) % 16 in (0, 3, 6, 10, 12, 14):          # partido-alto-ish tamborim
                music.add(tamborim(1 if s == 0 else .7), ts + .004, 1, pan=-.3)
        if n % 2 == 0:
            music.add(agogo(True), t, 1, pan=.5); music.add(agogo(False), t + BEAT * .75, 1, pan=.5)
            music.add(st(chord(notes, BEAT * 1.6)), t + BEAT * .5, 1.0)       # cavaco on the off
            music.add(st(pluck(hz(root - 12), BEAT * 1.9, .3, .997) * .5), t, 1.0)
        else:
            music.add(st(chord(notes, BEAT * .6)), t + BEAT * .25, .7)
            music.add(st(pluck(hz(root - 12 + 7), BEAT * .9, .3, .997) * .45), t + BEAT * .5, 1.0)
    t += BEAT; n += 1
WHISTLE = PH + BEAT * np.floor((8.9 - PH) / BEAT)
music.add(st(apito()), WHISTLE - .02, 1.0)
gm = music.x.astype(np.float64)

# ---------------------------------------------------------------- headphone leak → we fall into her music
N = int((DUR + 1) * SR); T = np.arange(N) / SR
leak = np.tanh(bp(gm, 750, 4200, 3) * 3.0) * 1.0
leak = leak + np.roll(leak, int(.0007 * SR)) * .4                        # cheap plastic-cup comb
full = gm + convolve(gm, hall_ir(1.6, .015, 6000)) * .22
# camera–dancer distance: ~8 m → 3.5 m in shot 1 (behind the lens), ~4 m in shot 2
dist = np.where(T < CUT, 8.4 - (8.4 - 3.5) * T / CUT, 4.3 - .5 * np.clip((T - CUT) / (DUR - CUT), 0, 1))
leak_g = np.clip(1.6 / dist, 0, 1) ** 1.3 * np.where(T < CUT, .35, 1.0)
fall = np.clip((T - 7.2) / 1.6, 0, 1); fall = fall * fall * (3 - 2 * fall)  # the bloom
mus = leak * (leak_g * (1 - fall))[:, None] + full * (fall * .6)[:, None]

# ---------------------------------------------------------------- rain
def pinkish(n):
    w = rng.standard_normal(n); b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w)
bed = np.stack([pinkish(N), pinkish(N)], 1)
bed = hp(bed, 300) * .9 + bp(np.stack([rng.standard_normal(N), rng.standard_normal(N)], 1), 3000, 12000) * .09
bed = bed / np.abs(bed).max() * .32
rain = Bus(DUR + 1)
for _ in range(int(DUR * 900)):                                           # individual drops on hard surfaces
    tt0 = rng.uniform(0, DUR + 1); d = tt(.012)
    rain.add(hp(rng.standard_normal(len(d)), 2500) * np.exp(-d * 500) * rng.uniform(.01, .06), tt0, pan=rng.uniform(-1, 1))
for _ in range(int(DUR * 22)):                                            # puddle plinks
    tt0 = rng.uniform(0, DUR + 1); d = tt(.09); f = rng.uniform(1300, 3800)
    fsw = f * (1 + .35 * d / .09)
    rain.add(np.sin(2 * np.pi * np.cumsum(fsw) / SR) * np.exp(-d * 55) * rng.uniform(.015, .05), tt0, pan=rng.uniform(-.8, .8))
for k in range(int(DUR * 2.2)):                                           # awning drips, close
    tt0 = rng.uniform(0, DUR); d = tt(.18)
    rain.add(np.sin(2 * np.pi * rng.uniform(600, 1100) * d * (1 + 2 * d)) * np.exp(-d * 30) * .07
             + lp(rng.standard_normal(len(d)), 1500) * np.exp(-d * 60) * .05, tt0, pan=rng.choice([-.7, .7]))
thunder = lp(pinkish(int(4.5 * SR)), 140, 4); te = np.arange(len(thunder)) / SR
thunder *= (np.clip(te / .9, 0, 1) * np.exp(-te * .8) * (1 + .6 * np.sin(2 * np.pi * .9 * te) ** 2)) / np.abs(thunder).max() * .55
amb = bed + rain.x
amb[:len(thunder)] += st(thunder, -.2)[:N]
hum = st(np.sin(2 * np.pi * 120 * T) * .006 + np.sin(2 * np.pi * 240 * T) * .003)   # neon transformer hum
amb += hum * (T > CUT)[:, None]

# ---------------------------------------------------------------- footsteps on the measured plants
def step(gain, pan):
    d = tt(.32)
    thud = np.sin(2 * np.pi * (75 + 40 * np.exp(-d * 40)) * d) * np.exp(-d * 30) * .5
    splash = bp(rng.standard_normal(len(d)), 900, 7000) * (np.exp(-d * 22) * (1 - np.exp(-d * 400))) * .35
    gurgle = np.sin(2 * np.pi * rng.uniform(700, 1100) * d * (1 + 3 * d)) * np.exp(-d * 35) * .06
    return st(thud + splash + gurgle, pan) * gain
steps = Bus(DUR + 1)
period = 24.6
for k in range(12):
    for off in (2, 14.3):
        f = off + k * period
        if f > 240: continue
        if f < 109: g, p = 1.0 * (.75 + .25 * f / 108), -.25
        else:       g, p = .28, -.45
        steps.add(step(g * rng.uniform(.85, 1.1), p), (f - 1) / FPS + rng.uniform(-.008, .008))

# ---------------------------------------------------------------- mix
mix = amb * .9 + steps.x * .8 + mus * .85
# small level duck of the rain under the bloom, and a breath at the cut
mix -= (amb * .35 * fall[:, None])
mix = mix[:int(DUR * SR)]
fade = np.clip((DUR - np.arange(len(mix)) / SR) / .35, 0, 1); mix *= fade[:, None]
fin = np.clip(np.arange(len(mix)) / SR / .25, 0, 1); mix *= fin[:, None]
mix /= max(1e-9, np.abs(mix).max()) / .89
wavfile.write(sys.argv[2], SR, (mix * 32767).astype(np.int16))
print('wrote', sys.argv[2])
