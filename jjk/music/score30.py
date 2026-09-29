"""
Score + sound design for the 30-second ink test (anime-test/). 160 BPM, D minor, one bar = 1.5 s,
so every cut in shots.json lands on the bar grid. Reuses the VSCO-2 CE sampler from music/engine.py.
    python3 music/score30.py  -> ../anime-test/public/score30.wav
"""
import json, os, sys
import numpy as np
from scipy.io import wavfile
sys.path.insert(0, os.path.dirname(__file__))
from engine import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '..', 'anime-test', 'public', 'score30.wav')
DUR = 30.0
BPM = 160; BEAT = 60 / BPM; BAR = 4 * BEAT
def b(bar, beat=0.0): return bar * BAR + beat * BEAT
mus = {k: Bus(DUR + 3) for k in ['strings', 'brass', 'perc', 'drums', 'bass', 'synth', 'choir', 'keys', 'fx', 'amb']}
MUS = lambda k: mus[k]
print('loading instruments...')
I = {k: Instrument(p, g) for k, (p, g) in {
    'vln_spic': ('Strings/Violin Section/Spic', 1.0), 'vla_spic': ('Strings/Viola Section/spic', 1.0),
    'vc_spic': ('Strings/Cello Section/spic', 1.1), 'cb_spic': ('Strings/Solo Contrabass/Spic', 1.2),
    'vln_sus': ('Strings/Violin Section/susVib', .9), 'vla_sus': ('Strings/Viola Section/susvib', .9),
    'vc_sus': ('Strings/Cello Section/susvib', 1.0), 'cb_sus': ('Strings/Solo Contrabass/SusVib', 1.1),
    'vln_trem': ('Strings/Violin Section/Trem', .9), 'vc_trem': ('Strings/Cello Section/trem', 1.0),
    'hn_sus': ('Brass/F Horn/sus', 1.0), 'hn_stac': ('Brass/F Horn/stac', 1.0),
    'tb_sus': ('Brass/Tenor Trombone/sus', 1.0), 'tb_stac': ('Brass/Tenor Trombone/stac', 1.0),
    'tp_sus': ('Brass/Trumpet/sus', .9), 'tu_sus': ('Brass/Tuba/sus', 1.1), 'tu_stac': ('Brass/Tuba/stac', 1.1),
}.items()}
PIANO_DIR = os.path.join(VSCO, 'Keys/Upright Piano')
def piano(m, dur, vel=.7):
    # upright piano files are numbered by key: Player_dyn{1..}_rr1_{idx}.wav with idx -> midi from MappingChart
    # sampled every 4 semitones: file 2k -> key 21 + 4k (MappingChart.txt)
    idx = max(0, min(21, round((m - 21) / 4)))
    base = 21 + 4 * idx
    dyn = 1 if vel < .45 else 2 if vel < .8 else 3
    for d in (dyn, 2, 1):
        f = os.path.join(PIANO_DIR, f'Player_dyn{d}_rr1_{idx * 2:03d}.wav')
        if os.path.exists(f): break
    x = load_wav(f)
    ratio = 2 ** ((m - base) / 12)
    if ratio != 1:
        n = int(len(x) / ratio); t = np.arange(n) * ratio
        x = np.stack([np.interp(t, np.arange(len(x)), x[:, c]) for c in range(2)], 1)
    L = int((dur + .6) * SR); x = x[:L].copy()
    if len(x) > int(dur * SR): x[int(dur * SR):] *= np.linspace(1, 0, len(x) - int(dur * SR))[:, None]
    return x * (.4 + .6 * vel)

def perc(path, gain=1.0):
    return load_wav(os.path.join(VSCO, path)) * gain

def play(inst, notes, t, dur, vel=.8, bus='strings', pan=0.0, rel=.3, att=0.0, gain=1.0):
    for m in (notes if isinstance(notes, (list, tuple)) else [notes]):
        MUS(bus).add(I[inst].note(m, dur, vel, rel, att), t, gain, pan)

