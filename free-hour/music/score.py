"""
The Free Hour — score. One motif (the "free hour"), re-orchestrated by every era's carrier:
bone flute & frame drum → lyre & chorus → lute & drone → clockwork & music-hall piano →
phonograph → chiptune & synth-pop → generative bells → everything together, resolving to D major.
100 BPM (one bar = 2.4 s), timings from ../timeline.json so the music lands on the picture.
    python3 music/score.py  -> public/score.wav
"""
import json, os, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'jjk', 'music'))
from engine import *

ROOT = os.path.dirname(HERE)
TL = json.load(open(os.path.join(ROOT, 'timeline.json')))
BPM = TL['bpm']; BEAT = 60 / BPM; BAR = 4 * BEAT
CH = {}; acc = 0
for c in TL['chapters']:
    CH[c['id']] = acc; acc += c['bars']
DUR = acc * BAR
S = lambda cid, fr=0: CH[cid] * BAR + fr / TL['fps']        # chapter start (+ local frame) in seconds
def b(bar, beat=0.0): return bar * BAR + beat * BEAT
print('duration', DUR)

bus = {k: Bus(DUR + 4) for k in ['str', 'keys', 'wind', 'pluck', 'perc', 'synth', 'choir', 'fx', 'amb']}
def add(k, x, t, g=1.0, pan=0.0): bus[k].add(x, t, g, pan)

I = {k: Instrument(p, g) for k, (p, g) in {
    'vln': ('Strings/Violin Section/susVib', .9), 'vla': ('Strings/Viola Section/susvib', .9), 'vc': ('Strings/Cello Section/susvib', 1.0),
    'cb': ('Strings/Solo Contrabass/SusVib', 1.0), 'vc_trem': ('Strings/Cello Section/trem', .9), 'vln_spic': ('Strings/Violin Section/Spic', .9),
    'fl': ('Woodwinds/Flute/susNV', .9), 'hn': ('Brass/F Horn/sus', .8),
}.items()}
def play(inst, notes, t, dur, vel=.7, k='str', pan=0.0, rel=.6, att=.1, g=1.0):
    for m in (notes if isinstance(notes, (list, tuple)) else [notes]):
        add(k, I[inst].note(m, dur, vel, rel, att), t, g, pan)
PIANO = os.path.join(VSCO, 'Keys/Upright Piano')
def piano(m, dur=1.5, vel=.6):
    idx = max(0, min(21, round((m - 21) / 4))); base = 21 + 4 * idx
    d = 1 if vel < .45 else 2 if vel < .8 else 3
    x = load_wav(os.path.join(PIANO, f'Player_dyn{d}_rr1_{idx * 2:03d}.wav'))
    r = 2 ** ((m - base) / 12)
    if r != 1:
        n = int(len(x) / r); t = np.arange(n) * r; x = np.stack([np.interp(t, np.arange(len(x)), x[:, c]) for c in range(2)], 1)
    L = int((dur + .8) * SR); x = x[:L].copy()
    if len(x) > int(dur * SR): x[int(dur * SR):] *= np.linspace(1, 0, len(x) - int(dur * SR))[:, None]
    return x * (.4 + .6 * vel)
def smp(path): return load_wav(os.path.join(VSCO, path))

# ---------------------------------------------------------------- synth voices
def pluck_fast(m, dur=1.2, bright=.5):                 # vectorised approximation of KS (much faster)
    t = tt(dur); f0 = hz(m)
    y = sum(np.sin(2 * np.pi * f0 * k * t) * np.exp(-t * (2.2 + k * (1.8 - bright))) / k ** 1.1 for k in range(1, 9))
    y += lp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 60) * .3
    return y * (1 - np.exp(-t * 800)) * .35
def square(m, dur, duty=.5, vol=.25):
    t = tt(dur); ph = (hz(m) * t) % 1
    y = np.where(ph < duty, 1.0, -1.0); env = np.clip((dur - t) / .02, 0, 1) * np.clip(t / .003, 0, 1)
    return lp(y * env, 9000) * vol
def triangle(m, dur, vol=.35):
    t = tt(dur); ph = (hz(m) * t) % 1
    return (2 * np.abs(2 * ph - 1) - 1) * np.clip((dur - t) / .02, 0, 1) * vol
