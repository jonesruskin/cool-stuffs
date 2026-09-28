"""
墨ノ刻 — HOUR OF INK: original score + sound design.

Hybrid orchestral / trap writing in the manner of modern shōnen battle scores: spiccato string
ostinati, brass stabs and braams, taiko, 808s with glides, distorted guitar, choir, temple bells.
150 BPM, D minor. Section boundaries and every big hit are taken from the film's cue list
(build_meta.json, exported by the renderer), so music and picture land together.

    python3 music/score.py     -> build/score.wav (music+sfx), build/stems/*.wav
"""
import json, os, sys
import numpy as np
from scipy.io import wavfile
sys.path.insert(0, os.path.dirname(__file__))
from engine import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = json.load(open(os.path.join(ROOT, 'build_meta.json')))
CUES = META['cues']
DUR = 180.0
BPM = 150; BEAT = 60 / BPM; BAR = 4 * BEAT
def b(bar, beat=0.0): return bar * BAR + beat * BEAT

mus = {k: Bus(DUR + 4) for k in ['strings', 'brass', 'perc', 'drums', 'bass', 'synth', 'choir', 'keys', 'fx', 'amb']}
MUS = lambda k: mus[k]

# ---------------------------------------------------------------- instruments (VSCO-2 CE, CC0)
print('loading instruments...')
I = {
    'vln_spic': Instrument('Strings/Violin Section/Spic', 1.0),
    'vla_spic': Instrument('Strings/Viola Section/spic', 1.0),
    'vc_spic': Instrument('Strings/Cello Section/spic', 1.1),
    'cb_spic': Instrument('Strings/Solo Contrabass/Spic', 1.2),
    'vln_sus': Instrument('Strings/Violin Section/susVib', .9),
    'vla_sus': Instrument('Strings/Viola Section/susvib', .9),
    'vc_sus': Instrument('Strings/Cello Section/susvib', 1.0),
    'cb_sus': Instrument('Strings/Solo Contrabass/SusVib', 1.1),
    'vln_trem': Instrument('Strings/Violin Section/Trem', .9),
    'vc_trem': Instrument('Strings/Cello Section/trem', 1.0),
    'hn_sus': Instrument('Brass/F Horn/sus', 1.0),
    'hn_stac': Instrument('Brass/F Horn/stac', 1.0),
    'tb_sus': Instrument('Brass/Tenor Trombone/sus', 1.0),
    'tb_stac': Instrument('Brass/Tenor Trombone/stac', 1.0),
    'tp_sus': Instrument('Brass/Trumpet/sus', .9),
    'tp_stac': Instrument('Brass/Trumpet/stac', .9),
    'tu_sus': Instrument('Brass/Tuba/sus', 1.1),
    'tu_stac': Instrument('Brass/Tuba/stac', 1.1),
    'fl': Instrument('Woodwinds/Flute/susNV', .8),
}
for k, v in I.items(): print(f'  {k:9s} {len(v.notes):3d} notes  octave offset {v.offset:+d}')
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

cue_t = lambda name, shot=None: [c[0] for c in CUES if c[1] == name and (shot is None or shot in c[2])]
shot_t0 = {s[0]: s[1] for s in META['shots']}

# ================================================================= COMPOSITION
print('composing...')
# A. 0 – 9.6  night: drone, rain, distant piano, a bell as the city appears
MUS('bass').add(sub_bass(38, 9.8) * .5, 0, .35)
sustain(0, 'Dm', 6, ('cb_sus', 'vc_sus'), .35, 2.0, gain=.45)
piano_motif(1, [74, None, 69, None, 77, None, 76, 74], .5, .35, 2.4)
piano_motif(4, [74, None, 69, None, 72, 70, 69, None], .5, .33, 2.4)
bell(4.8, 'fx_med_main.wav', .5)