# ---------------------------------------------------------------- harmony
D2, D3, D4, D5 = 38, 50, 62, 74
CH = {  # chord tones (root, third, fifth, octave) around D4
    'Dm': [62, 65, 69, 74], 'Bb': [58, 62, 65, 70], 'C': [60, 64, 67, 72], 'A': [57, 61, 64, 69],
    'Gm': [55, 58, 62, 67], 'F': [53, 57, 60, 65], 'Eb': [51, 55, 58, 63], 'D': [62, 66, 69, 74],
}
ROOT_OF = {'Dm': 38, 'Bb': 34, 'C': 36, 'A': 33, 'Gm': 31, 'F': 29, 'Eb': 27, 'D': 38}
OST = [0, 0, 1, 0, 2, 0, 1, 0, 3, 0, 2, 0, 1, 0, 2, 1]        # 16th ostinato through chord tones

def ostinato(bar, chord, bars=1, inst=('vln_spic', 'vla_spic'), vel=.8, oct=0, gain=1.0):
    for k in range(bars):
        for i, s in enumerate(OST):
            m = CH[chord][s] + oct
            acc = 1.0 if i % 4 == 0 else .75
            play(inst[0], m + 12, b(bar + k, i / 4), BEAT / 4 * .9, vel * acc, 'strings', -.35, .06, gain=gain * .55)
            play(inst[1], m, b(bar + k, i / 4), BEAT / 4 * .9, vel * acc, 'strings', .35, .06, gain=gain * .5)

def low_strings(bar, chord, bars=1, pattern=(0, 1, 2, 3, 4, 5, 6, 7), vel=.85):
    r = ROOT_OF[chord]
    for k in range(bars):
        for i in pattern:
            m = r + (12 if i in (3, 7) else 0)
            play('vc_spic', m + 12, b(bar + k, i / 2), BEAT / 2 * .8, vel, 'strings', .2, .08, gain=.8)
            play('cb_spic', m, b(bar + k, i / 2), BEAT / 2 * .8, vel, 'strings', .1, .08, gain=.8)

def sustain(bar, chord, bars, insts=('vln_sus', 'vla_sus', 'vc_sus'), vel=.6, att=.5, bus='strings', gain=.6):
    ch = CH[chord]; r = ROOT_OF[chord]
    voic = {'vln_sus': [ch[2] + 12, ch[3] + 12], 'vla_sus': [ch[1], ch[2]], 'vc_sus': [r + 12, ch[0] - 12], 'cb_sus': [r],
            'hn_sus': [ch[0], ch[1]], 'tb_sus': [r + 12, ch[2] - 12], 'tu_sus': [r], 'tp_sus': [ch[2], ch[3]], 'vln_trem': [ch[1] + 12, ch[2] + 12, ch[3] + 12], 'vc_trem': [r + 12, ch[0]]}
    for inst in insts:
        play(inst, voic[inst], b(bar), bars * BAR, vel, bus, 0, .6, att, gain)

def trap(bar, bars=1, kick_pat=(0, 10), snare_pat=(8,), roll=True, vel=1.0, bass=None, hat8=True):
    for k in range(bars):
        B0 = bar + k
        for i in kick_pat:
            MUS('drums').add(kick_hard(), b(B0, i / 4), .9 * vel)
            if bass:
                r = ROOT_OF[bass[k % len(bass)]] - 12
                MUS('bass').add(kick808(r + 12, BEAT * 1.6, glide=(-2 if i == kick_pat[-1] and k % 2 else 0)), b(B0, i / 4), .5 * vel)
        for i in snare_pat:
            MUS('drums').add(snare(), b(B0, i / 4), .8 * vel); MUS('drums').add(clap(), b(B0, i / 4), .5 * vel)
        if hat8:
            for i in range(0, 16, 2): MUS('drums').add(hat(), b(B0, i / 4), (.35 if i % 4 else .5) * vel, .3)
        if roll and k % 2 == 1:
            for j in range(12): MUS('drums').add(hat(dur=.04), b(B0, 3 + j / 12), (.2 + j * .02) * vel, .3)