def chip_noise(dur, vol=.2):
    n = int(dur * SR); y = np.repeat(rng.choice([-1., 1.], n // 40 + 1), 40)[:n]
    return y * np.exp(-np.arange(n) / SR * 30) * vol
def fm_bell(m, dur=2.5, idx=3.0):
    t = tt(dur); fc = hz(m); fm = fc * 3.5
    y = np.sin(2 * np.pi * fc * t + idx * np.exp(-t * 3) * np.sin(2 * np.pi * fm * t))
    return y * np.exp(-t * 1.6) * (1 - np.exp(-t * 400)) * .3
def pad(notes, dur, bright=1200, vol=.12):
    t = tt(dur); y = np.zeros(len(t))
    for m in notes:
        for d in (-.07, .07): y += saw(hz(m) * 2 ** (d / 12), dur)
    y = lp(y, bright) * np.minimum(1, t / .8) * np.clip((dur - t) / 1.0, 0, 1)
    return np.stack([y, np.roll(y, 480)], 1) * vol / max(1, len(notes))
def frame_drum(hard=.7):
    t = tt(.6); f = 90 + 60 * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + lp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 35) * .5 * hard) * .6
def clap_soft(): return clap() * .6
def crackle(dur, dens=40, vol=.08):
    n = int(dur * SR); y = np.zeros(n)
    idx = rng.integers(0, n, int(dens * dur)); y[idx] = rng.uniform(-1, 1, len(idx))
    return hp(signal.lfilter([1], [1, -.6], y), 1500) * vol + hp(rng.standard_normal(n), 3000) * vol * .08
def crowd(dur, vol=.3):
    t = tt(dur); y = bp(rng.standard_normal(len(t)), 300, 2500) * (np.sin(np.pi * t / dur) ** .7)
    return np.stack([y, np.roll(y, 2000)], 1) * vol
def tick(high=True):
    t = tt(.04); return hp(np.sin(2 * np.pi * (3200 if high else 2400) * t) * np.exp(-t * 180), 800) * .35
def whoosh(dur=.6, lo=300, hi=4000):
    t = tt(dur); p = np.sin(np.pi * t / dur) ** 2
    y = np.zeros(len(t)); zi = np.zeros((1, 2)); n = rng.standard_normal(len(t))
    for i in range(0, len(t), 256):
        sos = signal.butter(2, lo + (hi - lo) * p[i], 'low', fs=SR, output='sos'); y[i:i + 256], zi = signal.sosfilt(sos, n[i:i + 256], zi=zi)
    return y * p * .35
def sub(m, dur, vol=.4):
    t = tt(dur); return np.sin(2 * np.pi * hz(m) * t) * np.minimum(1, t / .05) * np.clip((dur - t) / .3, 0, 1) * vol

# ---------------------------------------------------------------- harmony + motif
CHORD = {'Dm': [50, 57, 62, 65, 69], 'Bb': [46, 53, 58, 62, 65], 'F': [41, 53, 57, 60, 65], 'C': [48, 55, 60, 64, 67], 'Gm': [43, 55, 58, 62, 67], 'A': [45, 57, 61, 64, 69], 'D': [50, 57, 62, 66, 69]}
PROG = ['Dm', 'Bb', 'F', 'C']
MOTIF = [(62, 1), (69, 1), (67, 1), (65, 1), (64, 1.5), (65, .5), (62, 2)]          # 8 beats
def motif(t0, voice, oct=0, gain=1.0, dur_scale=1.0):
    t = t0
    for m, d in MOTIF:
        voice(m + oct, t, d * BEAT * dur_scale, gain); t += d * BEAT
def chord_at(bar): return CHORD[PROG[int(bar) % 4]]