# B. 9.6 – 19.2  the walk: lo-fi hip-hop pocket (JJK's quiet-before-the-storm register)
for k in range(6):
    B0 = 6 + k
    MUS('drums').add(kick808(26, .5), b(B0, 0), .5); MUS('drums').add(kick808(26, .4), b(B0, 2.5), .35)
    MUS('drums').add(rim(), b(B0, 1), .5); MUS('drums').add(rim(), b(B0, 3), .5)
    for i in range(8): MUS('drums').add(hat(), b(B0, i / 2 + (.08 if i % 2 else 0)), .18 if i % 2 else .25, .25)
    ch = ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'A'][k]
    MUS('bass').add(sub_bass(ROOT_OF[ch] - 12 + 12, BAR * .95), b(B0), .5)
    tones = CH[ch]
    piano_motif(B0, [tones[0] + 12, tones[2], tones[1] + 12, tones[3], None, tones[2] + 12, tones[1] + 12, None], .5, .42, 1.0)
MUS('fx').add(riser(1.6, 300, 6000), b(11), .5)

# C. 19.2 – 32  she appears: tremolo clusters, heartbeat, horn swell; thunder + landing hit
sustain(12, 'Dm', 4, ('vln_trem', 'vc_trem'), .45, 1.5, gain=.5)
sustain(16, 'Eb', 2, ('vln_trem', 'vc_trem'), .55, .6, gain=.55)
sustain(12, 'Dm', 8, ('cb_sus',), .5, 1.0, gain=.5)
for k in range(8):
    MUS('perc').add(taiko(29, 1.0, .5), b(12 + k, 0), .35); MUS('perc').add(taiko(29, 1.0, .4), b(12 + k, .6), .25)
play('hn_sus', [62, 63], b(14), BAR * 2, .6, 'brass', att=1.2, gain=.6)
play('hn_sus', [65, 66], b(16), BAR * 2, .7, 'brass', att=.6, gain=.6)
for t in cue_t('land', '09'): hit(t, 38, .9)
# neck crack / aura
for t in cue_t('aura'): MUS('fx').add(reverse_swell(noise_burst(1.2, 200, 3000, .5)[:, None] * np.ones((1, 2)) * .5), t - 1.2, .6)

# D. 32 – 38.4  eye cuts, the raindrop, title
for t in cue_t('eye') + cue_t('clench'):
    play('tb_stac', [50, 51], t, .4, .9, 'brass', gain=.6); MUS('perc').add(taiko(31, 1.0, .9), t, .6)
for k in range(12): MUS('drums').add(rim(), 32 + k * BEAT / 2, .25, .4)      # clock ticks
for t in cue_t('title'):
    hit(t, 38, 1.4, [50, 57, 62, 65, 69])
    MUS('fx').add(riser(1.5, 300, 9000), t - 1.5, .6)

# E. 38.4 – 64  BATTLE THEME
PROG = ['Dm', 'Dm', 'Bb', 'Bb', 'C', 'C', 'A', 'A']
for k in range(16):
    B0 = 24 + k; ch = PROG[k % 8]
    ostinato(B0, ch, vel=.85)
    low_strings(B0, ch)
    trap(B0, kick_pat=(0, 6, 10) if k % 4 != 3 else (0, 3, 6, 10, 14), snare_pat=(8,), bass=[ch], roll=(k % 2 == 1))
    if k >= 4: gtr(B0, ch, pat=(0, 1, 3, 4, 6, 7), accents=(0, 3, 6), vel=.8)
    for bt in (0, 1.5, 3.5):
        play('hn_stac', [CH[ch][0], CH[ch][2]], b(B0, bt), .3, .85, 'brass', gain=.55)
# battle melody on trumpets + horns (bars 32–40)
MEL = [(74, 2), (77, 1), (76, 1), (74, 2), (72, 1), (69, 1), (70, 3), (72, 1), (74, 2), (76, 2), (73, 4)]
t0 = b(32)
for m, d in MEL:
    play('tp_sus', [m], t0, d * BEAT * .95, .85, 'brass', att=.02, gain=.7)
    play('hn_sus', [m - 12], t0, d * BEAT * .95, .8, 'brass', att=.02, gain=.6)
    t0 += d * BEAT
for k in range(0, 16, 4): taiko_fill(24 + k + 3, 4, 8, .6)
for t in cue_t('IMPACT', '13') + cue_t('GLASS'): hit(t, 38, 1.0)