def taiko_fill(bar, beats=4, n=8, vel=1.0):
    for j in range(n):
        tb = b(bar, beats * j / n)
        MUS('perc').add(taiko(33 + (j % 3) * 3, 1.2, .8 + .2 * (j == n - 1)), tb, (.45 + .5 * j / n) * vel, (-.3, .3)[j % 2])

def gtr(bar, chord, bars=1, pat=(0, 1, 2, 3, 4, 5, 6, 7), accents=(0, 3, 6), vel=1.0):
    r = ROOT_OF[chord] + 12
    for k in range(bars):
        for i in pat:
            acc = i in accents
            MUS('synth').add(guitar_chord([r, r + 7, r + 12], BEAT / 2 * (1.6 if acc else .9), mute=not acc), b(bar + k, i / 2), .45 * vel * (1 if acc else .6))

def hit(t, root=38, big=1.0, choir_ch=None):
    """orchestral/hybrid impact: taiko + timpani + low brass stab + cymbal + braam"""
    MUS('perc').add(taiko(31, 2.5, 1), t, .9 * big)
    MUS('perc').add(perc('Percussion/Timpani/Timpani2_Hit_v4_rr1_Sum.wav'), t, .8 * big)
    MUS('drums').add(kick808(38, 1.6), t, .45 * big)
    play('tb_stac', [root + 12, root + 19], t, .5, .95, 'brass', gain=.9 * big)
    play('tu_stac', [root], t, .5, .95, 'brass', gain=.9 * big)
    play('hn_stac', [root + 24, root + 27], t, .5, .95, 'brass', gain=.8 * big)
    MUS('synth').add(hp(braam(root, 2.2), 70), t, .6 * big)
    MUS('perc').add(perc('VSCO 1 Percussion/varMetal/Cymbals/clash/crash_hit_fff_loose.wav'), t, .45 * big)
    if choir_ch: MUS('choir').add(choir(choir_ch, 2.4, 'a', .02), t, .7 * big)

def piano_motif(bar, notes, step=.5, vel=.55, dur=1.2):
    for j, m in enumerate(notes):
        if m is None: continue
        MUS('keys').add(piano(m, dur, vel), b(bar, j * step), 1.0, (-.2, .2)[j % 2])

def bell(t, which='fx_long_1_main.wav', gain=1.0):
    MUS('perc').add(perc('Miscellania Raw/Misc 2/NepaleseBells/' + which), t, gain)

def gong(t, gain=1.0):
    MUS('perc').add(perc('VSCO 1 Percussion/varMetal/Gong/gong_hit_ff.wav'), t, gain)


# ---------------------------------------------------------------- sound design voices
def whoosh(dur=.35, lo=300, hi=5000):
    t = tt(dur); p = np.sin(np.pi * t / dur) ** 2
    y = np.zeros(len(t)); zi = np.zeros((1, 2)); n = rng.standard_normal(len(t))
    for i in range(0, len(t), 256):
        fc = lo + (hi - lo) * p[i]; sos = signal.butter(2, fc, 'low', fs=SR, output='sos'); y[i:i + 256], zi = signal.sosfilt(sos, n[i:i + 256], zi=zi)
    return y * p * .7
def punch(big=False):
    t = tt(.5)
    body = np.sin(2 * np.pi * np.cumsum(60 + 140 * np.exp(-t * 35)) / SR) * np.exp(-t * (7 if big else 14))
    crack = hp(rng.standard_normal(len(t)), 1800) * np.exp(-t * (60 if big else 90))
    return np.tanh((body * 1.3 + crack * (.8 if big else .5)) * 2) * (.9 if big else .6)
def impact_big():
    t = tt(2.5)
    boom = np.sin(2 * np.pi * np.cumsum(28 + 90 * np.exp(-t * 8)) / SR) * np.exp(-t * 1.5)
    crack = hp(rng.standard_normal(len(t)), 900) * np.exp(-t * 12) * .8
    debris = lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 2) * .25
    return np.tanh((boom * 1.5 + crack + debris) * 1.6) * .95
def splash(g=1.0):
    t = tt(.25); return bp(rng.standard_normal(len(t)), 700, 7000) * np.exp(-t * 28) * .35 * g