# ================================================================= COMPOSITION
print('composing...')
# 00 open — dark drone, wind, the first ember; a swell into the title
o = S('open')
add('amb', st(lp(rng.standard_normal(int(12 * SR)), 400) * np.linspace(0, 1, int(12 * SR)) ** .5 * .05), o)
play('cb', [38], o + .5, 11, .45, att=3.0, g=.5); play('vc', [50], o + 3, 8.5, .4, att=2.5, g=.35)
add('fx', crackle(12, 18, .05), o + 1)
add('fx', reverse_swell(st(lp(rng.standard_normal(int(2.2 * SR)), 2500) * .35)), S('open', 300) - 2.2, .8)
add('keys', piano(38, 4, .7), S('open', 300)); add('keys', piano(50, 4, .6), S('open', 300)); add('keys', piano(74, 3, .5), S('open', 300) + .6)
add('perc', smp('Percussion/gongHit_p.wav'), S('open', 300), .35)

# 01 axioms — piano motif, a string bed, one chime per constant
a0 = S('axioms')
for k in range(8):
    ch = chord_at(k)
    play('vla', ch[1:3], b(CH['axioms'] + k), BAR, .38, att=.8, g=.4); play('cb', [ch[0] - 12], b(CH['axioms'] + k), BAR, .4, att=.5, g=.4)
motif(b(CH['axioms'] + 2), lambda m, t, d, g: add('keys', piano(m + 12, d * 1.6, .5), t, .9))
motif(b(CH['axioms'] + 6), lambda m, t, d, g: add('keys', piano(m + 12, d * 1.6, .5), t, .9))
for k, m in enumerate([74, 77, 79, 81, 84, 86]):
    t = S('axioms', 250 + k * 34); add('synth', fm_bell(m, 2.5, 2.0), t, .7, (k - 2.5) / 3)
add('fx', whoosh(1.2, 200, 3000), S('axioms', 528), .6)

# 02 fire — frame drum pulse, clapping, drone, bone flute sings the motif
f0 = CH['fire']
add('fx', crackle(17, 60, .08), S('fire'))
play('vc', [38, 45], b(f0), 7 * BAR, .45, att=2.0, g=.45)
for k in range(1, 7):
    for bt, v in ((0, .9), (1.5, .6), (2, .8), (3, .5), (3.5, .6)):
        add('perc', frame_drum(v), b(f0 + k, bt), .55 * v, (-.2, .2)[int(bt) % 2])
    if k >= 3:
        for bt in (1, 3): add('perc', clap_soft(), b(f0 + k, bt), .25, .3)
motif(b(f0 + 2), lambda m, t, d, g: play('fl', [m + 12], t, d * .95, .55, 'wind', att=.08, rel=.3, g=.8))
motif(b(f0 + 4), lambda m, t, d, g: play('fl', [m + 12], t, d * .95, .6, 'wind', att=.08, rel=.3, g=.8))
add('choir', choir([50, 57], BAR * 4, 'o', 1.5), b(f0 + 3), .35)

# 03 city — lyre arpeggios, chorus, board-game ticks, the crowd roars for the arena
c0 = CH['city']
for k in range(8):
    ch = chord_at(k)
    for i in range(8):
        add('pluck', pluck_fast(ch[1 + (i * 3) % 4] + 12, 1.0, .6), b(c0 + k, i * .5), .55, (-.4, .4)[i % 2])
    add('perc', frame_drum(.8), b(c0 + k), .45); add('perc', frame_drum(.5), b(c0 + k, 2.5), .3)
    if k >= 2: play('vc', [ch[0]], b(c0 + k), BAR, .45, att=.2, g=.4)
add('choir', choir([50, 57, 62, 65], BAR * 3, 'a', 1.0), b(c0 + 3), .45)
add('choir', choir([46, 53, 58, 62], BAR * 2, 'a', .6), b(c0 + 6), .5)
motif(b(c0 + 4), lambda m, t, d, g: play('vln', [m + 12], t, d * .95, .6, att=.15, g=.45))
for k in range(6): add('fx', tick(k % 2 == 0), S('city', 108 + k * 18), .5)           # senet moves
add('amb', crowd(6.0, .35), S('city', 380) - .8, 1.0)
add('perc', smp('Percussion/Timpani/Timpani2_Hit_v4_rr1_Sum.wav'), S('city', 386), .6)

