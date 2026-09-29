// Silhouette plates for the 30-second ink test: the two characters rendered as flat black shapes on a
// transparent background (no faces, no shading), plus the screen positions of key bones per frame so
// the 2D compositor can anchor threads, energy and impacts to fists and heads.
import * as THREE from 'three';
import { loadCharacter } from './chars.js';
import { seq, cycle, place, cam, clamp, lerp, prog, E, bonePos } from './kit.js';

const W = 1920, H = 1080, FPS = 24;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, W / H, .05, 500);
const X = { camera };
let hero, villain;

function silhouette(ch) {
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  ch.vrm.scene.traverse(o => { if (o.isMesh || o.isSkinnedMesh) o.material = Array.isArray(o.material) ? o.material.map(() => black) : black; });
  // adult proportions: the VRoid heads are oversized, which is most of what read as "cute"
  ch.vrm.humanoid.getRawBoneNode('head').scale.setScalar(.8);
}
function wind(ch, x, z, power = 1) {
  const sbm = ch.vrm.springBoneManager; if (!sbm) return;
  const g = new THREE.Vector3(x, -1, z).normalize();
  sbm.joints.forEach(j => { j.settings.gravityDir.copy(g); j.settings.gravityPower = .3 + power * .6; });
}

// per-shot staging. lt = seconds into the shot.
const SH = {
  s01: { dur: 108, fn: lt => { villain.root.visible = false; place(hero, 0, 0, 0, 180);
    seq(hero, lt, [[0, 'pockets']]); const z = lerp(10, 7.2, E.io(lt / 4.5)); cam(X, [0, 1.0, z], [0, 1.25, 0], 30); } },
  s02: { dur: 36, fn: lt => { hero.root.visible = false; place(villain, 0, 0, 0, 0);
    seq(villain, lt, [[0, 'land'], [.9, 'kneel', .4, 'io']]); wind(villain, -1, .2, 1.4); cam(X, [.4, -1.2, 3.6], [0, .7, 0], 34, -4); } },
  s05: { dur: 36, fn: lt => { hero.root.visible = false; const p = lt / 1.5;
    place(villain, lerp(-3.4, 3.2, p), 1.2 + Math.sin(Math.PI * p) * 1.6, 0, 90, { pitch: -.25 });
    seq(villain, lt, [[0, 'jump']]); wind(villain, -1, 0, 1.6); cam(X, [0, -1.5, 7], [0, 2.2, 0], 38); } },
  s06: { dur: 36, fn: lt => { villain.root.visible = false; const go = E.in(prog(lt, .35, 1.5));
    place(hero, 0, 0, lerp(0, 2.2, go), 0);
    seq(hero, lt, [[0, 'stanceLow'], [.3, 'runA', .06]], { twos: true }); wind(hero, 0, -1, 1.3);
    cam(X, [.25, .45, 3.4], [0, .9, 0], 42, 3); } },
  s07: { dur: 18, fn: lt => { const a = E.out(clamp(lt / .1));
    place(hero, lerp(-1.6, -.72, a), 1.6, 0, 90, { roll: .1 }); place(villain, lerp(1.6, .72, a), 1.65, 0, -90, { roll: -.1 });
    seq(hero, lt, [[0, 'jump'], [.02, 'cross', .06]], { twos: false }); seq(villain, lt, [[0, 'jump'], [.02, 'cross', .06]], { twos: false });
    wind(hero, -1, 0, 1.5); wind(villain, 1, 0, 1.5); cam(X, [0, 1.7, 4.6], [0, 2.6, 0], 40, 6); } },
  s08: { dur: 54, fn: lt => { place(hero, -.64, 0, 0, 90); place(villain, .64, 0, 0, -90);
    seq(hero, lt, [[0, 'stance'], [.3, 'jab', .06], [.68, 'cross', .06], [1.05, 'block', .06], [1.43, 'hook', .07]], { twos: false });
    seq(villain, lt, [[0, 'stance'], [.3, 'block', .06], [.7, 'hitHead', .05], [1.05, 'crossL', .06], [1.45, 'duck', .06]], { twos: false });
    cam(X, [lerp(.4, -.2, lt / 2.25), .42, 3.1], [0, 1.25, 0], 40, lerp(4, -4, lt / 2.25)); } },
  s09: { dur: 36, fn: lt => { hero.root.visible = false; place(villain, 0, 0, 0, 0);
    const spread = { ...villain.__P.weave, la: { u: [.95, .25, .15], l: [1, .3, .1] }, ra: { u: [-.95, .25, .15], l: [-1, .3, .1] }, L: 'open', R: 'open', hd: [-12, 0, 0] };
    seq(villain, lt, [[0, 'weave'], [.25, spread, .18]]); wind(villain, 0, -1, 1.2); cam(X, [0, .6, 4.8], [0, 1.25, 0], 36); } },
  s10: { dur: 54, fn: lt => { villain.root.visible = false; const p = E.out(clamp(lt / 1.9));
    const x = lerp(2.6, -1.6, p); place(hero, x, 0, 0, -90);
    seq(hero, lt, [[0, 'runA'], [.18, 'skid', .08]]); wind(hero, 1, 0, 1);
    cam(X, [x * .6 + .2, .38, 3.3], [x * .8, .55, 0], 40, -3); } },
  s11: { dur: 36, fn: lt => { villain.root.visible = false; place(hero, 0, 0, 0, 0);
    seq(hero, lt, [[0, 'stanceLow']]); wind(hero, 0, 1, .8);
    cam(X, [.2, .9, lerp(3.4, 3.0, lt / 1.5)], [0, .95, 0], 36, -3); } },
  s12: { dur: 36, fn: lt => { place(hero, -.6, 0, 0, 90); place(villain, .56 + (lt > .12 ? E.out(prog(lt, .12, .6)) * 1.4 : 0), 0, 0, -90);
    seq(hero, lt, [[0, 'stanceLow'], [.02, 'cross', .07]], { twos: false });
    seq(villain, lt, [[0, 'block'], [.14, 'hitHead', .05]], { twos: false });
    cam(X, [-1.1, 1.05, 2.5], [.1, 1.3, 0], 36, -10); } },
  s13: { dur: 54, fn: lt => { hero.root.visible = false; const p = E.out(clamp(lt / 1.3));
    place(villain, lerp(-2.4, 3.6, p), lerp(1.4, 4.2, p), lerp(0, -5, p), 90, { pitch: .5 + p * .6 });
    seq(villain, lt, [[0, 'flyBack']]); wind(villain, -1, .5, 1.6); cam(X, [0, 1.6, 5.2], [.4, 2.6, -2], 44, 4); } },
  s14: { dur: 72, fn: lt => { villain.root.visible = false; place(hero, 0, 0, 0, 0);
    seq(hero, lt, [[0, 'stance'], [.8, 'idle', .6, 'io']]);
    cam(X, [.25, 1.2, lerp(2.6, 3.8, E.io(lt / 3))], [0, 1.15, 0], 32); } },
};

