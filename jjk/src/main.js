// Engine: builds the world once, then renders any frame of the film as a function of its index.
import * as THREE from 'three';
import { loadCharacter, applyPose, setFace, setRim } from './chars.js';
import { P } from './poses.js';
import { buildCity, buildReflections, buildRain, buildDomain } from './world.js';
import { Post } from './post.js';
import { FX } from './fx.js';
import { Overlay } from './overlay.js';
import { SHOTS, FPS, DURATION, CUES, resetStory } from './story.js';

const W = 1920, H = 1080;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;
document.getElementById('stage').appendChild(renderer.domElement);
const overlay = new Overlay(document.getElementById('ov'), W, H, renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, W / H, .05, 2000);
camera.layers.enableAll();
const post = new Post(renderer, W, H);

async function boot() {
  await Promise.all(['900 40px "Noto Sans JP"', '800 40px "Shippori Mincho B1"', '400 40px "Yuji Syuku"', '400 40px "Dela Gothic One"', '600 40px "Oswald"']
    .map(f => document.fonts.load(f, '居酒屋カラオケ薬局ラーメン焼肉喫茶質屋ホテル寿司書店雀荘整体酒眼科新宿二十四時間占い古着将棋領域展開墨海浄土術式紅織潮閃刻東京都区ノ')));
  const city = buildCity();
  const refl = buildReflections(city);
  const rain = buildRain();
  const domain = buildDomain(); domain.visible = false;
  scene.add(city, refl, rain, domain);
  scene.fog = new THREE.FogExp2(0x0b1224, .012);

  // character lighting: cool moon key, sodium fill, two coloured neon kickers (moved per shot)
  const hemi = new THREE.HemisphereLight(0x6a7aa8, 0x201820, .85);
  const moon = new THREE.DirectionalLight(0xbfcfff, 1.6); moon.position.set(-8, 20, -6);
  const kickA = new THREE.PointLight(0xff3b6b, 4, 0, 2);
  const kickB = new THREE.PointLight(0x35c0ff, 4, 0, 2);
  const fxLight = new THREE.PointLight(0x4060ff, 0, 18, 1.5);
  const key = new THREE.DirectionalLight(0xdfe6ff, 1.3);
  scene.add(hemi, moon, moon.target, kickA, kickB, fxLight, key, key.target);

  const hero = await loadCharacter('hero');
  const villain = await loadCharacter('villain');
  scene.add(hero.root, villain.root);
  const fx = new FX(scene);

  window.ENGINE = { THREE, scene, camera, renderer, post, overlay, fx, hero, villain, city, refl, rain, domain, hemi, moon, kickA, kickB, fxLight, key, P, keyAuto: true };
  window.drawFrame = drawFrame;
  window.grabFrame = (type = 'image/jpeg', q = .9) => document.getElementById('ov').toDataURL(type, q);
  window.META = { FPS, DURATION, frames: Math.round(DURATION * FPS), shots: SHOTS.map(s => [s.name, s.t0, s.t1]), cues: CUES };
  window.READY = true;
}

// ------------------------------------------------------------------ per-frame state reset
function resetState(E) {
  const U = E.post.U;
  U.uAuraH.value.set(.25, .5, 1, 0); U.uAuraV.value.set(1, .08, .16, 0);
  U.uBloom.value = .75; U.uExposure.value = 1; U.uSat.value = 1.05; U.uContrast.value = 1.08;
  U.uLift.value.set(.008, .012, .03); U.uGain.value.set(1, 1, 1); U.uTint.value.set(1, 1, 1);
  U.uImpact.value = 0; U.uSpeed.value = 0; U.uSpeedMode.value = 0; U.uSpeedCol.value.setRGB(1, 1, 1); U.uSpeedC.value.set(.5, .5);
  U.uCA.value = .0015; U.uVignette.value = .5; U.uGrain.value = .05; U.uFlash.value = 0; U.uFade.value = 1; U.uFlashCol.value.setRGB(1, 1, 1);
  E.scene.fog.density = .012; E.scene.fog.color.setHex(0x0b1224);
  E.city.visible = true; E.refl.visible = true; E.rain.visible = true; E.domain.visible = false;
  E.rain.material.uniforms.uSpeed.value = 1; E.rain.material.uniforms.uAlpha.value = .45; E.rain.material.uniforms.uLen.value = 1;
  E.hemi.intensity = .85; E.moon.intensity = 1.2; E.moon.color.setHex(0xbfcfff);
  E.kickA.intensity = 4; E.kickB.intensity = 4; E.fxLight.intensity = 0; E.key.intensity = 1.15; E.key.color.setHex(0xdfe6ff); E.keyAuto = true;
  E.city.userData.sky.material.uniforms.uFlash.value = 0;
  for (const ch of [E.hero, E.villain]) { ch.root.visible = true; ch.root.position.set(0, 0, 0); ch.root.rotation.set(0, 0, 0); ch.root.scale.setScalar(1); }
  setRim(E.hero, new THREE.Color(0x2a46c0), 6, 0); setRim(E.villain, new THREE.Color(0xa01830), 6, 0);
  E.camera.fov = 35; E.camera.up.set(0, 1, 0); E.camera.near = .05;
  E.fx.reset();
  E.overlay.clear();
  resetStory(E);
}

// ------------------------------------------------------------------ frame driver
let last = { shot: null, frame: -99 };
function shotAt(t) { let s = SHOTS[0]; for (const x of SHOTS) if (t + 1e-6 >= x.t0) s = x; return s; }

function stepShot(E, shot, t, dt, render) {
  resetState(E);
  const lt = Math.max(0, t - shot.t0);
  const ctx = { E, t, lt, dur: shot.t1 - shot.t0, p: lt / (shot.t1 - shot.t0), shot, tq: Math.floor(lt * 12) / 12 };
  shot.fn(ctx);
  if (E.keyAuto) {
    // key light rides with the camera: above and to the left, aimed where the camera looks
    const c = E.camera, fwd = new THREE.Vector3(); c.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, c.up).normalize();
    E.key.target.position.copy(c.position).addScaledVector(fwd, 6);
    E.key.position.copy(c.position).addScaledVector(right, -4).add(new THREE.Vector3(0, 5, 0));
  }
  E.hero.vrm.update(dt); E.villain.vrm.update(dt);
  E.camera.updateProjectionMatrix();
  // keep rain and reflections anchored around the camera
  E.rain.material.uniforms.uTime.value = t;
  E.rain.material.uniforms.uCenter.value.copy(E.camera.position);
  E.city.userData.sky.material.uniforms.uTime.value = t;
  E.fx.update(t, E.camera);
  if (render) {
    E.post.U.uTime.value = t; E.post.U.uSeed.value = Math.floor(t * FPS) % 97;
    E.post.render(E.scene, E.camera);
    E.overlay.draw(ctx);
  }
}

function drawFrame(frame) {
  const E = window.ENGINE;
  const t = frame / FPS;
  const shot = shotAt(t);
  const dt = 1 / FPS;
  if (last.shot !== shot || frame !== last.frame + 1) {
    // re-simulate spring bones (hair, skirt) from the start of the shot so any frame renders identically
    E.hero.vrm.springBoneManager?.reset(); E.villain.vrm.springBoneManager?.reset();
    const f0 = Math.round(shot.t0 * FPS);
    for (let k = 0; k < 8; k++) stepShot(E, shot, shot.t0, dt, false);
    for (let f = f0; f < frame; f++) stepShot(E, shot, f / FPS, dt, false);
  }
  stepShot(E, shot, t, dt, true);
  last = { shot, frame };
}

boot().catch(e => { console.error('BOOT', e.stack || e); });