# 04 page — lute & drone, a bell; the press lands with a thump
p0 = CH['page']
play('vc', [38, 45], b(p0), 6 * BAR, .42, att=1.5, g=.4)
for k in range(6):
    ch = chord_at(k)
    for i, bt in enumerate((0, .75, 1.5, 2, 2.75, 3.5)):
        add('pluck', pluck_fast(ch[1 + i % 4], .9, .35), b(p0 + k, bt), .5, .2)
motif(b(p0 + 2), lambda m, t, d, g: add('pluck', pluck_fast(m + 12, d + .6, .5), t, .7, -.2))
add('perc', smp('Miscellania Raw/Misc 2/NepaleseBells/fx_med_main.wav'), S('page'), .3)
tp = S('page', 214); add('perc', frame_drum(1.0), tp, 1.0); add('perc', smp('Percussion/Anvil_Hit1_v2_Sum.wav'), tp, .35); add('fx', sub(38, 1.0, .5), tp)
add('fx', whoosh(.8, 300, 5000), S('page', 262), .5)

# 05 clock — ticking clockwork, anvil on the beat, a music-hall piano (oom-pah + motif)
k0 = CH['clock']
for i in range(int(7 * 4 * 2)):
    add('fx', tick(i % 2 == 0), b(k0, i * .5), .45 if i % 2 == 0 else .3, .1)
for k in range(1, 7):
    add('perc', smp('Percussion/Anvil_Hit1_v1_Sum.wav'), b(k0 + k, 0), .18)
for k in range(2, 7):
    ch = chord_at(k)
    for bt in (0, 2): add('keys', piano(ch[0] - 12 + 12, .4, .6), b(k0 + k, bt), .8)
    for bt in (1, 3): add('keys', piano(ch[2], .3, .5), b(k0 + k, bt), .5); add('keys', piano(ch[3], .3, .5), b(k0 + k, bt), .5)
motif(b(k0 + 3), lambda m, t, d, g: add('keys', piano(m + 12, d, .7), t, .9))
motif(b(k0 + 5), lambda m, t, d, g: add('keys', piano(m + 12, d, .7), t, .9))
add('amb', crowd(4.0, .15), S('clock', 360), .8)

# 06 signal — the motif on a crackly "record", then strings bloom; radio static; swell to the Moon
s0 = CH['signal']
rec = Bus(8 * BAR + 2)
for k in range(4):
    ch = chord_at(k)
    for bt in (0, 1, 2, 3): rec.add(piano(ch[1] if bt % 2 == 0 else ch[2], .5, .55), b(k, bt), .6)
motif(b(1), lambda m, t, d, g: rec.add(piano(m + 12, d, .65), t, .9))
old = bp(rec.x, 400, 3200) * 1.3
add('keys', old, b(s0)); add('fx', crackle(4 * BAR, 90, .1), b(s0))
add('fx', bp(rng.standard_normal(int(1.6 * SR)), 800, 5000) * np.hanning(int(1.6 * SR)) * .12, S('signal', 250))   # radio tuning
for k in range(4, 8):
    ch = chord_at(k)
    play('vln', ch[2:4], b(s0 + k), BAR, .5, att=.5, g=.45); play('vc', [ch[0]], b(s0 + k), BAR, .5, att=.4, g=.5)
    for bt in range(4): add('keys', piano(ch[1 + bt % 3] + 12, .6, .45), b(s0 + k, bt), .6)
motif(b(s0 + 4), lambda m, t, d, g: play('hn', [m], t, d * .95, .6, att=.1, g=.55))
add('fx', riser(2.2, 200, 7000)[:, :] * .5, S('signal', 440) - 2.2)
add('perc', smp('Percussion/Timpani/Timpani2_Hit_v4_rr1_Sum.wav'), S('signal', 440), .8)
add('perc', smp('Percussion/cymbal-crash1_mf_rr1.wav'), S('signal', 440), .35)
play('vln', [74, 78], S('signal', 440), 4.5, .6, att=.2, g=.4)