const TRACK = ['head', 'hips', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot'];
function screen(v) { const p = v.clone().project(camera); return [Math.round((p.x * .5 + .5) * W), Math.round((-p.y * .5 + .5) * H), p.z < 1 ? 1 : 0]; }

function step(id, f, render) {
  hero.root.visible = villain.root.visible = true;
  for (const ch of [hero, villain]) { ch.root.position.set(0, 0, 0); ch.root.rotation.set(0, 0, 0);
    const sbm = ch.vrm.springBoneManager; if (sbm) sbm.joints.forEach(j => { j.settings.gravityDir.set(0, -1, 0); j.settings.gravityPower = j.__g0 ?? (j.__g0 = j.settings.gravityPower); }); }
  camera.up.set(0, 1, 0);
  SH[id].fn(f / FPS);
  hero.vrm.update(1 / FPS); villain.vrm.update(1 / FPS);
  camera.updateProjectionMatrix();
  if (!render) return null;
  renderer.render(scene, camera);
  const pts = {};
  for (const [k, ch] of [['ren', hero], ['ayame', villain]]) if (ch.root.visible) { pts[k] = {}; for (const b of TRACK) pts[k][b] = screen(bonePos(ch, b)); }
  return pts;
}

window.shotList = () => Object.fromEntries(Object.entries(SH).map(([k, v]) => [k, v.dur]));
window.startShot = id => {
  for (const ch of [hero, villain]) ch.vrm.springBoneManager?.reset();
  for (let k = 0; k < 10; k++) step(id, 0, false);          // settle hair/cloth before frame 0
};
window.plateFrame = (id, f) => { const pts = step(id, f, true); return { png: renderer.domElement.toDataURL('image/png'), pts }; };

(async () => {
  hero = await loadCharacter('hero'); villain = await loadCharacter('villain');
  const { P } = await import('./poses.js'); villain.__P = P;
  silhouette(hero); silhouette(villain);
  scene.add(hero.root, villain.root);
  window.READY = true;
})().catch(e => console.error('BOOT', e.stack || e));