# F. 64 – 83.2  CRIMSON WEAVE: half-time menace, low brass, choir, tremolo
VPROG = ['Dm', 'Eb', 'Dm', 'A']
for k in range(12):
    B0 = 40 + k; ch = VPROG[(k // 2) % 4]
    if k % 2 == 0:
        sustain(B0, ch, 2, ('tb_sus', 'tu_sus', 'cb_sus'), .75, .2, 'brass', .55)
        MUS('choir').add(choir([CH[ch][0] - 12, CH[ch][1] - 12, CH[ch][2] - 12], BAR * 2, 'o', .5), b(B0), .45)
    sustain(B0, ch, 1, ('vln_trem',), .5, .1, gain=.35)
    MUS('drums').add(kick_hard(), b(B0, 0), .8); MUS('drums').add(kick_hard(), b(B0, 1.75), .5)
    MUS('drums').add(snare(160, .7), b(B0, 2), .7); MUS('drums').add(clap(), b(B0, 2), .4)
    MUS('bass').add(kick808(ROOT_OF[ch] - 12, BAR * .9, glide=-1), b(B0, 0), .7)
    for i in range(16):
        if (i * 7) % 5 < 2: MUS('drums').add(hat(dur=.03), b(B0, i / 4), .25, .4)
    for i in (0, 3, 6):                                                    # low string stabs
        play('vc_spic', [ROOT_OF[ch] + 12], b(B0, i / 2), .2, .95, gain=.7); play('cb_spic', [ROOT_OF[ch]], b(B0, i / 2), .2, .95, gain=.7)
for t in cue_t('CARD', '25') + cue_t('SLICE') + cue_t('COLLAPSE'): hit(t, 39, 1.1, [51, 58, 63])
for t in cue_t('weave'): MUS('fx').add(riser(1.2, 800, 12000), t - .2, .4)

# G. 83.2 – 102.4  INK TIDE: the hero theme, full band
HPROG = ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A']
for k in range(12):
    B0 = 52 + k; ch = HPROG[k % 8]
    ostinato(B0, ch, vel=.9, gain=1.1)
    low_strings(B0, ch)
    trap(B0, kick_pat=(0, 6, 10), snare_pat=(8,), bass=[ch], roll=True)
    gtr(B0, ch, pat=tuple(range(8)), accents=(0, 3, 6), vel=.9)
    sustain(B0, ch, 1, ('vln_sus',), .7, .05, gain=.35)
HMEL = [(69, 1), (70, 1), (72, 2), (74, 4), (77, 2), (76, 1), (74, 1), (72, 4), (69, 1), (70, 1), (72, 2), (74, 2), (76, 2), (77, 3), (76, 1), (73, 4)]
t0 = b(54)
for m, d in HMEL:
    play('tp_sus', [m], t0, d * BEAT * .95, .9, 'brass', att=.02, gain=.75)
    play('hn_sus', [m - 12, m - 5], t0, d * BEAT * .95, .85, 'brass', att=.02, gain=.55)
    t0 += d * BEAT
for t in cue_t('CARD', '31') + cue_t('WAVE'): hit(t, 34, 1.1, [46, 53, 58, 62])
for t in cue_t('IMPACT', '34') + cue_t('CLASH'): hit(t, 38, .9)
taiko_fill(63, 4, 16, .8)

# H. 102.4 – 115.2  INK FLASH
t_if = cue_t('INKFLASH')[0]
MUS('fx').add(riser(t_if - b(64) - .05, 200, 14000), b(64), .8)
play('vln_sus', [86, 87], b(64), t_if - b(64), .6, 'strings', att=.8, gain=.4)                     # tense high cluster
for k in range(4): MUS('perc').add(taiko(27, 1.0, .6), b(64, k), .5)                               # heartbeat
hit(t_if, 38, 1.8, [38, 50, 57, 62, 65, 69, 74])
MUS('synth').add(braam(26, 4.0), t_if, 1.0)
gong(t_if, .9)
sustain(65, 'Dm', 5, ('cb_sus', 'vc_sus'), .5, .5, gain=.45)
MUS('choir').add(choir([50, 57, 62], BAR * 5, 'a', 1.5), b(65), .45)
piano_motif(67, [62, None, 65, None, 69, None, 68, None], .5, .45, 2.0)
for k in range(3):                                                                                  # she rises: creeping ostinato
    ostinato(69 + k, 'Dm' if k < 2 else 'A', vel=.6, gain=.6 + k * .15)
    MUS('drums').add(kick_hard(), b(69 + k, 0), .5 + .15 * k)
for t in cue_t('CRASH'): MUS('perc').add(taiko(29, 2.0, 1), t, .8)

# I. 115.2 – 153.6  DOMAIN EXPANSION
t_bell = cue_t('BELL')[0]
bell(t_bell, 'fx_long2_main.wav', 1.0)
MUS('amb').add(st(lp(rng.standard_normal(int(3 * SR)), 300) * .05), t_bell, 1)
t_ry = cue_t('RYOIKI')[0]
gong(t_ry, 1.2)
MUS('choir').add(choir([38, 50, 57, 62, 65], 5.0, 'a', .05), t_ry, .8)
play('tb_sus', [38, 45, 50], t_ry, 4.5, .9, 'brass', att=.05, gain=.8)
MUS('fx').add(riser(3.2, 150, 10000), b(75), .7)
sustain(75, 'Dm', 2, ('vln_trem', 'vc_trem', 'cb_sus'), .8, 2.5, gain=.6)
t_tutti = cue_t('TUTTI')[0]
DPROG = ['Dm', 'Bb', 'Gm', 'A']
for k in range(12):                                                          # 123.2 – 142.4
    B0 = 77 + k; ch = DPROG[k % 4]
    ostinato(B0, ch, vel=.95, gain=1.0)
    low_strings(B0, ch)
    MUS('choir').add(choir([CH[ch][0] - 12, CH[ch][1] - 12, CH[ch][2] - 12, CH[ch][0]], BAR, 'a', .1), b(B0), .6)
    sustain(B0, ch, 1, ('hn_sus', 'tb_sus', 'tu_sus'), .85, .1, 'brass', .6)
    trap(B0, kick_pat=(0, 3, 6, 10), snare_pat=(8,), bass=[ch], roll=True, vel=.9)
    for bt in (0, 1.5, 2, 3.5): MUS('perc').add(taiko(31 + (bt == 2) * 5, 1.2, 1), b(B0, bt), .55)
DMEL = [(74, 4), (72, 2), (70, 2), (69, 4), (65, 2), (67, 2), (69, 3), (70, 1), (72, 2), (74, 2), (73, 8),
        (74, 4), (77, 2), (76, 2), (74, 4), (72, 2), (70, 2), (69, 4), (70, 2), (73, 2), (74, 8)]
t0 = b(77)
for m, d in DMEL:
    play('tp_sus', [m], t0, d * BEAT * .96, .95, 'brass', att=.03, gain=.75)
    play('hn_sus', [m - 12], t0, d * BEAT * .96, .9, 'brass', att=.03, gain=.65)
    t0 += d * BEAT
    if t0 > b(89): break
hit(t_tutti, 38, 1.5, [38, 50, 57, 62, 65, 69])
for t in cue_t('SPIKES') + cue_t('IMPACT', '51'): hit(t, 38, .8)
# spear / catch: 142.4 – 148.8 tension then release
sustain(89, 'Eb', 2, ('vln_trem', 'vc_trem', 'tb_sus'), .8, .3, gain=.55)
MUS('choir').add(choir([51, 58, 63, 66], BAR * 2, 'a', .3), b(89), .6)
for k in range(8): MUS('perc').add(taiko(29, .8, .8), b(89, k), .4 + k * .05)
for t in cue_t('CATCH'): hit(t, 38, 1.3, [50, 57, 62])
# the colossal fist: 148.8 – 153.6, everything climbs
t_rise = cue_t('RISE')[0]; t_strike = cue_t('STRIKE')[0]
for k, ch in enumerate(['Bb', 'C', 'A']):
    ostinato(93 + k, ch, vel=1.0, gain=1.1 + .1 * k)
    MUS('choir').add(choir([c - 12 for c in CH[ch][:3]] + [CH[ch][3]], BAR, 'a', .1), b(93 + k), .6 + .1 * k)
    sustain(93 + k, ch, 1, ('hn_sus', 'tb_sus', 'tu_sus', 'tp_sus'), .9, .1, 'brass', .6)
taiko_fill(95, 4, 16, 1.0)
MUS('fx').add(riser(t_strike - t_rise, 150, 15000), t_rise, .8)
hit(t_strike, 38, 1.8, [38, 50, 57, 62, 66, 69])

# J. 153.6 – 180  aftermath
t_white = cue_t('WHITE')[0]
MUS('fx').add(st(np.sin(2 * np.pi * 7400 * tt(3.0)) * np.exp(-tt(3.0) * .9) * .04), t_white, 1)        # tinnitus
MUS('synth').add(braam(26, 4.0), t_white, .6)
t_sh = cue_t('SHATTER')[0]
sustain(98, 'Dm', 2, ('vln_sus', 'vla_sus', 'vc_sus', 'cb_sus'), .55, 1.0, gain=.55)
SAD = ['Dm', 'Bb', 'F', 'C', 'Gm', 'Bb', 'A', 'A']
for k in range(8):                                                     # 160 – 172.8
    B0 = 100 + k; ch = SAD[k]
    sustain(B0, ch, 1, ('vln_sus', 'vla_sus', 'vc_sus'), .45, .6, gain=.45)
    tones = CH[ch]
    piano_motif(B0, [tones[0] + 12, tones[2] + 12, tones[1] + 12, tones[3] + 12, tones[2] + 12, None, tones[1] + 12, None], .5, .4, 1.4)
for k in range(4):                                                     # walk away: the lo-fi pocket returns
    B0 = 106 + k
    MUS('drums').add(kick808(26, .5), b(B0, 0), .4); MUS('drums').add(rim(), b(B0, 1), .35); MUS('drums').add(rim(), b(B0, 3), .35)
    for i in range(8): MUS('drums').add(hat(), b(B0, i / 2 + (.08 if i % 2 else 0)), .15, .25)
sustain(108, 'Bb', 1, ('vln_sus', 'vla_sus', 'vc_sus', 'hn_sus'), .6, .8, gain=.5)
sustain(109, 'C', 1, ('vln_sus', 'vla_sus', 'vc_sus', 'hn_sus'), .65, .6, gain=.5)
sustain(110, 'D', 2.4, ('vln_sus', 'vla_sus', 'vc_sus', 'cb_sus', 'hn_sus'), .7, .5, gain=.55)          # Picardy: D major at dawn
MUS('choir').add(choir([50, 57, 62, 66], BAR * 2.4, 'o', .8), b(110), .45)
for m, dt in ((74, 0), (78, 1), (81, 2), (86, 3.5)): MUS('keys').add(piano(m, 3.0, .45), b(110, dt), .9)
MUS('keys').add(piano(62, 4.0, .5), b(111, 2), .8); MUS('keys').add(piano(50, 4.0, .5), b(111, 2), .6)

# ================================================================= SOUND DESIGN
print('sound design...')
sfx = Bus(DUR + 4)
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

for t, name, shot in CUES:
    N = name
    if N in ('IMPACT', 'HIT_GUT', 'CLASH', 'CATCH'):
        sfx.add(punch(True), t, 1.0); sfx.add(impact_big(), t, .7); sfx.add(whoosh(.3, 400, 6000), t - .28, .5)
    elif N in ('hit', 'HIT'):
        sfx.add(punch(False), t, .9, rng.uniform(-.4, .4)); sfx.add(whoosh(.18, 600, 7000), t - .16, .35)
    elif N in ('whiff', 'swoosh', 'flip', 'burst', 'leap', 'launch', 'DASH', 'vanish', 'run'):
        sfx.add(whoosh(.45, 300, 6000), t - .1, .7)
    elif N == 'step':
        sfx.add(splash(), t, .9, rng.uniform(-.2, .2))
    elif N in ('land', 'plant'):
        sfx.add(impact_big(), t, .6); sfx.add(splash(2), t, .8)
    elif N in ('GLASS', 'SHATTER'):
        sfx.add(glass(90 if N == 'SHATTER' else 60), t, 1.0); sfx.add(punch(True), t, .6)
    elif N == 'thunder':
        th = rumble(4.0) * 1.3; th[:int(.05 * SR)] += hp(rng.standard_normal(int(.05 * SR)), 500) * .6
        sfx.add(th, t, 1.0)
    elif N in ('slash', 'whip', 'SHRED', 'taut'):
        sfx.add(zing(), t, .8, rng.uniform(-.5, .5)); sfx.add(whoosh(.2, 1000, 9000), t - .05, .4)
    elif N in ('SLICE',):
        sfx.add(zing(), t, 1.0); sfx.add(rumble(4.0), t + .2, 1.0)
    elif N in ('COLLAPSE', 'CRASH'):
        sfx.add(impact_big(), t, 1.0); sfx.add(rumble(4.5), t, 1.2); sfx.add(glass(30), t + .1, .4)
    elif N in ('WAVE', 'flood', 'swallow', 'RISE'):
        w = lp(rng.standard_normal(int(3.2 * SR)), 900) * np.linspace(0, 1, int(3.2 * SR)) ** .5 * np.linspace(1, .2, int(3.2 * SR))
        sfx.add(w * 1.4, t, .9)
    elif N in ('cut',):
        sfx.add(zing(), t, .6)
    elif N in ('INKFLASH', 'WHITE', 'STRIKE'):
        sfx.add(impact_big(), t, 1.2); sfx.add(electric(1.2), t, .9); sfx.add(rumble(3.5), t, 1.0)
    elif N in ('drip', 'drop'):
        sfx.add(drop(), t, .9)
    elif N in ('skid',):
        s = bp(rng.standard_normal(int(1.1 * SR)), 1200, 8000) * np.linspace(1, 0, int(1.1 * SR)) * .5; sfx.add(s, t, .8)
    elif N in ('CARD', 'RYOIKI', 'title', 'name'):
        sfx.add(whoosh(.6, 200, 4000), t - .3, .6)
    elif N in ('SPIKES', 'spikes'):
        for k in range(6): sfx.add(punch(False) * .6, t + k * .12, .7, rng.uniform(-.6, .6))
    elif N in ('crack',):
        sfx.add(hp(rng.standard_normal(int(.06 * SR)), 1500) * np.exp(-np.arange(int(.06 * SR)) / SR * 70), t, .5)
    elif N in ('inkboil', 'charge', 'gather', 'sign', 'aura', 'rise'):
        sw = reverse_swell(st(lp(rng.standard_normal(int(1.5 * SR)), 1200) * .5)); sfx.add(sw, t - .2, .5)

# rain bed (city, not the domain), thunder rumble under the opening
dom0, dom1 = shot_t0['46 domain reveal'], shot_t0['56 shatter']
rn = hp(rng.standard_normal(int((DUR + 2) * SR)), 1500) * .04 + bp(rng.standard_normal(int((DUR + 2) * SR)), 200, 900) * .025
env = np.ones(len(rn)); tt_ = np.arange(len(rn)) / SR
env *= np.clip((tt_ - .2) / 1.5, 0, 1)
env *= np.where((tt_ > dom0 - 2.0) & (tt_ < dom1), 0, 1) * 1.0
env = np.convolve(env, np.ones(int(.8 * SR)) / int(.8 * SR), 'same')
env *= np.where(tt_ > dom1 + 3, np.clip(1 - (tt_ - dom1 - 3) / 2, 0, 1), 1)                       # rain stops at dawn
mus['amb'].add(np.stack([rn * env, np.roll(rn, 2400) * env], 1), 0, 1)
for t in cue_t('SILENCE') + cue_t('riser', '38'):                                                   # frozen rain: duck everything
    pass

# ================================================================= MIX
print('mixing...')
IR = hall_ir(2.9)
IR_S = hall_ir(1.4, .01, 6000)
def get(k): return mus[k].x
stems = {}
stems['strings'] = get('strings') * 1.0
stems['brass'] = get('brass') * .9
stems['choir'] = get('choir') * .8
stems['keys'] = get('keys') * .9
stems['perc'] = hp(get('perc'), 45) * .9
stems['synth'] = get('synth') * .7
stems['drums'] = hp(get('drums'), 35) * .7
stems['bass'] = hp(get('bass'), 38) * .38
stems['fx'] = get('fx') * .8
stems['amb'] = get('amb') * 1.0
kicks = [b(24 + k, i / 4) for k in range(16) for i in (0, 6, 10)] + [b(52 + k, i / 4) for k in range(12) for i in (0, 6, 10)] + [b(77 + k, i / 4) for k in range(12) for i in (0, 3, 6, 10)]
stems['bass'] = sidechain(stems['bass'], [], 0)
orch = hp(stems['strings'] + stems['brass'] + stems['choir'] + stems['keys'] * .8, 55)
# the quiet ending (piano + strings at dawn) needs to sit forward
end_g = np.clip((np.arange(len(orch)) / SR - 156) / 3, 0, 1)[:, None] * 1.0 + 1
orch *= end_g
wet = convolve(orch, IR) * .32 + convolve(stems['perc'] * .5 + stems['drums'] * .12, IR_S) * .25
music = orch * 1.25 + wet + stems['perc'] * .85 + hp(stems['synth'], 50) + stems['drums'] + stems['bass'] + stems['fx']
music = sidechain(music, kicks, .12, .12)

# duck music under the frozen-rain / slow-fist hush (102.4 – 104.0) to near silence, then slam back
hush0 = shot_t0['37 frozen rain']; flash_t = cue_t('INKFLASH')[0]
g = np.ones(len(music)); tt_ = np.arange(len(music)) / SR
g = np.where((tt_ > hush0) & (tt_ < flash_t - .02), .35, g)
g = np.convolve(g, np.ones(2400) / 2400, 'same')
music *= g[:, None]
# the whiteout: music drops to the tinnitus alone for a beat
w0 = cue_t('WHITE')[0]
g2 = np.where((tt_ > w0 + .4) & (tt_ < t_sh), .25, 1.0); g2 = np.convolve(g2, np.ones(4800) / 4800, 'same')
music *= g2[:, None]

sfx_w = sfx.x + convolve(sfx.x, IR_S) * .18
mix = music * .9 + sfx_w * .85 + stems['amb']
mix = hp(mix, 25)
mix = mix[:int(DUR * SR)]
# fade in/out
n = len(mix); fo = int(2.5 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
# master: gentle compression via soft clip, then true-peak normalise to -1 dBTP
# master: low-shelf trim, programme compressor (RMS, 4:1 above -20 dB, 10 ms / 180 ms), then soft clip
mix = mix - .35 * lp(mix, 90)
def compress(x, thr_db=-20, ratio=4.0, att=.01, rel=.18):
    lvl = np.sqrt(lp(np.mean(x ** 2, 1), 30, 1).clip(1e-12))
    env = np.zeros_like(lvl); a_a, a_r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); e = 0.0
    for i in range(0, len(lvl), 64):                         # block-wise follower (fast enough in numpy)
        v = lvl[i:i + 64].max(); c = a_a if v > e else a_r; e = c ** 64 * e + (1 - c ** 64) * v; env[i:i + 64] = e
    db = 20 * np.log10(env + 1e-9); over = np.maximum(0, db - thr_db)
    return x * (10 ** (-over * (1 - 1 / ratio) / 20))[:, None]
mix = mix / np.sqrt(np.mean(mix ** 2)) * 10 ** (-16 / 20)       # programme RMS to -16 dBFS before dynamics
mix = compress(mix)
mix = mix / np.sqrt(np.mean(mix ** 2)) * 10 ** (-13.5 / 20)
mix = np.tanh(mix * 1.15) / 1.15
tp = max(np.max(np.abs(signal.resample_poly(mix[:, c], 4, 1))) for c in range(2))
mix *= 10 ** (-1 / 20) / tp
os.makedirs(os.path.join(ROOT, 'build', 'stems'), exist_ok=True)
wavfile.write(os.path.join(ROOT, 'build', 'score.wav'), SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
for k in ('strings', 'brass', 'drums', 'choir'):
    s = stems[k][:int(DUR * SR)]; s = s / (np.max(np.abs(s)) + 1e-9) * .8
    wavfile.write(os.path.join(ROOT, 'build', 'stems', k + '.wav'), SR, (s * 32767).astype(np.int16))
print('wrote build/score.wav', len(mix) / SR, 's')