# 07 screen — chiptune (Pong), synth-pop (Walkman), bright arps (Web), accelerating feed, then the drop
sc = CH['screen']
for k in range(1, 3):                                     # chiptune
    ch = chord_at(k)
    for i in range(16): add('synth', square(ch[1 + i % 4] + 12, BEAT / 4 * .9, .25, .09), b(sc + k, i / 4))
    for bt in range(4): add('synth', triangle(ch[0] - 12 + 12, BEAT * .9, .3), b(sc + k, bt))
    for bt in (0, 1, 2, 3): add('perc', chip_noise(.08, .15 if bt % 2 else .08), b(sc + k, bt + .5))
motif(b(sc + 1), lambda m, t, d, g: add('synth', square(m + 12, d * .9, .5, .12), t))
for k in range(3, 9):                                     # synth-pop / electronic
    ch = chord_at(k)
    add('synth', pad(ch[1:4], BAR, 1800, .5), b(sc + k))
    for bt in (0, 1, 2, 3): add('perc', kick808(26, .35), b(sc + k, bt), .35)
    for bt in (1, 3): add('perc', snare(200, .8), b(sc + k, bt), .3)
    hats = 8 if k < 6 else 16
    for i in range(hats): add('perc', hat(), b(sc + k, i * 4 / hats), .18, .3)
    for i in range(8): add('synth', square(ch[1 + (i * 2) % 4] + 24, BEAT / 2 * .6, .3, .05), b(sc + k, i * .5), 1.0, (-.3, .3)[i % 2])
    add('synth', sub(ch[0] - 12 + 12, BAR * .95, .25), b(sc + k))
motif(b(sc + 5), lambda m, t, d, g: add('synth', square(m + 12, d * .9, .25, .09), t))
add('fx', riser(2.0, 300, 12000) * .6, S('screen', 516) - 2.0)
# the drop: silence but a heartbeat and a thin high tone
td = S('screen', 516)
for k in range(4): add('perc', kick808(26, .5), td + .6 + k * .9, .5); add('perc', kick808(26, .4), td + .85 + k * .9, .3)
add('fx', st(np.sin(2 * np.pi * 6200 * tt(4.2)) * np.minimum(1, tt(4.2) / .5) * np.exp(-tt(4.2) * .4) * .02), td)

# 08 ai — generative FM bells over a glassy pad; collapse to one tone; the fire returns
ai = CH['ai']
g = np.random.default_rng(22)
for k in range(0, 5):
    ch = chord_at(k)
    add('synth', pad([ch[1] + 12, ch[2] + 12, ch[3] + 12], BAR, 2600, .45), b(ai + k))
    for i in range(12):
        if g.random() < .8:
            m = ch[1 + g.integers(0, 4)] + 12 * (1 + g.integers(0, 2))
            add('synth', fm_bell(m, 1.6, 1.5 + g.random() * 2), b(ai + k, i / 3), .5, g.uniform(-.7, .7))
    add('perc', kick808(26, .3), b(ai + k), .2)
tc = S('ai', 388)
add('synth', st(np.sin(2 * np.pi * hz(74) * tt(5.0)) * np.exp(-tt(5.0) * .35) * .18), tc)      # the audience of one: a single tone
add('fx', whoosh(.8, 2000, 200), tc - .4, .5)
tw = S('ai', 540)
add('fx', crackle(5, 50, .07), tw)
motif(tw, lambda m, t, d, g2: play('fl', [m + 12], t, d * .95, .55, 'wind', att=.08, rel=.3, g=.75))
play('vc', [38, 45], tw, 4, .45, att=1.0, g=.4)

# 09 close — everyone plays the motif; resolve to D major; the ember
cl = CH['close']
for k in range(0, 5):
    ch = chord_at(k)
    play('vln', ch[2:5], b(cl + k), BAR, .55, att=.3, g=.4); play('vla', ch[1:3], b(cl + k), BAR, .5, att=.3, g=.35)
    play('vc', [ch[0]], b(cl + k), BAR, .55, att=.2, g=.45); play('cb', [ch[0] - 12], b(cl + k), BAR, .5, att=.2, g=.4)
    for i in range(8): add('pluck', pluck_fast(ch[1 + i % 4] + 12, .8, .6), b(cl + k, i * .5), .3, (-.4, .4)[i % 2])
    for bt in (0, 2): add('perc', frame_drum(.7), b(cl + k, bt), .35)
