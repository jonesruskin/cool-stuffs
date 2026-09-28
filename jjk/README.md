# 墨ノ刻 — HOUR OF INK

An original 3-minute sorcery-battle short in the visual and musical language of modern shōnen
action anime (think *Jujutsu Kaisen*): a rain-soaked Shinjuku night, cursed-energy auras, a
technique duel, an impact-frame "flash", a Domain Expansion and a dawn epilogue. All the
characters, techniques, dialogue and music are original.

▶ **`hour-of-ink.mp4`**: 1920×1080, 24 fps (characters animated on twos), 3:00, stereo 48 kHz

## How it's made

| Layer | Approach |
|---|---|
| Characters | Two licensed VRM anime models, restyled in code: the hero gets a navy sorcerer uniform and boots, and the villain gets bone-white hair, crimson eyes, ashen skin and cursed markings. Both are cel-shaded (MToon) with thick outlines. |
| Animation | A hand-authored pose library (~45 poses written as body-space limb directions) with snap-and-hold timing, played **on twos** (12 poses/s) like limited TV animation; the camera moves on ones. Hair and cloth use spring bones, re-simulated from each shot's start so every frame renders deterministically. |
| World | A procedural Shinjuku: 150+ buildings with generated window, shopfront and neon kanji-sign textures, utility poles with sagging wires, vending machines, a zebra junction, wet-road light streaks, rain, a moon, and a dawn sky. The domain is a monochrome ink sea with a black sun and 50+ torii gates. |
| Anime look | A custom post pipeline with cursed-energy aura (character masks extruded upward and carved into flame tongues), bloom, colour grade, stylised **impact frames** (negative, red two-tone, white and black voids), manga speed and focus lines, chromatic aberration and grain. A 2D compositor adds kanji technique cards, subtitles, black lightning and ink wipes. |
| FX | Immediate-mode pools for toon dust, debris, glass, sparks, shockwave rings, red threads, ink blobs, spikes and pools, all functions of time. |
| Score | `music/score.py` is an original hybrid orchestral/trap score at 150 BPM in D minor. It uses sampled strings, brass, timpani, gong and temple bells from VSCO-2 CE (CC0), plus a synthesised 808, trap kit, taiko, distorted guitar, formant choir, braams and risers. Every section and hit is placed from the film's cue list. The sound design (punches, glass, thunder, thread zings, rumble, rain) is synthesised. |

## Structure (every cut sits on the 150 BPM bar grid)

| Time | Act | |
|---|---|---|
| 0:00 | I · Night | Shinjuku, 23:47. He walks; she waits on a rooftop against the moon; the title |
| 0:38 | II · Clash | Collision, exchange, through the bus shelter, air clash, rooftop block |
| 1:04 | III · Crimson Weave | Her technique: a web of red threads that slices a 69 m tower |
| 1:23 | IV · Ink Tide | His technique: a wave of ink, the shred, the combo |
| 1:42 | V · Ink Flash | Frozen rain, a slow fist, the flash: impact frames and black lightning |
| 1:55 | VI · Domain Expansion | 領域展開 · 墨海浄土 (Ink-Sea Pure Land), spikes, barrage, the spear, the tsunami |
| 2:34 | VII · Dawn | Whiteout, the shell shatters, "…So I lost.", "…I'm going home to sleep." |

## Rebuild

```bash
cd jjk && npm install                       # three, three-vrm, fonts
pip install numpy scipy imageio-ffmpeg pillow playwright
export FFMPEG=$(python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())")
# 1. export the shot list + cue sheet (build_meta.json) and render the picture
node tools/frames.cjs /tmp/check 1000,2000     # spot frames (JPEG) for review
node tools/render.cjs                           # all 61 shots -> build/film_video.mp4 (~1.5 h on 4 cores)
# 2. the score (needs VSCO-2 CE checked out; set VSCO=/path/to/VSCO-2-CE)
python3 music/score.py                          # -> build/score.wav
# 3. mux
$FFMPEG -i build/film_video.mp4 -i build/score.wav -c:v copy -c:a aac -b:a 256k -shortest hour-of-ink.mp4
```

## Credits and licences

- **Hero model:** "Seed-san" © VirtualCast, Inc., VRM Public License 1.0. Violent use and modification are allowed; credit is required.
- **Villain model:** "AvatarSample_B" © pixiv Inc. (VRoid Project), VRM Public License 1.0. Violent use, modification and redistribution are allowed.
- **Orchestral samples:** VSCO-2 Community Edition, Versilian Studios, CC0. The upright piano is by Simon Dalzell / Ivy Audio, redistributable.
- **Fonts:** Shippori Mincho B1, Noto Sans JP, Yuji Syuku, Dela Gothic One and Oswald (SIL OFL), via Fontsource.