def zing():
    t = tt(.6); f = 2400 + 3000 * np.exp(-t * 6)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * .3 + hp(rng.standard_normal(len(t)), 5000) * .2) * np.exp(-t * 7)
def glass(n=60):
    out = np.zeros(int(2.0 * SR))
    for k in range(n):
        i = int(rng.uniform(0, 1.2) ** 2 * SR); d = int(.08 * SR)
        tone = np.sin(2 * np.pi * rng.uniform(2500, 9000) * np.arange(d) / SR) * np.exp(-np.arange(d) / SR * 60)
        out[i:i + d] += tone * rng.uniform(.1, .4)
    out[:int(.3 * SR)] += hp(rng.standard_normal(int(.3 * SR)), 2000) * np.exp(-np.arange(int(.3 * SR)) / SR * 14) * .8
    return out * .6
def rumble(dur=3.0):
    t = tt(dur); return lp(rng.standard_normal(len(t)), 180) * (1 - np.exp(-t * 6)) * np.exp(-t * .9) * 2.2
def electric(dur=.8):
    t = tt(dur); y = np.zeros(len(t))
    for k in range(40):
        i = int(rng.uniform(0, dur * .9) * SR); d = int(rng.uniform(.005, .03) * SR)
        y[i:i + d] += rng.standard_normal(min(d, len(t) - i)) * rng.uniform(.3, 1)
    return np.tanh(hp(y, 800) * 3) * .5
def drop():
    t = tt(.4); f = 900 + 1800 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18) * .4


def compress(x, thr_db=-20, ratio=4.0, att=.01, rel=.18):
    lvl = np.sqrt(lp(np.mean(x ** 2, 1), 30, 1).clip(1e-12))
    env = np.zeros_like(lvl); a_a, a_r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); e = 0.0
    for i in range(0, len(lvl), 64):                         # block-wise follower (fast enough in numpy)
        v = lvl[i:i + 64].max(); c = a_a if v > e else a_r; e = c ** 64 * e + (1 - c ** 64) * v; env[i:i + 64] = e
    db = 20 * np.log10(env + 1e-9); over = np.maximum(0, db - thr_db)
    return x * (10 ** (-over * (1 - 1 / ratio) / 20))[:, None]

# ================================================================= COMPOSITION
# timeline (seconds) from ../anime-test/shots.json
SH = json.load(open(os.path.join(ROOT, '..', 'anime-test', 'shots.json')))
T = {}; acc = 0.0
for s in SH['shots']:
    T[s['id']] = acc; acc += s['bars'] * BAR
CLASH, FLASH, CARD = T['s07'], T['s12'], T['s09']
EX_HITS = [T['s08'] + k * .375 for k in (1, 2, 3, 4)]
CAR, SIGN = T['s10'] + .45, T['s13'] + .3
print('clash', CLASH, 'flash', FLASH)

# 0 – 6: night. rain, low drone, sparse piano; her reveal on a bell + tremolo
sustain(0, 'Dm', 4, ('cb_sus', 'vc_sus'), .35, 1.5, gain=.45)
piano_motif(0.5, [74, None, 69, None, 77, None, 76, 74], .5, .34, 2.0)
MUS('fx').add(riser(1.5, 300, 5000), T['s02'] - 1.5, .25)
bell(T['s02'], 'fx_med_main.wav', .7)
sustain(3, 'Eb', 1, ('vln_trem', 'vc_trem'), .5, .2, gain=.5)
for k in range(2): MUS('perc').add(taiko(29, 1.0, .5), T['s02'] + k * .75, .45)

# 6 – 9: the eyes. a brass stab on each, silence between
for t, root in ((T['s03'], 50), (T['s04'], 53)):
    play('tb_stac', [root - 12, root - 5], t, .5, .95, 'brass', gain=.8); play('tu_stac', [root - 24], t, .5, .95, 'brass', gain=.8)
    MUS('perc').add(taiko(31, 1.4, 1), t, .7)
sustain(4, 'Dm', 2, ('vln_trem',), .35, .3, gain=.3)