motif(b(cl + 1), lambda m, t, d, g2: play('fl', [m + 12], t, d * .95, .6, 'wind', att=.08, rel=.3, g=.7))
motif(b(cl + 1), lambda m, t, d, g2: add('keys', piano(m, d * 1.4, .55), t, .7))
motif(b(cl + 3), lambda m, t, d, g2: play('hn', [m], t, d * .95, .6, att=.1, g=.5))
motif(b(cl + 3), lambda m, t, d, g2: add('synth', square(m + 24, d * .9, .5, .03), t))
tres = S('close', 344)
play('vln', [66, 69, 74], tres, 5.5, .55, att=.4, g=.45); play('vc', [50, 57], tres, 5.5, .55, att=.4, g=.45); play('cb', [38], tres, 5.5, .5, att=.4, g=.45)
add('choir', choir([50, 57, 62, 66], 5.5, 'o', 1.0), tres, .4)
add('keys', piano(62, 5, .5), tres); add('keys', piano(66, 5, .45), tres + .3); add('keys', piano(69, 5, .45), tres + .6)
te = S('close', 430)
motif(te + .6, lambda m, t, d, g2: add('keys', piano(m + 12, d * 1.8, .4), t, .75), dur_scale=1.15)
add('keys', piano(50, 5, .45), S('close', 520)); add('keys', piano(62, 5, .35), S('close', 520))

# ---------------------------------------------------------------- chapter transitions: soft whoosh + low hit
for cid in ['fire', 'city', 'page', 'clock', 'signal', 'screen', 'ai', 'close']:
    add('fx', whoosh(.9, 250, 3500), S(cid) - .7, .55)
    add('fx', sub(38, 1.2, .25), S(cid))

# ================================================================= MIX
print('mixing...')
IR = hall_ir(2.4); IR_S = hall_ir(1.1, .01, 6000)
x = lambda k: bus[k].x
music = x('str') * 1.0 + x('keys') * .85 + x('wind') * .9 + x('pluck') * .8 + x('choir') * .7 + x('synth') * .8
wet = convolve(hp(music, 120), IR) * .28
mix = hp(music, 30) + wet + x('perc') * .85 + convolve(x('perc'), IR_S) * .12 + x('fx') * .9 + x('amb')
mix = mix[:int(DUR * SR)]
# chapter-level gain staging toward a planned dynamic arc (dBFS RMS per chapter)
TARGET = {'open': -25, 'axioms': -21, 'fire': -18, 'city': -17.5, 'page': -18, 'clock': -17.5, 'signal': -17, 'screen': -15.5, 'ai': -18, 'close': -16.5}
gain = np.ones(len(mix))
for c in TL['chapters']:
    i0, i1 = int(S(c['id']) * SR), int((S(c['id']) + c['bars'] * BAR) * SR)
    seg = mix[i0:i1]; r = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
    gain[i0:i1] = 10 ** ((TARGET[c['id']] - r) / 20)
k = int(1.2 * SR); gain = np.convolve(np.pad(gain, (k, k), mode='edge'), np.ones(k) / k, 'same')[k:-k]
mix *= gain[:, None]
fo = int(2.0 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
# gentle programme compression (block RMS follower), then soft clip and true-peak ceiling
lvl = np.sqrt(lp(np.mean(mix ** 2, 1), 20, 1).clip(1e-12)); env = np.zeros_like(lvl); e = 0.0
for i in range(0, len(lvl), 64):
    v = lvl[i:i + 64].max(); c = .9995 if v < e else .98; e = c ** 64 * e + (1 - c ** 64) * v; env[i:i + 64] = e
over = np.maximum(0, 20 * np.log10(env + 1e-9) + 16)
mix *= (10 ** (-over * (1 - 1 / 2.5) / 20))[:, None]
mix = np.tanh(mix * 1.2) / 1.2
tp = max(np.max(np.abs(signal.resample_poly(mix[:, c], 4, 1))) for c in range(2)); mix *= min(1.0, 10 ** (-1 / 20) / tp)
wavfile.write(os.path.join(ROOT, 'public', 'score.wav'), SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
print('wrote public/score.wav', len(mix) / SR)
