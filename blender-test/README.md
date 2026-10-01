# Blender test: "Her Own Weather"

A 10-second shot rendered fully headless in Blender 4.5 (Cycles, CPU only, no GPU) from a single Python script.

A soldier walks through a rain-soaked neon street. Cut to a dancer under a streetlight, lost in a samba only her headphones can hear. The camera circles in, and for the last two seconds we fall into her music.

## What's real here

- **Motion capture, not keyframes.** Both characters are Mixamo rigs driven by mocap clips (Walk, SambaDance). The walk's forward speed is *measured* from the foot-plant velocity in the clip, so the feet don't slide.
- **Rain that renders deterministically.** Geometry-nodes rain: each drop's height is `(z0 − v·t) mod H`. There is no particle cache, so any frame renders on its own. Drops within 1.7 m of the lens are culled.
- **Sound built from the animation.** `motion.py` samples the mocap per frame:
  - Footsteps land on the soldier's measured foot plants.
  - The samba's tempo (102.7 bpm) and downbeat come from the FFT of the dancer's hip bob, so the music is in time with her body.
  - The headphone leak is band-limited, saturated and comb-filtered, and its level follows the camera's distance to her. It then blooms into the full-range mix.
- **Everything procedural.** Facade windows, shop interiors, shutters, wet asphalt with puddles, neon signs and street lights are all built in code.

## Run

```
pip install bpy==4.5.3        # Blender as a Python module
# put Soldier.glb + Michelle.glb (three.js examples / Mixamo) in assets/; they are not committed
python3 build.py --preview     # 960×540 look-dev scene → out/scene.blend
python3 stills.py -- 40 150    # check single frames
python3 build.py && python3 render.py   # 1280×720, 14 spp + OIDN, motion blur, ~30 s/frame on 4 CPU cores
python3 motion.py && python3 audio.py out/motion.json out/sound.wav
```

## Honest limits

- The render is 720p because there's no GPU: 1080p cost about 95 s/frame on CPU. On a rented RTX 4090 the same scene would render at 1080p or 4K in minutes.
- The characters are stock Mixamo models. A real production would use custom characters, cloth simulation and wet shaders on the skin and clothes.