# 9 – 12: the run-up. taiko build, snare roll, riser into the clash
taiko_fill(6, 4, 8, .7); taiko_fill(7, 4, 16, .9)
for j in range(16): MUS('drums').add(snare(200, .9), b(7, j / 4), .15 + j * .03)
MUS('fx').add(riser(3.0, 200, 12000), CLASH - 3.0, .7)
ostinato(7, 'A', vel=.8, gain=.8)

# 12: CLASH
hit(CLASH, 38, 1.3, [50, 57, 62, 65])
# 12.75 – 15: exchange. full battle ostinato + trap kit
for k, ch in enumerate(['Dm', 'Bb']):
    B0 = 8.5 + k
    ostinato(B0, ch, vel=.95); low_strings(B0, ch)
    trap(B0, kick_pat=(0, 6, 10), snare_pat=(8,), bass=[ch], roll=(k == 1))
    gtr(B0, ch, pat=(0, 1, 3, 4, 6, 7), vel=.8)
play('tp_sus', [74], b(8.5), BEAT * 1.9, .9, 'brass', gain=.7); play('tp_sus', [77], b(8.5, 2), BEAT * 1.9, .9, 'brass', gain=.7)
play('tp_sus', [76], b(9.5), BEAT * 1.9, .9, 'brass', gain=.7); play('tp_sus', [73], b(9.5, 2), BEAT * 1.9, .9, 'brass', gain=.7)

# 15 – 18.75: CRIMSON WEAVE. half-time menace: low brass, choir, tremolo
hit(CARD, 39, 1.1, [51, 58, 63])
sustain(10, 'Eb', 2.5, ('tb_sus', 'tu_sus', 'cb_sus'), .8, .1, 'brass', .55)
MUS('choir').add(choir([39, 46, 51, 55], BAR * 2.5, 'o', .3), CARD, .5)
sustain(10, 'Eb', 2.5, ('vln_trem',), .55, .1, gain=.35)
for k in range(3):
    MUS('drums').add(kick_hard(), b(10 + k), .8); MUS('drums').add(kick_hard(), b(10 + k, 1.75), .5)
    MUS('drums').add(snare(160, .7), b(10 + k, 2), .7)
hit(CAR, 38, .6)

# 18.75 – 20.25: the charge. everything drops to a drone and a reverse swell; a beat of silence
sustain(12.5, 'Dm', 1, ('cb_sus', 'vc_sus'), .6, .3, gain=.5)
play('vln_sus', [86, 87], b(12.5), BAR - .15, .55, 'strings', att=.6, gain=.4)
MUS('fx').add(riser(BAR - .1, 150, 15000), b(12.5), .85)
for k in range(4): MUS('perc').add(taiko(27, 1.0, .6), b(12.5, k), .5)

# 20.25: INK FLASH
hit(FLASH, 38, 1.8, [38, 50, 57, 62, 65, 69, 74])
MUS('synth').add(braam(26, 3.0), FLASH, .9)
gong(FLASH, .9)
# 21.75 – 24: the blast. ostinato returns, a crash on the sign
for k, ch in enumerate(['Dm', 'A']):
    B0 = 14.5 + k
    ostinato(B0, ch, vel=1.0, gain=1.1); low_strings(B0, ch)
    trap(B0, kick_pat=(0, 3, 6, 10), snare_pat=(8,), bass=[ch], roll=True)
    sustain(B0, ch, 1, ('hn_sus', 'tb_sus'), .85, .05, 'brass', .5)
hit(SIGN, 38, .9)

# 24 – 27: aftermath. strings + piano, the rain comes back up
sustain(16, 'Bb', 1, ('vln_sus', 'vla_sus', 'vc_sus'), .45, .5, gain=.45)
sustain(17, 'A', 1, ('vln_sus', 'vla_sus', 'vc_sus'), .45, .5, gain=.45)
piano_motif(16, [74, 77, 76, 74, None, 69, 70, 69], .5, .38, 1.4)
# 27 – 30: title. hit, then D major rings out (a Picardy close)
hit(T['s15'], 38, 1.2, [50, 57, 62, 66])
sustain(18, 'D', 2, ('vln_sus', 'vla_sus', 'vc_sus', 'cb_sus', 'hn_sus'), .6, .1, gain=.5)
MUS('choir').add(choir([50, 57, 62, 66], BAR * 2, 'o', .2), T['s15'], .4)

