# 墨ノ刻 · 30-second ink test

A 30-second fight sequence made **without a GPU or any generative AI**. It's designed around what code
can do well instead of imitating 3D anime.

▶ `hour-of-ink-30s.mp4` (1920×1080, 24 fps, stereo)

## Look

Sumi ink, paper white and vermilion, with blue cursed energy for Ren and red for Ayame. The characters
are **pure silhouettes with adult proportions**, so no cute 3D faces. Each one gets a hand-drawn "boil"
on its edges (the outline redraws every 2 frames) and an energy rim. The eye close-ups are drawn as
manga key art. The shots cut between a neon night city, a blood moon, red paper, an ensō circle and
split-colour clash frames, with impact frames, black lightning, speed lines and technique cards on top.

## Pipeline

1. **Character plates** (`../jjk/plate.html`, `../jjk/src/plate.js`, `../jjk/tools/plates.cjs`): the pose
   library and rigs from the 3-minute film are rendered as flat black silhouettes on transparent PNGs.
   Each shot also saves the per-frame screen positions of the heads, hands and hips, so the threads,
   flames and impacts stay attached to the characters.
2. **Compositing** (Remotion, `src/`): `ink.tsx` holds the drawing primitives, `scenes.tsx` the per-shot
   compositions, `fx.tsx` the anime finishing effects, and `Film.tsx` the edit, driven by `shots.json`.
3. **Score** (`../jjk/music/score30.py`): orchestral samples (VSCO-2 CE, CC0) plus synthesised drums and
   sound design, cut to the same 160 BPM bar grid as the shots (one bar is 1.5 s).

`shots.json` also carries keyframe and motion prompts for every shot. If a GPU (ComfyUI) is connected
later, generated clips can replace the silhouette scenes shot by shot, and the edit, effects and score
stay as they are.

## Rebuild

```bash
cd ../jjk && node tools/plates.cjs ../anime-test/public/plates   # character plates
python3 music/score30.py                                          # public/score30.wav
cd ../anime-test && npm install
npx remotion render Test30 out/test30.mp4 --crf=16                # add --browser-executable=… if needed
npx remotion studio                                               # scrub the edit in a browser
```