# ================================================================= SOUND DESIGN
sfx = Bus(DUR + 3)
for t in [T['s06'] + .4, T['s05']]: sfx.add(whoosh(.5, 300, 6000), t, .7)
sfx.add(punch(True), CLASH, 1.0); sfx.add(impact_big(), CLASH, .7)
for t in EX_HITS: sfx.add(punch(False), t, .9, rng.uniform(-.4, .4)); sfx.add(whoosh(.18, 600, 7000), t - .16, .35)
for k in range(6): sfx.add(zing(), CARD + .25 + k * .09, .5, rng.uniform(-.7, .7))
sfx.add(zing(), CAR - .05, .9); sfx.add(impact_big(), CAR, .5); sfx.add(glass(40), CAR, .5)
sfx.add(st(lp(rng.standard_normal(int(1.4 * SR)), 900) * np.linspace(0, 1, int(1.4 * SR)) ** 2 * .6), T['s11'], .8)
sfx.add(impact_big(), FLASH, 1.2); sfx.add(electric(1.2), FLASH, .9); sfx.add(rumble(3.0), FLASH, 1.0)
sfx.add(glass(90), SIGN, 1.0); sfx.add(punch(True), SIGN, .6)
sfx.add(st(np.sin(2 * np.pi * 7200 * tt(1.2)) * np.exp(-tt(1.2) * 2) * .03), FLASH + .3, 1)

# rain bed: full in the city, ducked for the eyes and the charge
n = int((DUR + 2) * SR); rn = hp(rng.standard_normal(n), 1500) * .04 + bp(rng.standard_normal(n), 200, 900) * .025
tt_ = np.arange(n) / SR
env = np.clip(tt_ / 1.2, 0, 1) * np.where((tt_ > T['s03']) & (tt_ < T['s05']), .35, 1) * np.where((tt_ > T['s11']) & (tt_ < FLASH), .2, 1)
env = np.convolve(env, np.ones(9600) / 9600, 'same')
mus['amb'].add(np.stack([rn * env, np.roll(rn, 2400) * env], 1), 0, 1)

# ================================================================= MIX
print('mixing...')
IR = hall_ir(2.6); IR_S = hall_ir(1.2, .01, 6000)
g = lambda k: mus[k].x
orch = hp(g('strings') + g('brass') * .9 + g('choir') * .8 + g('keys') * .8, 55)
wet = convolve(orch, IR) * .32 + convolve(g('perc') * .5 + g('drums') * .12, IR_S) * .25
music = orch * 1.25 + wet + hp(g('perc'), 45) * .8 + hp(g('synth'), 50) * .7 + hp(g('drums'), 35) * .7 + hp(g('bass'), 38) * .38 + g('fx') * .8
# the charge: pull the music down so the flash lands on near-silence
tq = np.arange(len(music)) / SR
dk = np.where((tq > T['s11'] + .9) & (tq < FLASH - .01), .3, 1.0); dk = np.convolve(dk, np.ones(1200) / 1200, 'same')
music *= dk[:, None]
mix = music * .9 + (sfx.x + convolve(sfx.x, IR_S) * .18) * .85 + g('amb')
mix = hp(mix, 25)[:int(DUR * SR)]
fo = int(1.5 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
mix = mix - .35 * lp(mix, 90)
mix = mix / np.sqrt(np.mean(mix ** 2)) * 10 ** (-16 / 20)
mix = compress(mix)
mix = mix / np.sqrt(np.mean(mix ** 2)) * 10 ** (-13.5 / 20)
mix = np.tanh(mix * 1.15) / 1.15
tp = max(np.max(np.abs(signal.resample_poly(mix[:, c], 4, 1))) for c in range(2))
mix *= 10 ** (-1 / 20) / tp
wavfile.write(OUT, SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
print('wrote', OUT, len(mix) / SR, 's')
