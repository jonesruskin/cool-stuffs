// 墨ノ刻 — HOUR OF INK. The film, shot by shot. 180 s at 24 fps; every cut sits on the
// 150 BPM grid of the score (1 bar = 1.6 s, 1 beat = 0.4 s).
import * as THREE from 'three';
import { seq, cycle, place, cam, shake, E, prog, lerp, lerpV, clamp, h1, V, bonePos } from './kit.js';
import { applyPose, setFace, setRim } from './chars.js';
import { P, mirror } from './poses.js';
import { FONTS } from './overlay.js';

export const FPS = 24;
export const SHOTS = [];
export const CUES = [];            // [time, name] hits for the score + sound design
let acc = 0;
function shot(name, dur, fn, cues = []) {
  const t0 = Math.round(acc * 1e6) / 1e6; SHOTS.push({ name, t0, t1: Math.round((t0 + dur) * 1e6) / 1e6, fn }); acc = t0 + dur;
  for (const [lt, c] of cues) CUES.push([+(t0 + lt).toFixed(4), c, name]);
}
const D = Math.PI / 180;

// ------------------------------------------------------------------ helpers
const aura = (X, who, s) => { (who === 'h' ? X.post.U.uAuraH : X.post.U.uAuraV).value.w = s; };
const kick = (X, a, b) => { if (a) X.kickA.position.set(...a); if (b) X.kickB.position.set(...b); };
function sub(X, lt, a, b, jp, en) {
  if (lt < a || lt > b) return;
  const al = Math.min(1, (lt - a) / .15, (b - lt) / .15);
  X.overlay.sub(jp, en, al);
}
function impact(X, lt, t0, frames = [1, 1, 2, 2]) {
  // a run of stylised impact frames starting at t0 (each entry is one frame at 24fps)
  const f = Math.floor((lt - t0) * FPS + 1e-6);
  if (f >= 0 && f < frames.length) { X.post.U.uImpact.value = frames[f]; return true; }
  return false;
}
function flash(X, lt, t0, dur = .25, col = 0xffffff, amt = 1) {
  const p = (lt - t0) / dur; if (p < 0 || p > 1) return;
  X.post.U.uFlash.value = amt * (1 - p) * (1 - p); X.post.U.uFlashCol.value.set(col);
}
function speed(X, s, mode = 0, cx = .5, cy = .5, col = 0xffffff) {
  const U = X.post.U; U.uSpeed.value = s; U.uSpeedMode.value = mode; U.uSpeedC.value.set(cx, cy); U.uSpeedCol.value.set(col);
}
const hide = (...chs) => chs.forEach(c => c.root.visible = false);
const bld = (X, i) => X.city.userData.buildings[i];
const shakeAfter = (X, lt, t0, amt, dur = .5) => { if (lt >= t0 && lt < t0 + dur) shake(X, amt * (1 - (lt - t0) / dur), lt); };
function moonBehind(X, from, to) {
  const d = new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).normalize();
  const m = X.city.userData.moon; m.position.copy(new THREE.Vector3(...to)).addScaledVector(d, 520); m.lookAt(...from);
}
function wind(ch, x, z, power = 1) {
  const sbm = ch.vrm.springBoneManager; if (!sbm) return;
  const g = new THREE.Vector3(x, -1, z).normalize();
  sbm.joints.forEach(j => { j.settings.gravityDir.copy(g); j.settings.gravityPower = .3 + power * .6; });
}
function calmWind(ch) { const sbm = ch.vrm.springBoneManager; if (!sbm) return; sbm.joints.forEach(j => { j.settings.gravityDir.set(0, -1, 0); j.settings.gravityPower = j.__g0 ?? (j.__g0 = j.settings.gravityPower); }); }

// Buildings chosen for the fight (see world.js layout, seed 1234)
const ROOF_V = 82;   // right side, ahead of the hero: the villain's first perch   (x 11..23.4, z -32..-19.5, h 23.4)
const ROOF_A = 65;   // right side behind the junction: rooftop clash            (x 11..24.5, z 11..25.8, h 16.2)
const ROOF_B = 1;    // left side: hero's rooftop                                  (x -30..-11, z 20..33.8, h 11.7)
const TOWER = 0;     // left side 69 m tower, the one Crimson Weave slices         (x -28.6..-11, z 11..18.8)

// sliced tower: rebuilt as two boxes (UVs remapped so the facade texture stays continuous);
// the upper piece slides off the cut and topples into the street
const CUT_H = 31;
let SLICE = null;
function sliceTower(X) {
  if (SLICE) return SLICE;
  const b = bld(X, TOWER), { w, h, d } = b.userData;
  const piece = (y0, y1) => {
    const g = new THREE.BoxGeometry(w, y1 - y0, d);
    const uv = g.attributes.uv;
    for (const face of [0, 1, 4, 5]) for (let k = 0; k < 4; k++) {
      const i = face * 4 + k; uv.setY(i, (uv.getY(i) > .5 ? y1 : y0) / h);
    }
    const m = new THREE.Mesh(g, b.material); m.visible = false; X.city.add(m);
    m.position.set(b.position.x, (y0 + y1) / 2, b.position.z);
    return m;
  };
  const lower = piece(0, CUT_H), upper = piece(CUT_H, h);
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0x3a0a10 }));
  cap.rotation.x = -Math.PI / 2; cap.position.set(b.position.x, CUT_H + .02, b.position.z); cap.visible = false; X.city.add(cap);
  SLICE = { b, lower, upper, cap, h, w, base: upper.position.clone() };
  return SLICE;
}
function slicePose(X, age) {
  const S = sliceTower(X);
  const on = age >= 0;
  S.b.visible = !on; S.lower.visible = on; S.cap.visible = on; S.upper.visible = on;
  if (!on) return;
  const slide = Math.max(0, age - .15), fall = Math.max(0, age - 1.0);
  const up = S.upper; const hh = S.h - CUT_H;
  // pivot the upper block about its street-side bottom edge as it goes over
  const tilt = Math.min(1.5, .02 * slide * slide + .32 * fall * fall);
  const px = S.base.x + S.w / 2 + 1.4 * slide * slide, py = CUT_H - 4.9 * Math.max(0, fall - .3) ** 2;
  const c = Math.cos(-tilt), sn = Math.sin(-tilt);
  const lx = -S.w / 2, ly = hh / 2;                      // centre relative to the pivot
  up.position.set(px + lx * c - ly * sn, py + lx * sn + ly * c, S.base.z);
  up.rotation.set(0, 0, -tilt);
  if (py + hh < -5) up.visible = false;
}

// bus stop shelter the hero is smashed through
let SHELTER = null;
function shelter(X) {
  if (SHELTER) return SHELTER;
  const g = new THREE.Group();
  const frame = new THREE.MeshBasicMaterial({ color: 0x1a1d25 });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: .25, side: THREE.DoubleSide }));
  glass.position.set(0, 1.35, 0); g.add(glass);
  for (const x of [-1.6, 1.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.08, 2.6, .08), frame); p.position.set(x, 1.3, 0); g.add(p); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, .08, 1.4), frame); roof.position.set(0, 2.6, .6); g.add(roof);
  const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.8), new THREE.MeshBasicMaterial({ color: 0xfff1d8 })); ad.position.set(1.0, 1.3, .01); g.add(ad);
  g.position.set(7.9, 0, 34); g.rotation.y = Math.PI / 2;
  X.city.add(g); SHELTER = { g, glass };
  return SHELTER;
}

// a spreading pool of ink on the ground: glossy black disc with a ragged, rippling edge
let POOL = null;
function inkPool(X, pos, r) {
  if (!POOL) {
    POOL = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec2 vU; uniform float uT; float h(float x){ return fract(sin(x*91.7)*437.5); }
        void main(){ vec2 d = vU - .5; float a = atan(d.y, d.x); float r = length(d) * 2.;
          float e = .9 + .06 * sin(a * 7. + uT * 2.) + .04 * sin(a * 19. - uT * 3.);
          if (r > e) discard;
          float sheen = smoothstep(.0, .4, sin((r * 30.) - uT * 4.)) * .08 * r;
          float rim = smoothstep(e - .035, e - .005, r);
          vec3 c = vec3(.004, .005, .01) + sheen * vec3(.5, .6, 1.) + rim * vec3(.45, .55, .95);
          gl_FragColor = vec4(c, 1.); }` }));
    POOL.rotation.x = -Math.PI / 2; POOL.renderOrder = 2; X.scene.add(POOL);
  }
  POOL.visible = true; POOL.position.set(pos.x, .03, pos.z); POOL.scale.setScalar(r); POOL.material.uniforms.uT.value = X.post.U.uTime.value;
}

// crater decal (dark, jagged) that persists from the Ink Flash onwards
let CRATER = null;
function crater(X, pos, r) {
  if (!CRATER) {
    CRATER = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec2 vU; float h(float x){ return fract(sin(x*91.7)*437.5); }
        void main(){ vec2 d = vU - .5; float a = atan(d.y, d.x); float r = length(d) * 2.;
          float edge = .82 + .12 * h(floor(a * 9.)) ; if (r > edge) discard;
          float rim = smoothstep(edge - .12, edge, r);
          gl_FragColor = vec4(mix(vec3(.01,.012,.02), vec3(.16,.16,.2), rim) , 1.); }` }));
    CRATER.rotation.x = -Math.PI / 2; X.city.add(CRATER);
  }
  CRATER.visible = true; CRATER.position.set(pos.x, .02, pos.z); CRATER.scale.setScalar(r);
}

// ================================================================== ACT I — NIGHT (0 – 38.4)
shot('01 black', 4.8, c => { const { E: X, lt } = c;
  hide(X.hero, X.villain);
  cam(X, [0, 3, 40], [0, 3, 0]);
  X.overlay.fill('#000');
  const a = prog(lt, 1.0, 1.8) * (1 - prog(lt, 3.9, 4.6));
  X.overlay.location('東京都新宿区', 'SHINJUKU, TOKYO — 23:47', a);
});

shot('02 establish', 4.8, c => { const { E: X, lt, p } = c;
  hide(X.hero, X.villain);
  const e = E.io(p);
  cam(X, [4, lerp(46, 10, e), lerp(58, 42, e)], [0, lerp(20, 6, e), -30], 42, lerp(-4, 0, e));
  X.overlay.fill('#000', 1 - prog(lt, 0, .8));
});

const walkZ = t => 30 - t * 1.25;       // hero's walk down the street (t: seconds since 9.6)
shot('03 feet', 3.2, c => { const { E: X, lt } = c;
  hide(X.villain);
  const z = walkZ(lt); place(X.hero, 0, 0, z, 180);
  cycle(X.hero, lt, ['walkA', 'walkPass', 'walkB', 'walkPass'], 1.1);
  X.fx.shadow(0, X.hero, 0, .4, .45);
  // footfall splashes
  for (let k = 0; k < 6; k++) {
    const ft = k * .55 + .05, side = k % 2 ? -.1 : .1;
    X.fx.ring(V(side, .02, walkZ(ft) - .15), lt - ft, { r0: .05, r1: .7, dur: .6, color: 0xcfe0ff, width: .05, alpha: .6 });
    if (lt - ft >= 0 && lt - ft < .35) for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, s = (lt - ft);
      X.fx.glowDot(V(side + Math.cos(a) * s * .8, .05 + s * 1.2 - 5 * s * s, walkZ(ft) - .15 + Math.sin(a) * s * .8), .02, 0xbcd4ff, .8);
    }
  }
  kick(X, [2, .5, z - 3], [-2, .5, z + 2]);
  cam(X, [.55, .22, z - 1.6], [0, .2, z], 34, 4);
}, [[.05, 'step'], [.6, 'step'], [1.15, 'step'], [1.7, 'step'], [2.25, 'step'], [2.8, 'step']]);

shot('04 walk', 3.2, c => { const { E: X, lt } = c;
  hide(X.villain);
  const T = lt + 3.2, z = walkZ(T); place(X.hero, 0, 0, z, 180);
  cycle(X.hero, T, ['walkA', 'walkPass', 'walkB', 'walkPass'], 1.1, { face: { relaxed: .2 } });
  X.fx.shadow(0, X.hero, 0, .4, .45);
  kick(X, [-2.5, 2.5, z - 1], [2.5, 1.8, z + 1.5]);
  cam(X, [.35, 1.05, z - 2.3], [0, 1.18, z], 28, 0);
}, [[.55, 'step'], [1.1, 'step'], [1.65, 'step'], [2.2, 'step'], [2.75, 'step']]);

shot('05 look up', 3.2, c => { const { E: X, lt } = c;
  hide(X.villain);
  const stopZ = walkZ(6.4) - .6;
  place(X.hero, 0, 0, stopZ, 180);
  const up = E.io(prog(lt, .5, 1.2));
  seq(X.hero, lt, [[0, 'walkPass'], [.2, 'pockets', .3, 'io']], { extra: { head: [-24 * up, -12 * up, 0], neck: [-8 * up, 0, 0] } });
  setFace(X.hero, { angry: .15 * up, lookUp: .5 * up });
  X.fx.shadow(0, X.hero, 0, .4, .45);
  kick(X, [-2, 2.5, stopZ - 1], [2, 2, stopZ + 1.5]);
  if (lt < 1.6) cam(X, [-.6, 1.0, stopZ - 1.7], [0, 1.28, stopZ], 30, 0);
  else {
    // extreme close-up: the eye, a red glint in it
    const e = bonePos(X.hero, 'rightEye');
    cam(X, [e.x - .01, e.y + .03, e.z - .24], [e.x + .018, e.y + .028, e.z], 13, 0); X.key.intensity = .8;
    X.overlay.add((x, W, H) => { const a = prog(lt, 2.2, 2.6); x.globalAlpha = a * .8; const g = x.createRadialGradient(W * .56, H * .45, 0, W * .56, H * .45, 60); g.addColorStop(0, 'rgba(255,40,60,.9)'); g.addColorStop(1, 'rgba(255,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); });
  }
}, [[1.6, 'cut'], [2.2, 'glint']]);

function villainOnRoof(X) {
  const b = bld(X, ROOF_V); const top = b.userData.h, ex = b.position.x - b.userData.w / 2;
  return { x: ex + .7, y: top, z: -24, top, ex };
}
shot('06 villain reveal', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.hero);
  const R = villainOnRoof(X);
  place(X.villain, R.x, R.y, R.z, -60);
  seq(X.villain, lt, [[0, 'hipCock', 0, 'snap', { happy: .3 }]]);
  wind(X.villain, -.8, .4, 1.2);
  X.city.userData.buildings.forEach((q, i) => { if (i !== ROOF_V && q.position.z < -18) q.visible = false; });
  aura(X, 'v', .35);
  const cp = [lerp(-2, -1.4, E.io(p)), 1.5, lerp(11, 9.5, E.io(p))], to = [R.x, R.y + .95, R.z];
  moonBehind(X, cp, [R.x + .25, R.y + 1.25, R.z]);
  kick(X, [R.x - 3, R.y + 3, R.z + 2], [R.x + 3, R.y + 1, R.z - 3]);
  cam(X, cp, to, lerp(7.5, 6.2, E.io(p)));
  // thin threads glinting in the rain around her
  for (let i = 0; i < 7; i++) {
    const a = V(R.x - 1 + h1(i) * 2, R.y + .8 + h1(i + 9) * 1.8, R.z - 1 + h1(i + 3) * 2);
    const b = V(R.x - 8 - h1(i + 5) * 10, R.y - 4 - h1(i + 7) * 12, R.z + 8 + h1(i + 1) * 10);
    X.fx.line(a, b, .02, 0xff3048, .35 + .3 * Math.sin(lt * 6 + i));
  }
});

shot('07 villain close', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.hero);
  const R = villainOnRoof(X);
  place(X.villain, R.x, R.y, R.z, -60);
  seq(X.villain, lt, [[0, 'hipCock', 0, 'snap', { happy: .45 }], [1.9, 'hipCock', .2, 'io', { happy: .7 }]], { extra: { head: [6, -10, 8] } });
  wind(X.villain, -.8, .5, 1.4);
  aura(X, 'v', .25);
  const h = bonePos(X.villain, 'head');
  const dir = new THREE.Vector3(-Math.sin(60 * D), 0, Math.cos(60 * D));      // her facing
  const side = new THREE.Vector3(dir.z, 0, -dir.x);
  const cp = h.clone().addScaledVector(dir, .62).addScaledVector(side, .22).add(V(0, -.08, 0));
  cam(X, [cp.x + lerp(0, .03, p), cp.y, cp.z], [h.x, h.y + .02, h.z], 26, 3);
  kick(X, [h.x - 2.2, h.y + 1.2, h.z + 2], [h.x + 2.5, h.y, h.z - 2]);
  sub(X, lt, .35, 3.0, '二年生か……子供を寄越したものだな', 'A second-year… They sent me a child.');
});

shot('08 crack neck', 3.2, c => { const { E: X, lt } = c;
  hide(X.villain);
  const z = walkZ(6.4) - .6; place(X.hero, 0, 0, z, 180);
  seq(X.hero, lt, [[0, 'pockets'], [.5, 'crackNeck', .25, 'io'], [1.3, 'pockets', .2, 'io'], [2.0, 'stance', .18, 'snap', { angry: .5 }]]);
  aura(X, 'h', lerp(0, .75, prog(lt, 1.8, 3.0)));
  X.fx.shadow(0, X.hero, 0, .45, .5);
  kick(X, [-2, 2.2, z - 1.2], [2, 1.5, z + 1]);
  cam(X, [.9, 1.15, z - 2.6 + lt * .12], [0, 1.1, z], 30, -2);
  sub(X, lt, .25, 2.9, '子供で十分だ', 'A child is plenty.');
}, [[.75, 'crack'], [2.0, 'aura']]);

shot('09 she drops', 3.2, c => { const { E: X, lt } = c;
  const R = villainOnRoof(X);
  const hz = walkZ(6.4) - .6; place(X.hero, 0, 0, hz, 180);
  seq(X.hero, lt, [[0, 'stance', 0, 'snap', { angry: .5 }]]);
  aura(X, 'h', .6);
  // fall: leaves the roof at .3s, lands at 1.25s in the junction
  const t0 = .3, t1 = 1.25; const f = clamp((lt - t0) / (t1 - t0));
  const land = V(0, 0, -5);
  const px = lerp(R.x, land.x, E.io(f)), pz = lerp(R.z, land.z, E.io(f)), py = lt < t1 ? lerp(R.y, 0, f * f) + Math.sin(Math.PI * f) * 3 : 0;
  place(X.villain, px, py, pz, lt < t1 ? lerp(-60, 0, f) : 0, { pitch: lt < t1 ? -f * 1.2 : 0 });
  seq(X.villain, lt, [[0, 'hipCock'], [t0, 'jump', .15], [t1, 'land', .06, 'snap', { happy: .3 }], [2.4, 'weave', .4, 'io', { happy: .4 }]]);
  aura(X, 'v', lt > t1 ? .6 : .2);
  X.fx.dustBurst(land, lt - t1, { n: 50, spread: 4, size: 1.1, color: 0x55596a, seed: 9 });
  X.fx.ring(V(land.x, .03, land.z), lt - t1, { r1: 7, dur: .5, color: 0xd8e4ff, width: .1 });
  X.fx.debrisBurst(land, lt - t1, { n: 30, speed: 5, up: 4, size: .15, seed: 12 });
  X.fx.shadow(0, X.hero); X.fx.shadow(1, X.villain);
  flash(X, lt, .0, .35, 0xdde6ff, .5); X.city.userData.sky.material.uniforms.uFlash.value = Math.max(0, 1 - lt * 3);
  shakeAfter(X, lt, t1, 1.2, .5);
  kick(X, [3, 3, 0], [-3, 2, -4]);
  const ty = lt < t1 ? Math.max(1.2, py + .8) : 1.1;
  cam(X, [lerp(4.5, 5.2, c.p), 1.0, lerp(1.5, 2.2, c.p)], [lerp(2.5, .3, E.io(prog(lt, .2, 1.3))), ty, -5], 46, -4);
}, [[0, 'thunder'], [1.25, 'land']]);

shot('10 eye cuts', 3.2, c => { const { E: X, lt } = c;
  const hz = walkZ(6.4) - .6;
  place(X.hero, 0, 0, hz, 180); place(X.villain, 0, 0, -5, 0);
  seq(X.hero, lt, [[0, 'stance', 0, 'snap', { angry: .6 }]]);
  seq(X.villain, lt, [[0, 'weave', 0, 'snap', { happy: .35 }]]);
  const k = Math.floor(lt / .8);
  if (k === 0) {        // his eye
    const e = bonePos(X.hero, 'rightEye'); cam(X, [e.x - .03, e.y + .005, e.z - .22], [e.x, e.y, e.z], 13, 0); aura(X, 'h', .5); X.key.intensity = .8;
  } else if (k === 1) { // her eye
    const e = bonePos(X.villain, 'rightEye'), e2 = bonePos(X.villain, 'leftEye'); cam(X, [(e.x + e2.x) / 2 - .01, e.y - .005, e.z + .6], [e.x, e.y, e.z], 5.5, 0); aura(X, 'v', .5); X.key.intensity = .8;
  } else if (k === 2) { // a single raindrop falling between them
    hide(X.hero, X.villain);
    cam(X, [1.5, .9, 0], [0, .8, 0], 30);
    X.rain.material.uniforms.uSpeed.value = .03;
    const y = 1.6 - (lt - 1.6) * .8;
    X.fx.glowDot(V(0, y, 0), .05, 0xcfe0ff, 1);
    X.fx.glowDot(V(0, y + .06, 0), .03, 0xcfe0ff, .5);
  } else {              // fist clenching
    const hp = bonePos(X.hero, 'rightHand');
    seq(X.hero, lt - 2.4, [[0, { ...P.stance, R: 'claw' }], [.35, 'stance', .15]]);
    X.hero.vrm.update(0);
    const hp2 = bonePos(X.hero, 'rightHand');
    cam(X, [hp2.x + .35, hp2.y + .1, hp2.z - .25], [hp2.x, hp2.y, hp2.z], 24, 8);
    aura(X, 'h', .8);
  }
}, [[0, 'eye'], [.8, 'eye'], [1.6, 'drop'], [2.4, 'clench'], [2.75, 'clench']]);

shot('11 vanish', 1.6, c => { const { E: X, lt } = c;
  const hz = walkZ(6.4) - .6;
  place(X.hero, 0, 0, hz, 180); place(X.villain, 0, 0, -5, 0);
  seq(X.hero, lt, [[0, 'stance'], [.55, 'runA', .06]]); seq(X.villain, lt, [[0, 'weave'], [.55, 'runA', .06]]);
  X.rain.material.uniforms.uSpeed.value = lt < .5 ? .03 : 1;
  X.fx.ring(V(0, .02, 0), lt - .3, { r1: 1.4, dur: .7, color: 0xcfe0ff, width: .06, alpha: .9 });
  if (lt < .3) X.fx.glowDot(V(0, .1 + (.3 - lt) * .8, 0), .05, 0xcfe0ff, 1);
  if (lt >= .62) { hide(X.hero, X.villain); }
  X.fx.dustBurst(V(0, 0, hz), lt - .62, { n: 24, spread: 1.5, size: .8, color: 0x7d8296, seed: 21 });
  X.fx.dustBurst(V(0, 0, -5), lt - .62, { n: 24, spread: 1.5, size: .8, color: 0x7d8296, seed: 22 });
  aura(X, 'h', .7); aura(X, 'v', .7);
  if (lt > .62 && lt < 1.1) speed(X, .45, 1, 1, 0);
  X.fx.shadow(0, X.hero); X.fx.shadow(1, X.villain);
  cam(X, [7, .9, (hz - 5) / 2], [0, .9, (hz - 5) / 2], 40, -4);
  shakeAfter(X, lt, .62, .8, .4);
}, [[.3, 'drip'], [.62, 'vanish']]);

shot('12 title', 1.6, c => { const { E: X, lt } = c;
  hide(X.hero, X.villain);
  X.overlay.fill('#050404');
  const s = 1 + .25 * Math.pow(1 - E.expo(prog(lt, 0, .3)), 2);
  X.overlay.add((x, W, H) => {
    x.save(); x.translate(W / 2, H / 2); x.scale(s, s); x.translate(-W / 2, -H / 2);
    x.fillStyle = '#a3101c'; x.beginPath(); x.moveTo(W * .2, H * .38); x.lineTo(W * .82, H * .33); x.lineTo(W * .8, H * .63); x.lineTo(W * .18, H * .66); x.closePath(); x.fill();
    x.restore();
  });
  X.overlay.title('墨ノ刻', 'HOUR OF INK', 1, { size: 250 * s, spacing: 40 });
}, [[0, 'title']]);

// ================================================================== ACT II — CLASH (38.4 – 64.0)
shot('13 collision', 1.6, c => { const { E: X, lt } = c;
  const hit = .25;
  const a = E.in(clamp(lt / hit));
  place(X.hero, 0, 0, lerp(6, .75, a), 180); place(X.villain, 0, 0, lerp(-6, -.75, a), 0);
  seq(X.hero, lt, [[0, 'runA'], [hit - .08, 'cross', .06]], { twos: false });
  seq(X.villain, lt, [[0, 'runB'], [hit - .08, 'cross', .06, 'snap', { angry: .5 }]], { twos: false });
  aura(X, 'h', 1); aura(X, 'v', 1);
  const ip = V(0, 1.2, 0);
  impact(X, lt, hit, [1, 1, 2, 2, 4]);
  X.fx.ring(V(0, .03, 0), lt - hit, { r1: 11, dur: .55, color: 0xe0ecff, width: .14 });
  X.fx.ring(ip, lt - hit, { r1: 5, dur: .35, color: 0xffffff, normal: V(0, 0, 1), width: .2 });
  X.fx.dustBurst(V(0, 0, 0), lt - hit, { n: 70, spread: 7, size: 1.2, color: 0x8a90a8, seed: 31 });
  X.fx.sparks(ip, lt - hit, { n: 40, speed: 12, color: 0xffe0b0, seed: 5 });
  X.fx.shadow(0, X.hero); X.fx.shadow(1, X.villain);
  if (lt < hit) speed(X, 1, 0, .5, .55);
  else speed(X, .6 * (1 - prog(lt, hit, 1.2)), 0, .5, .55, 0x000000);
  shakeAfter(X, lt, hit, 2.2, .9);
  kick(X, [0, 2, 0], [0, 1, 2]); X.fxLight.position.copy(ip); X.fxLight.intensity = lt > hit ? 40 * Math.exp(-(lt - hit) * 4) : 0;
  cam(X, [4.2, .6, 1.2], [0, 1.2, 0], 34, -8);
}, [[.25, 'IMPACT']]);

// rapid exchange: each key is a new strike landing on the beat grid (0.2 s = 8th notes)
const EX_H = [[0, 'stance'], [.2, 'block', .06], [.4, 'hook', .07], [.8, 'jab', .06], [1.0, 'cross', .06], [1.4, 'block', .06], [1.8, 'uppercut', .08], [2.1, 'stance', .2, 'io']];
const EX_V = [[0, 'stance'], [.2, 'jab', .06], [.4, 'duck', .07], [.8, 'block', .06], [1.0, 'hitHead', .06], [1.4, 'elbow', .06], [1.8, 'dodgeBack', .08], [2.1, 'stance', .2, 'io']];
shot('14 exchange', 2.4, c => { const { E: X, lt, p } = c;
  place(X.hero, -.62, 0, 0, 90); place(X.villain, .62, 0, 0, -90);
  seq(X.hero, lt, EX_H, { twos: false }); seq(X.villain, lt, EX_V, { twos: false });
  aura(X, 'h', .7); aura(X, 'v', .7);
  for (const [ht, y] of [[.2, 1.35], [.4, 1.3], [1.0, 1.35], [1.4, 1.3], [1.8, 1.45]]) {
    X.fx.sparks(V(0, y, 0), lt - ht, { n: 16, speed: 7, dur: .3, color: 0xfff0d0, seed: Math.round(ht * 10) });
    X.fx.ring(V(0, y, 0), lt - ht, { r1: 1.2, dur: .2, normal: V(1, 0, 0), color: 0xffffff, width: .2 });
    if (impact(X, lt, ht, [1])) {}
  }
  speed(X, .55, 1, 1, 0);
  X.fx.shadow(0, X.hero); X.fx.shadow(1, X.villain);
  kick(X, [0, 3, 2], [0, 1, -2]);
  cam(X, [lerp(-.3, .3, p), 1.25, 3.3], [0, 1.2, 0], 34, lerp(3, -3, p));
  for (const ht of [.2, .4, 1.0, 1.4, 1.8]) shakeAfter(X, lt, ht, .5, .15);
}, [[.2, 'hit'], [.4, 'hit'], [.8, 'whiff'], [1.0, 'hit'], [1.4, 'hit'], [1.8, 'hit']]);

shot('15 roundhouse', 1.6, c => { const { E: X, lt } = c;
  place(X.hero, 0, 0, .8, 180); place(X.villain, 0, 0, -.6, 0);
  seq(X.hero, lt, [[0, 'stance'], [.25, 'roundhouseL', .1], [.9, 'stance', .25, 'io']], { twos: false });
  seq(X.villain, lt, [[0, 'stance'], [.28, 'duck', .06, 'snap', { happy: .5 }], [1.0, 'duck']]);
  aura(X, 'h', .6); aura(X, 'v', .6);
  // kick smear arc
  if (lt > .28 && lt < .5) {
    const k = (lt - .28) / .22;
    for (let i = 0; i < 6; i++) {
      const a0 = -1.2 + (k - i * .06) * 2.4, a1 = a0 + .25;
      if (a1 < -1.2) continue;
      X.fx.inkLine(V(Math.sin(a0) * 1.1, 1.35, .8 - Math.cos(a0) * 1.1 * .3), V(Math.sin(a1) * 1.1, 1.35, .8 - Math.cos(a1) * 1.1 * .3), .25 * (1 - i / 6), 0xeef3ff, .8 * (1 - i / 6));
    }
  }
  X.fx.shadow(0, X.hero); X.fx.shadow(1, X.villain);
  kick(X, [2, 2.5, 0], [-2, .8, 1]);
  cam(X, [2.4, .35, -1.8], [0, 1.1, .1], 32, 10);
}, [[.3, 'swoosh']]);

shot('16 knee', 1.6, c => { const { E: X, lt } = c;
  const hit = .3;
  place(X.hero, 0, 0, .55 + (lt > hit ? E.out(prog(lt, hit, .8)) * .5 : 0), 180); place(X.villain, 0, 0, -.45, 0);
  seq(X.villain, lt, [[0, 'duck'], [.12, 'knee', .12, 'snap', { angry: .7 }]]);
  seq(X.hero, lt, [[0, 'stance'], [hit, 'hitGut', .04, 'snap', { angry: .3, blink: .7 }]]);
  aura(X, 'v', .9);
  impact(X, lt, hit, [2, 2, 1, 4]);
  const ip = V(0, 1.0, .2);
  X.fx.ring(ip, lt - hit, { r1: 2, dur: .25, normal: V(0, 0, 1), color: 0xffffff, width: .25 });
  // spit
  for (let i = 0; i < 6; i++) { const s = lt - hit; if (s > 0 && s < .6) X.fx.glowDot(V((h1(i) - .5) * .3 + s * (h1(i + 4) - .5), 1.35 + s * 1.2 - 4 * s * s, .5 + s * 1.5), .02, 0xe8eeff, .9); }
  X.fx.shadow(0, X.hero); X.fx.shadow(1, X.villain);
  shakeAfter(X, lt, hit, 1.6, .5);
  if (lt > hit) speed(X, .6, 0, .45, .5);
  kick(X, [-2, 1.5, 1], [2, 2, -1]);
  cam(X, [-2.3, 1.0, .1], [0, 1.1, .05], 30, -6);
}, [[.3, 'HIT_GUT']]);

shot('17 through glass', 2.4, c => { const { E: X, lt } = c;
  const S = shelter(X);
  hide(X.villain);
  // hero flies back (+z, drifting to the right sidewalk), through the shelter at .9 s
  const f = E.out(clamp(lt / 1.6));
  const x = lerp(0, 9.5, f), z = lerp(3, 36, f), y = lt < 1.6 ? 1.1 + Math.sin(Math.PI * f) * .8 - (lt > 1.4 ? (lt - 1.4) * 3 : 0) : .2;
  place(X.hero, x, Math.max(.2, y - 1.1 + .3), z, 200, { pitch: -.3 });
  seq(X.hero, lt, [[0, 'flyBack', 0, 'snap', { angry: .3, blink: 1 }]]);
  S.glass.visible = lt < .9;
  X.fx.glassBurst(V(7.9, 1.3, 34), lt - .9, { n: 140, speed: 7, dir: V(.6, .2, 1), seed: 41 });
  X.fx.dustBurst(V(8, .1, 35), lt - .95, { n: 20, spread: 2, size: .7, color: 0x7a7f92, seed: 42 });
  shakeAfter(X, lt, .9, 1.2, .4);
  impact(X, lt, .9, [3]);
  speed(X, .5, 0, .5, .5);
  kick(X, [x - 2, 3, z - 2], [x + 2, 1, z + 2]);
  cam(X, [lerp(-1.5, 4, f), 1.4, lerp(-.5, 27, f)], [x, 1.1, z], 38, 6);
}, [[.9, 'GLASS']]);

shot('18 skid', 1.6, c => { const { E: X, lt } = c;
  hide(X.villain);
  shelter(X).glass.visible = false;
  const f = E.out(clamp(lt / 1.1));
  const z = lerp(37, 43, f), x = 9.3;
  place(X.hero, x - 1.6, 0, z, 180);
  seq(X.hero, lt, [[0, 'skid', 0, 'snap', { angry: .7 }], [1.2, 'skid', .1, 'snap', { angry: .9 }]]);
  // spray + sparks off the dragging hand
  const hp = V(x - 1.2, .05, z - .3);
  if (lt < 1.1) {
    X.fx.dustBurst(V(x - 1.6, 0, z - 1.2), lt, { n: 18, spread: 1.4, size: .5, color: 0xb9c8e6, seed: 51, dur: 1.4 });
    X.fx.sparks(hp, (lt * 3) % .3, { n: 10, speed: 4, dur: .3, color: 0xffd28a, seed: 52 + Math.floor(lt * 10) });
  }
  aura(X, 'h', .4 + lt * .3);
  X.fx.shadow(0, X.hero);
  kick(X, [x - 3, 2, z + 2], [x, 1, z - 3]);
  cam(X, [x - 2.2, .35, z + 2.4], [x - 1.6, .6, z], 30, -4);
}, [[0, 'skid']]);

shot('19 ink fist', 3.2, c => { const { E: X, lt } = c;
  hide(X.villain);
  const x = 7.7, z = 43;
  place(X.hero, x, 0, z, 180);
  seq(X.hero, lt, [[0, 'skid', 0, 'snap', { angry: .9 }], [.6, 'stanceLow', .35, 'io', { angry: 1 }], [2.5, 'runA', .06, 'snap', { angry: 1 }]]);
  aura(X, 'h', lerp(.6, 1.3, prog(lt, .6, 2.3)));
  X.post.U.uBloom.value = 1.1;
  // ink boiling around the right fist
  X.hero.vrm.update(0);
  const fp = bonePos(X.hero, 'rightHand');
  const g = prog(lt, .9, 2.0);
  if (g > 0 && lt < 2.55) {
    for (let i = 0; i < 6; i++) X.fx.blob(V(fp.x + Math.sin(i * 2 + lt * 3) * .12 * g, fp.y + Math.cos(i * 3 + lt * 4) * .1 * g, fp.z + Math.sin(i + lt * 5) * .1 * g), .07 + .06 * g * h1(i), { t: lt * 2 + i, amp: .5, freq: 2, rim: 0x4a70ff });
    for (let i = 0; i < 30; i++) { const a = h1(i) * 6.28, r = (.1 + h1(i + 3) * .35) * g, up = ((lt * .8 + h1(i + 7)) % 1); X.fx.inkDrop(V(fp.x + Math.cos(a) * r, fp.y + up * .6, fp.z + Math.sin(a) * r), .015 + h1(i + 9) * .02, 1 - up, i); }
  }
  X.fx.shadow(0, X.hero);
  kick(X, [x - 2, 2, z - 2], [x + 2, 1, z + 1]);
  X.fxLight.position.copy(fp); X.fxLight.intensity = 10 * g;
  const push = E.io(prog(lt, .3, 2.5));
  cam(X, [x - lerp(2.2, 1.0, push), lerp(.9, 1.0, push), z - lerp(2.4, 1.2, push)], [x - .1, 1.0, z], lerp(34, 26, push), lerp(-4, 2, push));
  if (lt > 2.5) { speed(X, 1, 0, .5, .5); X.fx.dustBurst(V(x, 0, z), lt - 2.55, { n: 30, spread: 2.5, size: .9, seed: 55 }); shake(X, .8, lt); }
}, [[.6, 'rise'], [1.0, 'inkboil'], [2.55, 'DASH']]);

shot('20 parallel run', 1.6, c => { const { E: X, lt, p } = c;
  const z = -lt * 16 + 20;
  place(X.hero, -1.2, 0, z, 180); place(X.villain, 1.2, 0, z - .6, 180);
  cycle(X.hero, lt, ['runA', 'runB'], .36, { twos: false, face: { angry: 1 } });
  cycle(X.villain, lt, ['runB', 'runA'], .36, { twos: false, face: { happy: .6 } });
  aura(X, 'h', .9); aura(X, 'v', .9);
  speed(X, .7, 0, .5, .5, 0xdfe8ff);
  X.rain.material.uniforms.uLen.value = 3;
  X.fx.shadow(0, X.hero); X.fx.shadow(1, X.villain);
  kick(X, [-4, 3, z], [4, 3, z]);
  cam(X, [-.2, 1.2, z - 4.2], [0, 1.1, z], 40, 3 * Math.sin(lt * 9));
}, [[0, 'run']]);

shot('21 air clash', 3.2, c => { const { E: X, lt, p } = c;
  // leap onto the facades, meet in the air above the junction
  const b = bld(X, ROOF_A);
  const top = b.userData.h;
  const H = V(-2, 0, 0), Vv = V(2, 0, 0);
  const jump = (lt2, from, peak) => { const f = clamp(lt2 / 1.0); return lerp(from, peak, E.out(f)); };
  const yH = jump(lt, 0, 8.5), yV = jump(lt - .05, 0, 8.7);
  const meet = E.io(prog(lt, .6, 1.2));
  place(X.hero, lerp(-5, -.8, meet), yH, 12, 90, { roll: .1 });
  place(X.villain, lerp(5, .8, meet), yV, 12, -90, { roll: -.1 });
  seq(X.hero, lt, [[0, 'jump'], [1.05, 'cross', .06, 'snap', { angry: 1 }], [1.6, 'block', .08], [2.2, 'roundhouse', .08], [2.8, 'jump', .2]]);
  seq(X.villain, lt, [[0, 'jump'], [1.05, 'block', .06, 'snap', { happy: .5 }], [1.6, 'cross', .08], [2.2, 'block', .08], [2.8, 'jump', .2]]);
  aura(X, 'h', 1); aura(X, 'v', 1);
  for (const ht of [1.1, 1.65, 2.25]) {
    X.fx.ring(V(0, 9.8, 12), lt - ht, { r1: 5, dur: .35, normal: V(1, 0, 0), color: 0xffffff, width: .25 });
    X.fx.sparks(V(0, 9.8, 12), lt - ht, { n: 30, speed: 10, seed: Math.round(ht * 7) });
    shakeAfter(X, lt, ht, 1, .3);
  }
  impact(X, lt, 1.1, [1, 2]); impact(X, lt, 2.25, [4, 1]);
  const orbit = lerp(-.8, 1.6, E.io(p));
  cam(X, [Math.sin(orbit) * 4.2, 9.8 + Math.sin(p * 3) * .5, 12 + Math.cos(orbit) * 4.2], [0, 9.7, 12], 38, 10 * Math.sin(p * 4));
  kick(X, [0, 12, 14], [0, 8, 10]);
}, [[.1, 'leap'], [1.1, 'IMPACT'], [1.65, 'hit'], [2.25, 'IMPACT']]);

shot('22 roof block', 3.2, c => { const { E: X, lt } = c;
  const b = bld(X, ROOF_A); const top = b.userData.h; const cx = b.position.x, cz = b.position.z;
  const hit = .45;
  const slide = E.out(prog(lt, hit, 1.6)) * 5;
  place(X.hero, cx - 3.5, top, cz, 90);
  place(X.villain, cx - 2.3 + slide, top, cz, -90);
  seq(X.hero, lt, [[0, 'runA'], [.3, 'cross', .08, 'snap', { angry: 1 }], [1.8, 'stance', .3, 'io', { angry: .8 }]]);
  seq(X.villain, lt, [[0, 'block', 0, 'snap', { angry: .4 }], [hit, 'block', .05, 'snap', { angry: .8 }], [1.9, 'stanceLow', .3, 'io', { happy: .2 }]]);
  aura(X, 'h', 1.1); aura(X, 'v', .8);
  impact(X, lt, hit, [1, 1, 2]);
  const ip = V(cx - 2.8, top + 1.3, cz);
  X.fx.ring(ip, lt - hit, { r1: 3, dur: .3, normal: V(1, 0, 0), color: 0x9fb8ff, width: .3 });
  for (let i = 0; i < 12; i++) if (lt > hit && lt < 1.6) X.fx.dustBurst(V(cx - 2.3 + E.out(prog(lt - i * .06, hit, 1.6)) * 5, top, cz), lt - hit - i * .06, { n: 3, spread: .6, size: .5, dur: 1.2, seed: 60 + i });
  X.fx.sparks(V(cx - 2.2 + slide, top + .05, cz), lt - hit, { n: 20, speed: 5, dur: 1, seed: 61 });
  X.fx.shadow(0, X.hero, top); X.fx.shadow(1, X.villain, top);
  shakeAfter(X, lt, hit, 1.4, .5);
  kick(X, [cx - 3, top + 3, cz + 3], [cx, top + 1.5, cz - 3]);
  cam(X, [cx - 1.2 + slide * .4, top + .45, cz + 5.2], [cx - 2.3 + slide * .5, top + 1.1, cz], 40, -4);
}, [[.45, 'IMPACT'], [.5, 'slide']]);

shot('23 she laughs', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.hero);
  const b = bld(X, ROOF_A); const top = b.userData.h; const cx = b.position.x, cz = b.position.z;
  place(X.villain, cx + 2.7, top, cz, -90);
  const wipe = { ...P.stanceLow, ra: { u: [-.25, -.3, .9], l: [.55, .7, .45] }, R: 'relaxed' };
  seq(X.villain, lt, [[0, 'stanceLow', 0, 'snap', { happy: .2 }], [.4, wipe, .3, 'io', { happy: .3 }], [1.4, 'hipCock', .5, 'io', { happy: 1 }]], { extra: { head: [0, 0, lt > 1.4 ? 10 : 0] } });
  aura(X, 'v', lerp(.4, .9, prog(lt, 1.4, 3)));
  const h = bonePos(X.villain, 'head');
  cam(X, [h.x - .9, h.y - .05, h.z + .35], [h.x, h.y - .02, h.z], lerp(28, 22, E.io(p)), 4);
  kick(X, [h.x - 2.5, h.y + 1.5, h.z + 2], [h.x + 2.5, h.y - .5, h.z - 2]);
  sub(X, lt, 1.3, 3.1, 'いいね……少しは楽しめそうだ', "Good… Now this might actually be fun.");
}, [[1.4, 'laugh']]);

// ================================================================== ACT III — CRIMSON WEAVE (64 – 83.2)
function webAnchors() {
  // anchor points on facades around the junction the threads spring to
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1, z = -30 + h1(i + 2) * 70, y = 4 + h1(i + 5) * 30;
    pts.push(V(side * 11, y, z));
  }
  return pts;
}
const ANCH = webAnchors();
shot('24 threads', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.hero);
  const b = bld(X, ROOF_A); const top = b.userData.h; const cx = b.position.x, cz = b.position.z;
  place(X.villain, cx + 2.7, top, cz, -90);
  seq(X.villain, lt, [[0, 'hipCock', 0, 'snap', { happy: .6 }], [.3, 'weave', .3, 'io', { happy: .6 }]]);
  aura(X, 'v', 1.2);
  wind(X.villain, .6, .2, 1.4);
  X.villain.vrm.update(0);
  const hand = bonePos(X.villain, 'rightHand');
  ANCH.forEach((a, i) => {
    const g = clamp((lt - .5 - i * .06) / .5);
    if (g <= 0) return;
    const tip = hand.clone().lerp(a, E.out(g));
    X.fx.line(hand, tip, .045, 0xff2040, .9);
    X.fx.glowDot(tip, .12, 0xff5060, .8 * (1 - g * .5));
  });
  X.fxLight.position.copy(hand); X.fxLight.color.setHex(0xff2040); X.fxLight.intensity = 12;
  const e = E.io(p);
  cam(X, [cx + lerp(.2, -6, e), top + lerp(1.4, 2.6, e), cz + lerp(2.4, 7, e)], [cx + 2.4, top + lerp(1.4, 2.2, e), cz], lerp(30, 46, e), lerp(0, 6, e));
  kick(X, [cx, top + 3, cz + 3], [cx + 4, top + 1, cz - 3]);
}, [[.3, 'weave'], [.5, 'threads']]);

shot('25 card crimson', 1.6, c => { const { E: X, lt } = c;
  hide(X.hero);
  const b = bld(X, ROOF_A); const top = b.userData.h; const cx = b.position.x, cz = b.position.z;
  place(X.villain, cx + 2.7, top, cz, -90);
  seq(X.villain, lt, [[0, 'weave', 0, 'snap', { happy: .8 }]]);
  aura(X, 'v', 1.3);
  const h = bonePos(X.villain, 'head');
  cam(X, [h.x - 2.2, h.y - .6, h.z - .8], [h.x, h.y - .4, h.z], 30, -10);
  X.post.U.uImpact.value = 2; X.post.U.uImpactCol.value.setHex(0xd8d0c8);
  X.overlay.technique('紅織', 'CRIMSON WEAVE', lt / 1.6, { slab: '#a8101c', side: 'right' });
}, [[0, 'CARD']]);

shot('26 tower sliced', 3.2, c => { const { E: X, lt, p } = c;
  const B1 = bld(X, ROOF_B), top = B1.userData.h;
  place(X.hero, -14, top, 22, 60);
  seq(X.hero, lt, [[0, 'stance'], [1.0, 'jump', .1, 'snap', { surprised: .6 }], [2.2, 'land', .06]]);
  hide(X.villain);
  const jf = clamp((lt - 1.0) / 1.2);
  if (lt > 1.0) place(X.hero, lerp(-14, -18, jf), top + Math.sin(Math.PI * jf) * 4, lerp(22, 29, jf), 20, { pitch: lt < 2.2 ? -jf * 6.28 : 0 });
  aura(X, 'h', .9);
  // threads snap taut across the tower, then it slides apart
  const tw = bld(X, TOWER);
  for (let i = 0; i < 5; i++) {
    const y = 26 + i * 2.2 + (i - 2) * 1.5;
    const a = V(-10.8, y + 3.5, 11), b2 = V(-10.8, y - 3, 19.2);
    const al = lt < .9 ? prog(lt, .2 + i * .08, .5 + i * .08) : Math.max(0, 1 - (lt - .9) * 2);
    if (al > 0) X.fx.line(a, b2, .09, 0xff2040, al);
  }
  slicePose(X, lt - .9);
  if (lt > .85) {
    const a = prog(lt, .85, 1.0), fade = 1 - prog(lt, 2.2, 3.0);
    const y0 = CUT_H;
    X.fx.line(V(-10.9, CUT_H, 11), V(-10.9, CUT_H, 11 + 7.8 * a), .4, 0xff2040, fade);
    X.fx.line(V(-10.9, CUT_H, 18.9), V(-10.9 - 17.6 * a, CUT_H, 18.9), .4, 0xff2040, fade);
    for (let k = 0; k < 4; k++) X.fx.dustBurst(V(-10.5, CUT_H, 11.5 + k * 2.2), lt - 1.1 - k * .08, { n: 10, spread: 2.5, size: 1.6, rise: -1.5, color: 0x6a6e80, seed: 300 + k, dur: 2.2, flat: false });
    X.fx.debrisBurst(V(-10.5, CUT_H, 15), lt - 1.1, { n: 50, speed: 5, up: 1, size: .5, seed: 310, dir: V(1, 0, 0), spread: .6 });
    X.fx.sparks(V(-10.9, y0, 15), lt - .9, { n: 60, speed: 12, dur: .8, color: 0xff6070, seed: 77, size: .15, len: 1.2 });
  }
  X.fx.dustBurst(V(-14, 30, 15), lt - .95, { n: 30, spread: 5, size: 2, color: 0x6a6e80, seed: 71, flat: false });
  X.fx.debrisBurst(V(-12, 30, 15), lt - .95, { n: 60, speed: 6, up: 3, size: .4, seed: 72 });
  flash(X, lt, .9, .2, 0xff4050, .5);
  shakeAfter(X, lt, .9, .8, .6);
  X.fx.shadow(0, X.hero, top);
  kick(X, [-14, top + 3, 25], [-10, top + 2, 20]);
  if (lt < .85) cam(X, [-11.5, top + .6, 25.5], [-14.5, top + 2.2, 20.5], 36, -6);
  else { X.city.userData.buildings.forEach((q, i) => { if (i !== TOWER && q.position.x < -11 && q.position.z < 11 && q.position.z > -40) q.visible = false; }); cam(X, [lerp(5, 4, p), lerp(12, 16, p), 40], [-14, lerp(38, 34, p), 14], 50, 2); }
}, [[.3, 'taut'], [.9, 'SLICE'], [1.0, 'jump']]);

shot('27 dodge threads', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.villain);
  const B1 = bld(X, ROOF_B), top = B1.userData.h;
  const x = lerp(-18, -22, p), z = lerp(29, 24, p);
  const flip = prog(lt, 1.1, 1.7);
  place(X.hero, x, top + Math.sin(Math.PI * flip) * 2.2, z, 150, { pitch: -flip * 6.28 });
  seq(X.hero, lt, [[0, 'land'], [.3, 'stanceLow', .1], [.7, 'dodgeBack', .06], [1.1, 'jump', .06], [1.75, 'land', .05], [2.2, 'duck', .06], [2.7, 'stanceLow', .1]]);
  aura(X, 'h', 1);
  // threads sweeping through the frame (each sweep = one slash on the beat)
  for (let i = 0; i < 6; i++) {
    const t0 = .6 + i * .4, k = (lt - t0) / .25;
    if (k < 0 || k > 1.8) continue;
    const y = top + .6 + h1(i) * 1.8, a = -1.2 + k * 2.4;
    const cA = V(x - 8, y + Math.sin(a) * 3, z - 6), cB = V(x + 8, y - Math.sin(a) * 3, z + 6);
    X.fx.line(cA, cB, .07, 0xff2040, Math.min(1, 1.8 - k));
    X.fx.sparks(V(x, y, z), lt - t0 - .1, { n: 10, speed: 5, dur: .3, color: 0xff6070, seed: 80 + i });
  }
  X.fx.shadow(0, X.hero, top);
  kick(X, [x, top + 3, z + 3], [x - 3, top + 1, z - 2]);
  cam(X, [x + 3.4, top + 1.1, z + 3.2], [x, top + 1, z], 36, -6 + 12 * Math.sin(p * 3));
  shakeAfter(X, lt, 1.1, .5, .3);
}, [[.6, 'slash'], [1.0, 'slash'], [1.1, 'flip'], [1.4, 'slash'], [1.8, 'slash'], [2.2, 'slash'], [2.6, 'slash']]);

shot('28 collapse', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.villain);
  const B1 = bld(X, ROOF_B), top = B1.userData.h;
  slicePose(X, lt + 2.3);
  place(X.hero, -24 + lt * 2.5, top, 30, 90);
  cycle(X.hero, lt, ['runA', 'runB'], .4, { face: { angry: .8 } });
  aura(X, 'h', .9);
  X.fx.dustBurst(V(-12, 0, 16), lt - .6, { n: 90, spread: 22, size: 6, rise: 3, color: 0x5d6274, seed: 91, dur: 3.5 });
  X.fx.debrisBurst(V(-8, 2, 15), lt - .6, { n: 120, speed: 14, up: 8, size: .8, seed: 92 });
  X.fx.ring(V(-10, .1, 15), lt - .6, { r1: 30, dur: 1, color: 0xc0c8e0, width: .1 });
  shakeAfter(X, lt, .6, 2, 1.2);
  flash(X, lt, .6, .3, 0xffffff, .3);
  cam(X, [6, 18, 78], [-16, 16, 14], 42, 2);
}, [[.6, 'COLLAPSE']]);

shot('29 cheek cut', 1.6, c => { const { E: X, lt } = c;
  hide(X.villain);
  const B1 = bld(X, ROOF_B), top = B1.userData.h;
  place(X.hero, -20, top, 30, 110);
  seq(X.hero, lt, [[0, 'stanceLow', 0, 'snap', { angry: .7 }], [.5, 'stanceLow', .04, 'snap', { angry: 1, blinkLeft: .8 }]], { extra: { head: [0, lt > .5 ? 14 : 0, 0] } });
  aura(X, 'h', .8);
  const h = bonePos(X.hero, 'head');
  const fwd = V(Math.sin(110 * D), 0, Math.cos(110 * D));
  const cp = h.clone().addScaledVector(fwd, .55).add(V(0, .02, 0));
  cam(X, [cp.x, cp.y, cp.z], [h.x, h.y + .02, h.z], 24, 6);
  // the thread whips past the lens
  if (lt > .3 && lt < .6) { const k = (lt - .3) / .3; X.fx.line(h.clone().add(V(-2, .3 - k, 1)), h.clone().add(V(2, -.3 - k, -1)), .03, 0xff2040, 1); }
  // blood line + drops on his cheek (drawn on the overlay where his cheek sits)
  if (lt > .5) {
    const a = prog(lt, .5, .7);
    X.overlay.add((x, W, H) => {
      x.strokeStyle = 'rgba(170,10,20,.95)'; x.lineWidth = 5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(W * .43, H * .5); x.lineTo(W * .43 + 110 * a, H * .5 + 22 * a); x.stroke();
      for (let i = 0; i < 3; i++) { const dy = Math.max(0, lt - .8 - i * .15) * 180; if (dy > 0) { x.fillStyle = 'rgba(150,8,18,.95)'; x.beginPath(); x.ellipse(W * .45 + i * 30, H * .51 + dy, 5, 8, 0, 0, 6.28); x.fill(); } }
    });
  }
  kick(X, [h.x + 2.5, h.y + 1.5, h.z], [h.x - 2.5, h.y, h.z - 2]); X.key.intensity = .85;
}, [[.4, 'whip'], [.5, 'cut']]);

shot('30 stance', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.villain);
  // back down in the street: he plants himself, ink pooling at his feet
  place(X.hero, 0, 0, 8, 180);
  seq(X.hero, lt, [[0, 'land'], [.4, 'stanceLow', .4, 'io', { angry: 1 }], [2.0, 'charge', .4, 'io', { angry: 1 }]]);
  aura(X, 'h', lerp(.8, 1.5, p));
  X.post.U.uBloom.value = 1.2;
  const g = E.io(prog(lt, .6, 3));
  inkPool(X, V(0, 0, 8), 1.4 + 1.8 * g);
  for (let i = 0; i < 40; i++) {
    const up = ((lt * .5 + h1(i)) % 1) * g, a = h1(i + 1) * 6.28, r = .5 + h1(i + 2) * 3;
    X.fx.debrisBurst(V(Math.cos(a) * r, up * 3, 8 + Math.sin(a) * r), 0, { n: 1, speed: 0, up: 0, size: .12 + h1(i + 3) * .2, seed: 100 + i, spread: 0 });
    X.fx.inkDrop(V(Math.cos(a) * r * .6, up * 2.5, 8 + Math.sin(a) * r * .6), .04, 1 - up, i);
  }
  X.fx.shadow(0, X.hero);
  kick(X, [-2, 2, 6], [2, 1, 10]);
  X.fxLight.position.set(0, 1, 7); X.fxLight.intensity = 14 * g;
  const e = E.io(p);
  cam(X, [lerp(3.5, 1.8, e), lerp(.4, .7, e), 8 - lerp(4, 2.6, e)], [0, 1, 8], lerp(38, 30, e), -5);
}, [[.4, 'plant'], [2.0, 'charge']]);

// ================================================================== ACT IV — INK TIDE (83.2 – 102.4)
shot('31 card ink', 1.6, c => { const { E: X, lt } = c;
  hide(X.villain);
  place(X.hero, 0, 0, 8, 180);
  seq(X.hero, lt, [[0, 'charge', 0, 'snap', { angry: 1 }]]);
  aura(X, 'h', 1.6);
  const h = bonePos(X.hero, 'head');
  cam(X, [h.x + 1.8, h.y - .7, h.z - 1.5], [h.x, h.y - .3, h.z], 30, 10);
  X.post.U.uImpact.value = 2; X.post.U.uImpactCol.value.setHex(0xcfd8ff);
  X.overlay.technique('墨潮', 'INK TIDE', lt / 1.6, { slab: '#10183a', side: 'left' });
}, [[0, 'CARD']]);

function inkWave(X, lt, front0, speed, opts = {}) {
  // a wall of noise-displaced ink blobs marching down the street; returns the front z
  const fz = front0 - lt * speed;
  const H = opts.h ?? 7;
  const rise = E.out(clamp(lt / .8));
  for (let i = 0; i < 22; i++) {
    const x = -7 + i * .66, hh = H * rise * (.75 + .25 * Math.sin(i * 1.7 + lt * 2));
    if (opts.split && Math.abs(x - opts.splitX) < opts.split) continue;
    X.fx.blob(V(x, hh * .45, fz + Math.sin(i * 2.3) * .5), 1.3 + .3 * h1(i), { t: lt * 1.5 + i, amp: .5, freq: .9, stretch: [1, hh / 2.4, 1.6], rim: 0x2c50d0 });
  }
  for (let i = 0; i < 70; i++) {
    const k = ((lt * 1.3 + h1(i)) % 1);
    X.fx.inkDrop(V(-7 + h1(i + 3) * 14, H * rise * (.8 + k * .8), fz - .5 - k * 3), .12 + h1(i + 5) * .25, 1 - k, i);
  }
  return fz;
}
shot('32 ink wave', 3.2, c => { const { E: X, lt, p } = c;
  place(X.hero, 0, 0, 8, 180); place(X.villain, 0, 0, -18, 0);
  seq(X.hero, lt, [[0, 'charge'], [.2, 'palmStrike', .1, 'snap', { angry: 1 }]]);
  seq(X.villain, lt, [[0, 'stance', 0, 'snap', { surprised: .6 }]]);
  aura(X, 'h', 1.3); aura(X, 'v', .8);
  const fz = inkWave(X, lt, 6, 5.5);
  X.fx.shadow(0, X.hero); X.fx.shadow(1, X.villain);
  shake(X, .35, lt);
  kick(X, [-3, 3, 9], [3, 2, 4]);
  cam(X, [lerp(1.4, 2.2, p), .5, lerp(11, 12.5, p)], [0, 3, fz - 3], 44, -8);
}, [[.2, 'WAVE']]);

shot('33 wave shred', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.hero);
  place(X.villain, 0, 0, -18, 0);
  seq(X.villain, lt, [[0, 'stance', 0, 'snap', { angry: .6 }], [.5, 'weaveSlash', .07, 'snap', { angry: 1 }], [1.2, mirror(P.weaveSlash), .07], [1.9, 'weaveSlash', .07], [2.6, 'weave', .2, 'io', { happy: .4 }]]);
  aura(X, 'v', 1.3);
  const cut = lt > .55;
  const fz = inkWave(X, lt + 3.2, 6, 5.5 * .72, { split: cut ? E.out(prog(lt, .55, 1.2)) * 3.2 : 0, splitX: 0 });
  for (const [t0, s] of [[.55, 1], [1.25, -1], [1.95, 1]]) {
    const k = (lt - t0) / .18; if (k < 0 || k > 2) continue;
    const y = 1 + s * .5;
    X.fx.line(V(-8 * s, y + 4 * s, fz - 1), V(8 * s * (1 - Math.max(0, 1 - k)) , y - 3 * s, fz + 1), .18, 0xff2040, Math.min(1, 2 - k));
    flash(X, lt, t0, .12, 0xff3040, .35);
  }
  X.fx.shadow(1, X.villain);
  kick(X, [0, 3, -15], [2, 1, -20]);
  cam(X, [-2.2, .6, -21.5], [0, 2.5, fz], 40, 6);
}, [[.55, 'SHRED'], [1.25, 'SHRED'], [1.95, 'SHRED']]);

shot('34 emerge', 1.6, c => { const { E: X, lt } = c;
  const z = lerp(-9, -16.9, E.out(clamp(lt / .5)));
  place(X.hero, 0, 0, z, 180); place(X.villain, 0, 0, -18, 0);
  seq(X.hero, lt, [[0, 'runA', 0, 'snap', { angry: 1 }], [.45, 'cross', .06, 'snap', { angry: 1 }]], { twos: false });
  seq(X.villain, lt, [[0, 'weave', 0, 'snap', { surprised: 1 }], [.5, 'hitHead', .05, 'snap', { surprised: .6, blink: .5 }]]);
  aura(X, 'h', 1.4); aura(X, 'v', .6);
  for (let i = 0; i < 50; i++) { const k = (lt * 1.5 + h1(i)) % 1; X.fx.inkDrop(V((h1(i + 2) - .5) * 4, 1 + (h1(i + 4) - .3) * 3 + k, z + 1 + k * 3), .1 + h1(i + 6) * .2, 1 - k, i); }
  impact(X, lt, .5, [1, 1, 3, 3, 2]);
  X.fx.ring(V(0, 1.4, -17.5), lt - .5, { r1: 3.5, dur: .3, normal: V(0, 0, 1), color: 0xffffff, width: .3 });
  speed(X, 1, 0, .5, .55, lt < .5 ? 0xffffff : 0x000000);
  shakeAfter(X, lt, .5, 2, .6);
  cam(X, [.9, 1.3, -19.9], [0, 1.4, z], 34, 8);
}, [[.1, 'burst'], [.5, 'IMPACT']]);

const COMBO = [
  // [time, heroPose, villainPose, camera angle index, impact]
  [0, 'jab', 'hitHead', 0, 0], [.6, 'hook', 'hitHead', 1, 0], [1.2, 'knee', 'hitGut', 2, 1], [1.8, 'elbow', 'block', 0, 0],
  [2.4, 'crossL', 'hitHead', 3, 0], [3.0, 'uppercut', 'hitHead', 1, 1], [3.6, 'roundhouse', 'block', 2, 0], [4.2, 'cross', 'flyBack', 3, 1],
];
shot('35 combo', 4.8, c => { const { E: X, lt } = c;
  const k = Math.min(COMBO.length - 1, Math.floor(lt / .6));
  const [t0, hp, vp, ci, big] = COMBO[k];
  const l = lt - t0;
  const push = k * .35;
  place(X.hero, 0, 0, -17.2 - push, 180); place(X.villain, 0, 0, -18.1 - push - (k === 7 ? E.out(clamp(l / .5)) * 4 : 0), 0);
  seq(X.hero, l, [[0, 'stance'], [.08, hp, .05, 'snap', { angry: 1 }]], { twos: false });
  seq(X.villain, l, [[0, 'stance'], [.13, vp, .04, 'snap', { angry: .5, blink: .4 }]], { twos: false });
  aura(X, 'h', 1.3); aura(X, 'v', .7);
  const ip = V(0, 1.3, -17.65 - push);
  X.fx.sparks(ip, l - .13, { n: 22, speed: 9, dur: .35, seed: 110 + k });
  X.fx.ring(ip, l - .13, { r1: big ? 4 : 2, dur: .25, normal: V(0, 0, 1), color: 0xffffff, width: .3 });
  if (big) impact(X, l, .13, [1, 2, 1]); else impact(X, l, .13, [1]);
  shakeAfter(X, l, .13, big ? 1.6 : .8, .3);
  const angles = [[2.2, 1.2, 1.2], [-2.4, .8, -1.4], [.4, .35, 2.6], [-1.2, 2.2, -2.8]];
  const a = angles[ci];
  cam(X, [a[0], a[1], ip.z + a[2]], [0, 1.2, ip.z], 34, (ci - 1.5) * 5);
  speed(X, .5 + big * .4, 0, .5, .55, big ? 0x000000 : 0xffffff);
  X.fx.shadow(0, X.hero); X.fx.shadow(1, X.villain);
  kick(X, [2, 3, ip.z], [-2, 1, ip.z - 2]);
}, COMBO.map(c => [c[0] + .13, c[4] ? 'IMPACT' : 'hit']));

shot('36 skid apart', 3.2, c => { const { E: X, lt, p } = c;
  const s = E.out(prog(lt, .35, 1.5)) * 3.5;
  place(X.hero, 0, 0, -18.5 + s, 180); place(X.villain, 0, 0, -23 - s, 0);
  seq(X.hero, lt, [[0, 'cross'], [.35, 'stanceLow', .08, 'snap', { angry: 1 }], [1.8, 'stance', .5, 'io', { angry: .8, aa: .3 }]]);
  seq(X.villain, lt, [[0, 'weaveSlash'], [.35, 'stanceLow', .08, 'snap', { angry: 1 }], [1.8, 'stance', .5, 'io', { angry: .5, aa: .4 }]]);
  aura(X, 'h', 1); aura(X, 'v', 1);
  impact(X, lt, .3, [4, 4, 1]);
  X.fx.ring(V(0, 1.2, -20.8), lt - .3, { r1: 8, dur: .4, normal: V(0, 0, 1), color: 0xffffff, width: .15 });
  for (const [z, sd] of [[-18.5 + s, 1], [-23 - s, 2]]) {
    X.fx.dustBurst(V(0, 0, z), lt - .4, { n: 12, spread: 1.3, size: .6, seed: 120 + sd, dur: 1.2 });
    // breath vapour on the exhale
    for (let i = 0; i < 3; i++) { const bt = 1.9 + i * .45, age = lt - bt; if (age > 0 && age < .6) X.fx.dustBurst(V(0, 1.3, z + (sd === 1 ? -.3 : .3)), age, { n: 4, spread: .25, size: .12, rise: .2, dur: .6, color: 0xdfe6f5, seed: 130 + i + sd }); }
  }
  shakeAfter(X, lt, .3, 1.5, .5);
  X.fx.shadow(0, X.hero); X.fx.shadow(1, X.villain);
  kick(X, [3, 3, -20], [-3, 2, -21]);
  cam(X, [lerp(9.8, 9.4, p), 1.3, -20.8], [0, 1.1, -20.8], 62, 0);
}, [[.3, 'CLASH'], [.4, 'skid']]);

shot('37 frozen rain', 1.6, c => { const { E: X, lt, p } = c;
  hide(X.villain);
  place(X.hero, 0, 0, -15, 180);
  seq(X.hero, lt, [[0, 'stance', 0, 'snap', { blink: 1 }], [1.3, 'stance', .1, 'snap', { angry: .6 }]]);
  X.rain.material.uniforms.uSpeed.value = .02; X.rain.material.uniforms.uLen.value = .1; X.rain.material.uniforms.uAlpha.value = .9;
  aura(X, 'h', .5 + p * .5);
  X.post.U.uSat.value = .5; X.key.intensity = .75;
  const h = bonePos(X.hero, 'head');
  cam(X, [h.x + .25, h.y + .02, h.z - .75 + p * .15], [h.x, h.y, h.z], 26, 0);
  kick(X, [h.x - 2.5, h.y + 1.5, h.z - 2], [h.x + 2.5, h.y, h.z + 2]);
}, [[0, 'SILENCE'], [1.3, 'eyes']]);

// ================================================================== ACT V — INK FLASH (102.4 – 115.2)
shot('38 slow fist', 1.6, c => { const { E: X, lt, p } = c;
  const z = lerp(-18.5, -19.9, E.lin(p));
  place(X.hero, 0, 0, z, 180); place(X.villain, 0, 0, -21.1, 0);
  seq(X.hero, lt * .15, [[0, 'cross', 0, 'snap', { angry: 1 }]], { twos: false });
  seq(X.villain, lt, [[0, 'stance', 0, 'snap', { surprised: 1 }]]);
  aura(X, 'h', 1.4); aura(X, 'v', .6);
  X.rain.material.uniforms.uSpeed.value = .02; X.rain.material.uniforms.uLen.value = .1; X.rain.material.uniforms.uAlpha.value = .8;
  X.hero.vrm.update(0);
  const fp = bonePos(X.hero, 'rightHand');
  // space bends around the fist: rings + black sparks crawling along the arm
  X.fx.ring(fp, (lt % .5), { r0: .05, r1: .5, dur: .5, normal: V(0, 0, 1), color: 0x000000, width: .4, alpha: .8 });
  for (let i = 0; i < 12; i++) X.fx.inkLine(fp.clone().add(V((h1(i + lt * 7) - .5) * .5, (h1(i + 3) - .5) * .5, .2)), fp.clone().add(V((h1(i + 1) - .5) * .9, (h1(i + 8) - .5) * .9, -.2)), .02, 0x000000, .9);
  X.post.U.uSat.value = .3; X.post.U.uCA.value = .006;
  cam(X, [fp.x - .5, fp.y + .05, fp.z - .9], [fp.x, fp.y, fp.z + .3], 28, -12);
}, [[0, 'riser']]);

shot('39 ink flash', 1.6, c => { const { E: X, lt } = c;
  place(X.hero, 0, 0, -19.9, 180); place(X.villain, 0, 0, -21.1, 0);
  seq(X.hero, lt, [[0, 'cross', 0, 'snap', { angry: 1 }]]);
  seq(X.villain, lt, [[0, 'hitHead', 0, 'snap', { surprised: 1 }]]);
  aura(X, 'h', 1.6); aura(X, 'v', .4);
  // the signature sequence: negative / red / white-void / black-void frames, black lightning throughout
  const f = Math.floor(lt * FPS);
  const seqF = [1, 1, 2, 2, 1, 3, 3, 2, 1, 4, 4, 2, 2, 1, 3, 2, 0, 0, 2, 0, 0, 0, 0, 0];
  X.post.U.uImpact.value = f < seqF.length ? seqF[f] : 0;
  X.post.U.uImpactCol.value.setHex(0xe01020);
  const cx = 1920 * .5, cy = 1080 * .45;
  if (lt < 1.0) X.overlay.lightning(cx, cy, 7 + Math.floor(lt * 12), { n: 9, len: 1300, width: 22 });
  X.fx.ring(V(0, 1.4, -20.5), lt, { r1: 14, dur: .6, normal: V(0, 0, 1), color: 0x000000, width: .2 });
  shake(X, 3 * (1 - lt / 1.6), lt, 30);
  cam(X, [2.4, .8, -18.2], [0, 1.4, -20.5], 30, -14);
  if (lt > .15) {
    const a = Math.min(1, (lt - .15) * 4) * (1 - prog(lt, 1.3, 1.6));
    X.overlay.add((x, W, H) => {
      x.globalAlpha = a; x.textAlign = 'center'; x.font = `800 300px ${FONTS.MINCHO}`;
      x.lineWidth = 26; x.strokeStyle = '#000'; x.strokeText('墨閃', W * .5, H * .62);
      x.fillStyle = '#f2efe6'; x.fillText('墨閃', W * .5, H * .62);
      x.font = `600 40px ${FONTS.LATIN}`; x.letterSpacing = '22px'; x.fillStyle = '#e01020'; x.fillText('INK  FLASH', W * .5, H * .62 + 90);
    });
  }
}, [[0, 'INKFLASH']]);

shot('40 blast through', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.hero);
  // she is launched down the street and through a wall of buildings at the far end
  const f = E.out(clamp(lt / 1.4));
  place(X.villain, lerp(0, -3, f), 1.2 + Math.sin(f * Math.PI) * 2, lerp(-22, -70, f), 0, { pitch: .6 });
  seq(X.villain, lt, [[0, 'flyBack', 0, 'snap', { surprised: 1 }]]);
  if (lt > 1.4) X.villain.root.visible = false;
  for (const [t0, z, s] of [[.5, -35, 1], [.9, -52, 2], [1.4, -70, 3]]) {
    X.fx.dustBurst(V(-2, 1, z), lt - t0, { n: 45, spread: 5, size: 1.4 + s * .5, rise: 2, color: 0x5c6072, seed: 140 + s, dur: 3, flat: false });
    X.fx.debrisBurst(V(-2, 1.5, z), lt - t0, { n: 60, speed: 12, up: 6, size: .5, seed: 150 + s });
    X.fx.ring(V(-2, .1, z), lt - t0, { r1: 12, dur: .6, color: 0xe0e6ff, width: .1 });
    shakeAfter(X, lt, t0, 1, .4);
  }
  crater(X, V(0, 0, -20.5), 5);
  kick(X, [0, 4, -40], [2, 2, -60]);
  const vz = lerp(-22, -70, f);
  cam(X, [3.5, 2.2, -14], [lerp(0, -2, f), lerp(1.5, 3, f), vz], lerp(38, 30, E.io(p)), -5);
}, [[.1, 'launch'], [.5, 'CRASH'], [.9, 'CRASH'], [1.4, 'CRASH']]);

shot('41 crater', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.villain);
  crater(X, V(0, 0, -20.5), 5);
  place(X.hero, 0, -.15, -19.9, 180);
  seq(X.hero, lt, [[0, 'cross', 0, 'snap', { angry: .8 }], [.8, 'stance', .6, 'io', { angry: .6 }]]);
  aura(X, 'h', 1.1);
  X.post.U.uBloom.value = 1.2;
  // steam off the ground + black lightning crackling round his fist
  for (let i = 0; i < 5; i++) X.fx.dustBurst(V((h1(i) - .5) * 6, 0, -20.5 + (h1(i + 3) - .5) * 6), (lt + i * .4) % 2, { n: 6, spread: .8, size: .6, rise: 1.5, dur: 2, color: 0x9098b0, seed: 160 + i });
  X.hero.vrm.update(0);
  const fp = bonePos(X.hero, 'rightHand');
  if (Math.floor(lt * 8) % 3 === 0) X.fx.ring(fp, (lt * 2) % .3, { r0: .05, r1: .4, dur: .3, normal: V(0, 0, 1), color: 0xe01020, width: .4 });
  for (let i = 0; i < 6; i++) if (h1(i + Math.floor(lt * 12)) > .5) X.fx.inkLine(fp.clone().add(V((h1(i * 3 + Math.floor(lt * 12)) - .5) * .6, (h1(i + 9 + Math.floor(lt * 12)) - .5) * .6, 0)), fp, .03, 0x000000, 1);
  X.fx.debrisBurst(V(0, 0, -20.5), 3, { n: 40, speed: 2, up: 0, size: .35, seed: 170 });
  kick(X, [-3, 3, -18], [3, 1, -23]);
  const e = E.io(p);
  cam(X, [lerp(-5, -2.6, e), lerp(.5, .9, e), lerp(-14, -16.6, e)], [0, 1.1, -19.9], 36, 4);
}, [[0, 'aftermath']]);

shot('42 she rises', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.hero);
  place(X.villain, -2, 0, -66, 0);
  seq(X.villain, lt, [[0, 'kneel', 0, 'snap', { angry: .5, blink: .5 }], [1.2, 'stanceLow', .6, 'io', { angry: 1 }], [2.3, 'handSign', .25, 'snap', { angry: 1 }]]);
  aura(X, 'v', lerp(.4, 1.3, prog(lt, 1.2, 3)));
  X.fx.dustBurst(V(-2, 0, -68), 1.5 + lt, { n: 40, spread: 5, size: 2, color: 0x565a6a, seed: 180, dur: 6, flat: false });
  kick(X, [-2, 3, -63], [0, 1, -69]);
  const h = bonePos(X.villain, 'head');
  cam(X, [h.x + .8, h.y - .3, h.z + 2], [h.x, h.y - .2, h.z], lerp(34, 26, E.io(p)), -4);
  sub(X, lt, .3, 2.2, '……ここまでやるとはな', "…You're better than I thought.");
  sub(X, lt, 2.3, 3.2, '領域——', 'Domain—');
}, [[1.2, 'rise'], [2.3, 'sign']]);

// ================================================================== ACT VI — DOMAIN EXPANSION (115.2 – 153.6)
shot('43 hand sign', 3.2, c => { const { E: X, lt, p } = c;
  hide(X.villain);
  crater(X, V(0, 0, -20.5), 5);
  place(X.hero, 0, 0, -26, 180);
  seq(X.hero, lt, [[0, 'stance', 0, 'snap', { angry: .6 }], [.4, 'handSign', .5, 'io', { angry: .2, relaxed: .4 }]]);
  aura(X, 'h', lerp(.6, 1.6, p));
  X.hero.vrm.update(0);
  const l = bonePos(X.hero, 'leftHand'), r = bonePos(X.hero, 'rightHand');
  const m = l.clone().add(r).multiplyScalar(.5);
  for (let i = 0; i < 16; i++) { const a = lt * 2 + i * .39, rr = .15 + .1 * Math.sin(i + lt * 3); X.fx.inkDrop(m.clone().add(V(Math.cos(a) * rr, Math.sin(a * 1.3) * .2, Math.sin(a) * rr)), .015, .9, i); }
  X.rain.material.uniforms.uSpeed.value = .05; X.rain.material.uniforms.uLen.value = .2;
  X.post.U.uSat.value = .6; X.key.intensity = .7;
  const e = E.io(p);
  cam(X, [m.x + lerp(.7, .45, e), m.y + .25, m.z - lerp(1.5, 1.15, e)], [m.x, m.y + .18, m.z], 30, lerp(-6, 0, e));
  X.kickA.color.setHex(0x3050ff); X.kickA.intensity = 6;
  kick(X, [m.x - 3, m.y + 2, m.z - 3], [m.x + 3, m.y, m.z + 2]);
}, [[0, 'BELL'], [.4, 'sign'], [2.4, 'breath']]);

shot('44 ryoiki', 1.6, c => { const { E: X, lt } = c;
  hide(X.hero, X.villain);
  X.overlay.fill('#030303');
  const a = prog(lt, 0, .15);
  X.overlay.title('領域展開', 'DOMAIN  EXPANSION', a, { size: 230, spacing: 30, color: '#f4f1ea' });
}, [[0, 'RYOIKI']]);

shot('45 ink flood', 3.2, c => { const { E: X, lt, p } = c;
  place(X.hero, 0, 0, -26, 180); hide(X.villain);
  seq(X.hero, lt, [[0, 'handSign', 0, 'snap', { relaxed: .5 }]]);
  aura(X, 'h', 1.5);
  const R = E.in(p) * 90 + 2;
  inkPool(X, V(0, 0, -26), R);
  // ink climbing the buildings: the city darkens from the ground up, fog turns to ink
  X.scene.fog.color.lerp(new THREE.Color(0x000000), E.in(p));
  X.scene.fog.density = lerp(.012, .05, E.in(p));
  for (let i = 0; i < 90; i++) { const k = (lt * .8 + h1(i)) % 1; X.fx.inkDrop(V((h1(i + 1) - .5) * 30, k * 12 * p, -26 + (h1(i + 2) - .5) * 30), .1 + h1(i + 3) * .3, 1 - k, i); }
  X.overlay.inkWipe(960, 700, E.inExpo(prog(lt, 2.2, 3.2)), 7);
  cam(X, [2.5, lerp(1.2, 5, E.io(p)), -26 + lerp(9, 16, E.io(p))], [0, .8, -30], 50, 0);
}, [[0, 'flood'], [2.2, 'swallow']]);

function domainOn(X) {
  X.city.visible = false; X.refl.visible = false; X.rain.visible = false; X.domain.visible = true;
  X.scene.fog.color.setHex(0xd9d6ce); X.scene.fog.density = .0022;
  X.hemi.intensity = 1.2; X.hemi.color.setHex(0xffffff); X.hemi.groundColor.setHex(0x222222);
  X.key.color.setHex(0xffffff);
  X.domain.userData.sea.material.uniforms.uTime.value = X.post.U.uTime.value;
  X.domain.userData.sea.material.uniforms.uCam.value.copy(X.camera.position);
  X.domain.userData.drops.material.uniforms.uTime.value = X.post.U.uTime.value;
  X.domain.userData.sky.material.uniforms.uTime.value = X.post.U.uTime.value;
  X.post.U.uSat.value = .8; X.post.U.uLift.value.set(0, 0, 0); X.post.U.uVignette.value = .35;
  setRim(X.hero, new THREE.Color(0x000000), 6, 0);
}
function seaRipples(X, list) {
  const u = X.domain.userData.sea.material.uniforms.uRipples.value;
  for (let i = 0; i < 4; i++) { const r = list[i]; if (r) u[i].set(r[0], r[1], r[2], r[3] || 3); else u[i].set(0, 0, -99, 0); }
}

shot('46 domain reveal', 3.2, c => { const { E: X, lt, p, t } = c;
  domainOn(X);
  // sea camera time needs the global clock: main sets uTime before render, we pre-set here too
  X.post.U.uTime.value = t; X.domain.userData.sea.material.uniforms.uTime.value = t;
  place(X.hero, 0, 0, 0, 180); place(X.villain, 0, 0, -12, 0);
  seq(X.hero, lt, [[0, 'handSign', 0, 'snap', { relaxed: .6 }]]);
  seq(X.villain, lt, [[0, 'stanceLow', 0, 'snap', { surprised: .8 }]]);
  aura(X, 'h', .6);
  seaRipples(X, [[0, 0, t - lt, 4], [0, -12, t - lt + .5, 3]]);
  const e = E.io(p);
  cam(X, [lerp(0, 2, e), lerp(30, 3, e), lerp(30, 10, e)], [0, lerp(8, 3, e), -40], lerp(60, 45, e), 0);
  X.overlay.fill('#030304', 1 - prog(lt, 0, .5));
  const a = prog(lt, .9, 1.3) * (1 - prog(lt, 2.9, 3.2));
  X.overlay.add((x, W, H) => {
    x.globalAlpha = a; x.fillStyle = '#050505'; x.textAlign = 'center';
    x.font = `800 150px ${FONTS.MINCHO}`;
    [...'墨海浄土'].forEach((ch, i) => x.fillText(ch, W - 200, 210 + i * 160));
    x.font = `600 30px ${FONTS.LATIN}`; x.letterSpacing = '10px'; x.save(); x.translate(W - 330, 560); x.rotate(Math.PI / 2); x.fillText('INK-SEA PURE LAND', 0, 0); x.restore();
  });
}, [[0, 'TUTTI'], [.9, 'name']]);

shot('47 she sees', 3.2, c => { const { E: X, lt, p, t } = c;
  domainOn(X); X.domain.userData.sea.material.uniforms.uTime.value = t;
  hide(X.hero);
  place(X.villain, 0, 0, -12, 0);
  seq(X.villain, lt, [[0, 'stanceLow', 0, 'snap', { surprised: 1 }]], { extra: { head: [0, lerp(-35, 30, E.io(p)), 0] } });
  aura(X, 'v', lerp(.9, .1, p));
  X.villain.vrm.update(0);
  const hand = bonePos(X.villain, 'rightHand');
  // her threads blacken and fall apart
  for (let i = 0; i < 10; i++) {
    const tip = hand.clone().add(V(Math.sin(i) * 3, 2 + Math.cos(i * 2) * 1.5, Math.cos(i) * 3));
    const k = prog(lt, .3 + i * .1, 1.6 + i * .1);
    const mid = hand.clone().lerp(tip, k);
    X.fx.line(mid, tip, .04, 0xff2040, 1 - k);
    X.fx.inkLine(hand, mid, .022, 0x020202, 1);
    if (k > .9) for (let j = 0; j < 4; j++) X.fx.inkDrop(tip.clone().add(V(0, -(k - .9) * 20 * h1(j), 0)), .05, 1, j);
  }
  seaRipples(X, [[0, -12, t - lt, 2]]);
  const h = bonePos(X.villain, 'head');
  cam(X, [h.x - .9, h.y + .1, h.z + 1.3], [h.x, h.y - .05, h.z], 30, 5);
}, [[.3, 'dissolve']]);

function spike(X, base, h, g, lean, seed) {
  // one ink spike: stacked tapered strips from the sea surface
  const top = base.clone().add(V(lean.x * h * g, h * g, lean.z * h * g));
  X.fx.inkLine(base, top, .28 + h * .045, 0x020203, 1);
  X.fx.blob(base.clone(), .3 + h * .03, { t: seed, amp: .4, stretch: [1, .3, 1], rim: 0x9a9a9a });
}
shot('48 spikes', 3.2, c => { const { E: X, lt, p, t } = c;
  domainOn(X); X.domain.userData.sea.material.uniforms.uTime.value = t;
  place(X.hero, 0, 0, 3, 180); place(X.villain, 0, 0, -12, 0);
  seq(X.hero, lt, [[0, 'handSign', 0, 'snap', { relaxed: .6 }]]);
  seq(X.villain, lt, [[0, 'stanceLow', 0, 'snap', { surprised: 1 }], [.6, 'dodgeBack', .08, 'snap', { surprised: 1 }], [1.6, 'block', .1, 'snap', { angry: 1 }]]);
  aura(X, 'v', .6);
  for (let i = 0; i < 28; i++) {
    const a = h1(i) * 6.28, r = 2 + h1(i + 1) * 7, t0 = .3 + h1(i + 2) * 1.8;
    const g = E.expo(clamp((lt - t0) / .25));
    if (g <= 0) continue;
    const base = V(Math.cos(a) * r, 0, -12 + Math.sin(a) * r);
    const lean = V(-Math.cos(a) * .4, 0, -Math.sin(a) * .4);
    spike(X, base, 3 + h1(i + 3) * 6, g, lean, i);
  }
  seaRipples(X, [[0, -12, t - lt + .3, 5], [3, -10, t - lt + .9, 4], [-4, -14, t - lt + 1.4, 4]]);
  const e = E.io(p);
  cam(X, [lerp(9, 12, e), lerp(2, 6, e), lerp(-4, -2, e)], [0, 2, -12], 42, -6);
  shake(X, .3, lt);
}, [[.3, 'SPIKES'], [.9, 'spikes'], [1.5, 'spikes']]);

shot('49 shred spikes', 3.2, c => { const { E: X, lt, p, t } = c;
  domainOn(X); X.domain.userData.sea.material.uniforms.uTime.value = t;
  hide(X.hero);
  place(X.villain, 0, 0, -12, 0);
  const K = [[0, 'block'], [.3, 'weaveSlash', .06, 'snap', { angry: 1 }], [.8, mirror(P.weaveSlash), .06, 'snap', { angry: 1 }], [1.3, 'weaveSlash', .06, 'snap', { angry: 1 }], [1.8, 'roundhouse', .06, 'snap', { angry: 1 }], [2.4, 'stanceLow', .1, 'snap', { angry: 1, aa: .5 }]];
  seq(X.villain, lt, K, { twos: false });
  aura(X, 'v', 1.2);
  for (let i = 0; i < 20; i++) {
    const a = h1(i + 40) * 6.28, r = 2 + h1(i + 41) * 5;
    const base = V(Math.cos(a) * r, 0, -12 + Math.sin(a) * r);
    const cutT = .3 + (i % 4) * .5;
    const hh = 5 + h1(i) * 4;
    const cut = lt > cutT ? .35 + h1(i + 7) * .3 : 1;
    spike(X, base, hh * cut, 1, V(-Math.cos(a) * .4, 0, -Math.sin(a) * .4), i);
    if (lt > cutT) { const fall = lt - cutT; const piece = base.clone().add(V(-Math.cos(a) * hh * cut * .4, hh * cut + 1 - 4.9 * fall * fall, -Math.sin(a) * hh * cut * .4)); if (piece.y > 0) X.fx.inkLine(piece, piece.clone().add(V(.3, 2.2, .3)), .5, 0x020203, 1); }
  }
  for (const t0 of [.3, .8, 1.3, 1.8]) { const k = (lt - t0) / .15; if (k > 0 && k < 1.6) { X.fx.line(V(-6, 1 + k, -12 - 4), V(6, 2.5 - k, -12 + 4), .15, 0xff2040, 1.6 - k); flash(X, lt, t0, .1, 0xff2030, .25); } }
  const h = bonePos(X.villain, 'hips');
  cam(X, [h.x + 3.8 * Math.cos(lt * .7), 1.4, h.z + 3.8 * Math.sin(lt * .7 + 1.2)], [h.x, 1.1, h.z], 40, 4);
}, [[.3, 'SHRED'], [.8, 'SHRED'], [1.3, 'SHRED'], [1.8, 'SHRED']]);

shot('50 he walks', 3.2, c => { const { E: X, lt, p, t } = c;
  domainOn(X); X.domain.userData.sea.material.uniforms.uTime.value = t;
  hide(X.villain);
  const z = 4 - lt * 1.25;
  place(X.hero, 0, 0, z, 180);
  cycle(X.hero, lt, ['walkA', 'walkPass', 'walkB', 'walkPass'], 1.1, { face: { relaxed: .4 } });
  aura(X, 'h', .7);
  const steps = []; for (let k = 0; k < 4; k++) { const st = k * .55 + .05; if (lt > st) steps.push([k % 2 ? -.1 : .1, 4 - st * 1.25, t - lt + st, 2.5]); }
  seaRipples(X, steps.slice(-4));
  cam(X, [0, .5, z - 7], [0, 1.4, z], 30, 0);
}, [[.05, 'step'], [.6, 'step'], [1.15, 'step'], [1.7, 'step'], [2.25, 'step'], [2.8, 'step']]);

shot('51 barrage', 3.2, c => { const { E: X, lt, t } = c;
  domainOn(X); X.domain.userData.sea.material.uniforms.uTime.value = t;
  const k = Math.min(3, Math.floor(lt / .8)), l = lt - k * .8;
  const ang = [0, 2.2, 4.1, 1.1][k] ;
  const hx = Math.sin(ang) * .95, hz = -12 + Math.cos(ang) * .95;
  place(X.villain, 0, 0, -12, [0, 60, -40, 120][k]);
  place(X.hero, hx, 0, hz, ang * 180 / Math.PI + 180);
  seq(X.hero, l, [[0, 'stanceLow'], [.1, ['cross', 'roundhouse', 'uppercut', 'palmStrike'][k], .05, 'snap', { angry: 1 }]], { twos: false });
  seq(X.villain, l, [[0, 'block'], [.14, ['hitHead', 'hitGut', 'hitHead', 'flyBack'][k], .04, 'snap', { surprised: .6, blink: .6 }]], { twos: false });
  aura(X, 'h', 1.2); aura(X, 'v', .5);
  // arrival burst of ink (he steps out of the sea)
  for (let i = 0; i < 25; i++) { const s = l; if (s < .4) X.fx.inkDrop(V(hx + (h1(i + k) - .5) * 2 * s * 3, s * 4 * h1(i + 2) - 5 * s * s, hz + (h1(i + 5 + k) - .5) * 2 * s * 3), .08, 1 - s * 2, i); }
  X.fx.ring(V(hx / 2, 1.3, (hz - 12) / 2), l - .14, { r1: 3, dur: .25, normal: V(Math.sin(ang), 0, Math.cos(ang)), color: 0x000000, width: .35 });
  impact(X, l, .14, k === 3 ? [3, 1, 3] : [3]);
  seaRipples(X, [[hx, hz, t - l, 5]]);
  shakeAfter(X, l, .14, 1.2, .3);
  const ca = ang + [1.2, -1.4, 1.6, -.8][k];
  cam(X, [Math.sin(ca) * 3.5, [1.2, .5, 2.2, .9][k], -12 + Math.cos(ca) * 3.5], [0, 1.2, -12], 34, [8, -10, 4, -6][k]);
}, [[.14, 'HIT'], [.94, 'HIT'], [1.74, 'HIT'], [2.54, 'IMPACT']]);

shot('52 spear', 3.2, c => { const { E: X, lt, p, t } = c;
  domainOn(X); X.domain.userData.sea.material.uniforms.uTime.value = t;
  hide(X.hero);
  place(X.villain, 0, 0, -14, 0);
  seq(X.villain, lt, [[0, 'kneel', 0, 'snap', { angry: 1 }], [.5, 'weave', .4, 'io', { angry: 1 }], [2.4, 'spearThrow', .3, 'io', { angry: 1, aa: .6 }]]);
  aura(X, 'v', lerp(.6, 1.8, p));
  X.post.U.uBloom.value = 1.3;
  X.villain.vrm.update(0);
  const hand = bonePos(X.villain, 'rightHand');
  const g = prog(lt, .6, 2.2);
  const top = hand.clone().add(V(0, .5, 0));
  // threads spiral in from everywhere and bind into a spear
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * 6.28 + lt * 1.5, r = lerp(12, .1, E.io(clamp(g * 1.2 - i * .015)));
    X.fx.line(top.clone().add(V(Math.cos(a) * r, Math.sin(a * 1.7) * r * .4 + 1, Math.sin(a) * r)), top, .04, 0xff2040, .8);
  }
  const L = 4 * E.out(g);
  if (g > 0) { X.fx.line(top.clone().add(V(0, 0, L / 2)), top.clone().add(V(0, 0, -L / 2)), .22, 0xff1030, 1); X.fx.glowDot(top, 1.2 * g, 0xff2040, .6); }
  X.fxLight.position.copy(top); X.fxLight.color.setHex(0xff2040); X.fxLight.intensity = 20 * g;
  const h = bonePos(X.villain, 'head');
  cam(X, [h.x + 2.8, h.y - 1.1, h.z - 2.2], [h.x, h.y + .2, h.z], lerp(40, 32, E.io(p)), 8);
  sub(X, lt, .6, 2.2, 'まだだ……まだ終わらない!', "Not yet… I'm not finished!");
}, [[.5, 'gather'], [2.4, 'throw']]);

shot('53 catch', 3.2, c => { const { E: X, lt, p, t } = c;
  domainOn(X); X.domain.userData.sea.material.uniforms.uTime.value = t;
  place(X.hero, 0, 0, -3, 180); place(X.villain, 0, 0, -14, 0);
  seq(X.villain, lt, [[0, 'spearThrow', 0, 'snap', { angry: 1 }], [1.6, 'stance', .3, 'io', { surprised: 1 }]]);
  seq(X.hero, lt, [[0, 'stance', 0, 'snap', { relaxed: .5 }], [.42, 'palmStrike', .05, 'snap', { angry: .4 }]]);
  aura(X, 'h', 1.3); aura(X, 'v', .8);
  X.hero.vrm.update(0);
  const hand = bonePos(X.hero, 'rightHand');
  const f = clamp(lt / .45);
  const tip = lt < .45 ? V(0, 1.6, lerp(-13, hand.z - .1, f)) : hand.clone().add(V(0, 0, -.05));
  const blacken = prog(lt, .5, 2.2);
  if (lt < 2.4) {
    const tail = tip.clone().add(V(0, 0, -4));
    const mid = tip.clone().lerp(tail, blacken);
    X.fx.line(mid, tail, .22, 0xff1030, 1 - prog(lt, 2.0, 2.4));
    X.fx.inkLine(tip, mid, .26, 0x020203, 1);
    if (lt > 2.0) for (let i = 0; i < 20; i++) X.fx.inkDrop(tip.clone().lerp(tail, h1(i)).add(V(0, -(lt - 2) * 4 * h1(i + 3), 0)), .06, 1, i);
  }
  impact(X, lt, .45, [3, 3, 1]);
  X.fx.ring(hand, lt - .45, { r1: 3, dur: .3, normal: V(0, 0, 1), color: 0x000000, width: .3 });
  shakeAfter(X, lt, .45, 1.5, .4);
  seaRipples(X, [[0, -3, t - lt + .45, 6]]);
  const e = E.io(prog(lt, .6, 3));
  cam(X, [lerp(1.6, 1.0, e), lerp(1.5, 1.6, e), lerp(-5.6, -4.4, e)], [hand.x, hand.y, hand.z], lerp(40, 28, e), -6);
}, [[.45, 'CATCH'], [.6, 'crawl'], [2.0, 'crumble']]);

shot('54 colossal fist', 4.8, c => { const { E: X, lt, p, t } = c;
  domainOn(X); X.domain.userData.sea.material.uniforms.uTime.value = t;
  place(X.hero, 0, 0, 0, 180); place(X.villain, 0, 0, -16, 0);
  seq(X.hero, lt, [[0, 'stance'], [.4, { ...P.charge, ra: { u: [-.2, 1, .1], l: [-.1, 1, .05] }, R: 'open' }, .5, 'io', { angry: 1 }], [3.4, 'palmStrike', .1, 'snap', { angry: 1 }]]);
  seq(X.villain, lt, [[0, 'stance', 0, 'snap', { surprised: 1 }]]);
  aura(X, 'h', 1.6); aura(X, 'v', .3);
  // the sea rears up behind him into a colossal fist, then comes down on her
  const rise = E.io(prog(lt, .5, 3.2)), strike = E.inExpo(prog(lt, 3.4, 4.3));
  // a wall of ink 30 m high rises behind him, crests, and crashes forward over her
  const H = lerp(1, 30, rise), curl = strike;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 18; i++) {
    const x = -34 + i * 4, k = row / 2;
    const hh = H * (.75 + .25 * Math.sin(i * 1.9 + lt * 1.5)) * (1 - k * .25);
    const y = hh * (.5 + k * .45) - curl * hh * .6 * k;
    const z = 14 - k * 3 * rise - curl * (18 + k * 10);
    X.fx.blob(V(x, y, z), lerp(3.5, 5.5, rise) * (1 - k * .2), { t: lt + i + row * 3, amp: .8, freq: .25, stretch: [1.7, lerp(1, 2.6, rise) * (1 - k * .4), 1.3], rim: 0x9a9a9a });
  }
  for (let i = 0; i < 120; i++) { const k = (lt * .9 + h1(i + 50)) % 1; X.fx.inkDrop(V((h1(i + 51) - .5) * 70, H * (1.05 + k * .3) - curl * H * .5, 12 - curl * 26 - k * 4), .3 + h1(i + 52) * .6, 1 - k, i); }
  for (let i = 0; i < 80; i++) { const k = (lt * .7 + h1(i)) % 1; X.fx.inkDrop(V((h1(i + 1) - .5) * 30, k * 30 * rise, 8 + (h1(i + 2) - .5) * 12), .2 + h1(i + 3) * .5, 1 - k, i); }
  seaRipples(X, [[0, 8, t - lt + .5, 8]]);
  shake(X, .3 + rise * .5 + strike * 2, lt);
  const e = E.io(p);
  if (lt < 3.4) cam(X, [lerp(3, 5, e), .4, lerp(-9, -13, e)], [0, lerp(4, 14, rise), 4], lerp(50, 64, e), 6);
  else cam(X, [-6, 2, -26], [0, 8, -8], 62, -10);
}, [[.5, 'RISE'], [3.4, 'STRIKE']]);

// ================================================================== ACT VII — FINALE (153.6 – 180)
shot('55 whiteout', 3.2, c => { const { E: X, lt, t } = c;
  domainOn(X); X.domain.userData.sea.material.uniforms.uTime.value = t;
  place(X.villain, 0, 0, -16, 0); place(X.hero, 0, 0, -13, 180);
  seq(X.villain, lt, [[0, 'flyBack', 0, 'snap', { surprised: 1 }]]);
  seq(X.hero, lt, [[0, 'palmStrike', 0, 'snap', { angry: 1 }]]);
  const f = Math.floor(lt * FPS);
  const S = [3, 3, 4, 4, 3, 1, 3, 3, 3, 4, 3, 3];
  X.post.U.uImpact.value = f < S.length ? S[f] : 3; X.post.U.uImpactCol.value.setHex(0xf4f1ea);
  if (lt < .8) X.overlay.lightning(960, 520, 30 + f, { n: 8, len: 1200, width: 18, color: '#000', core: '#000' });
  X.overlay.fill('#f4f1ea', prog(lt, .8, 1.6));
  cam(X, [5, 1.2, -12], [0, 1.2, -15], 38, -12);
  shake(X, 2 * (1 - prog(lt, 0, 1.2)), lt);
}, [[0, 'WHITE'], [1.6, 'ring']]);

shot('56 shatter', 3.2, c => { const { E: X, lt, p } = c;
  // back in the ruined street, pre-dawn: the domain's shell cracks and falls away
  hide(X.hero, X.villain);
  crater(X, V(0, 0, -20.5), 5);
  slicePose(X, 60);
  X.rain.visible = false; X.refl.visible = false;
  const sky = X.city.userData.sky.material.uniforms;
  sky.uTop.value.setHex(0x1a2a50); sky.uMid.value.setHex(0x4a5a8a); sky.uHor.value.setHex(0xe89a70);
  X.scene.fog.color.setHex(0x3a4668); X.scene.fog.density = .008;
  X.hemi.intensity = 1.3;
  const e = E.io(p);
  cam(X, [3, lerp(30, 22, e), 30], [0, 10, -40], 50, 0);
  // white shell cracking (overlay): cracks grow then shards fall revealing the city
  const crack = prog(lt, 0, .9), fallP = prog(lt, .9, 2.4);
  X.overlay.add((x, W, H) => {
    if (fallP >= 1) return;
    const r = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(1234);
    const cols = 8, rows = 5;
    const pt = (i, j) => [i * W / cols + (i % cols && i < cols ? (r() - .5) * 90 : 0), j * H / rows + (j % rows && j < rows ? (r() - .5) * 80 : 0)];
    const G = []; for (let j = 0; j <= rows; j++) { G.push([]); for (let i = 0; i <= cols; i++) G[j].push(pt(i, j)); }
    let k = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) for (const tri of [[G[j][i], G[j][i + 1], G[j + 1][i]], [G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]]]) {
      k++;
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const delay = (Math.abs(cx - W / 2) / W + Math.abs(cy - H / 2) / H) * .5 * r();
      const f = Math.max(0, fallP - delay);
      const d = f * f * (900 + r() * 700), rot = (r() - .5) * f * 3, dx = (cx - W / 2) * f * .6;
      x.save(); x.translate(cx + dx, cy + d); x.rotate(rot);
      x.beginPath(); tri.forEach(([px, py], n) => n ? x.lineTo(px - cx, py - cy) : x.moveTo(px - cx, py - cy)); x.closePath();
      x.fillStyle = '#f4f1ea'; x.globalAlpha = 1 - Math.max(0, f - .6) * 2.5; x.fill();
      x.strokeStyle = '#141414'; x.lineWidth = 2.5 * crack; x.stroke();
      x.restore();
    }
  });
}, [[0, 'crack'], [.9, 'SHATTER']]);

shot('57 she lies', 4.8, c => { const { E: X, lt, p } = c;
  const sky = X.city.userData.sky.material.uniforms;
  sky.uTop.value.setHex(0x1a2a50); sky.uMid.value.setHex(0x4a5a8a); sky.uHor.value.setHex(0xe89a70);
  X.scene.fog.color.setHex(0x3a4668); X.scene.fog.density = .008;
  X.rain.visible = false; slicePose(X, 60);
  hide(X.hero);
  place(X.villain, -2, .16, -66, 0, { pitch: -Math.PI / 2 });
  seq(X.villain, lt, [[0, 'lying', 0, 'snap', { blink: .45, relaxed: .5 }], [3.2, 'lying', .4, 'io', { blink: 1, relaxed: .8 }]]);
  aura(X, 'v', .15 * (1 - p));
  calmWind(X.villain);
  const h = bonePos(X.villain, 'head');
  X.camera.position.set(h.x, h.y + 1.7 - p * .25, h.z + .35); X.camera.up.set(0, 0, -1); X.camera.lookAt(h.x, h.y, h.z - .05); X.camera.fov = 28;
  X.key.color.setHex(0xffd8c0);
  sub(X, lt, .6, 3.6, '……負けか', '…So I lost.');
  // a few embers of her threads drifting up and out
  for (let i = 0; i < 12; i++) { const k = (lt * .3 + h1(i)) % 1; X.fx.glowDot(V(h.x + (h1(i + 1) - .5) * 3, h.y + k * 2, h.z + (h1(i + 2) - .5) * 3), .05, 0xff4050, (1 - k) * .8); }
}, [[.6, 'soft']]);

shot('58 his back', 4.8, c => { const { E: X, lt, p } = c;
  const sky = X.city.userData.sky.material.uniforms;
  sky.uTop.value.setHex(0x223462); sky.uMid.value.setHex(0x5a6a98); sky.uHor.value.setHex(0xf0a878);
  X.scene.fog.color.setHex(0x44507a); X.scene.fog.density = .007;
  X.rain.visible = false; slicePose(X, 60);
  hide(X.villain);
  crater(X, V(0, 0, -20.5), 5);
  place(X.hero, 0, 0, -24, 180);
  seq(X.hero, lt, [[0, 'stance', 0, 'snap', { relaxed: .4 }], [1.2, 'idle', .6, 'io', { relaxed: .6 }], [2.6, 'pockets', .5, 'io', { relaxed: .6, blink: .3 }]]);
  aura(X, 'h', lerp(.6, 0, prog(lt, 0, 2.4)));
  X.key.color.setHex(0xffd8c0); X.key.intensity = 1.6; setRim(X.hero, new THREE.Color(0xff9a50), 3, 0);
  X.keyAuto = false; X.key.position.set(0, 6, -60); X.key.target.position.set(0, 1, -24);
  cam(X, [.6, 1.3, -20.5 + p * .5], [0, 1.4, -40], 34, 0);
  sub(X, lt, 2.6, 4.6, '……帰って寝る', "…I'm going home to sleep.");
}, [[1.2, 'exhale']]);

shot('59 walk away', 3.2, c => { const { E: X, lt, p } = c;
  const sky = X.city.userData.sky.material.uniforms;
  sky.uTop.value.setHex(0x2a3c6c); sky.uMid.value.setHex(0x6a78a4); sky.uHor.value.setHex(0xf6b484);
  X.scene.fog.color.setHex(0x4e5a84); X.scene.fog.density = .006; slicePose(X, 60);
  X.rain.visible = false; hide(X.villain);
  const z = -26 - lt * 1.25;
  place(X.hero, 0, 0, z, 180);
  cycle(X.hero, lt, ['walkA', 'walkPass', 'walkB', 'walkPass'], 1.1);
  X.key.color.setHex(0xffd8c0); setRim(X.hero, new THREE.Color(0xff9a50), 3, 0);
  X.fx.shadow(0, X.hero, 0, .45, .4);
  cam(X, [.8, .35, -22], [0, 1, z - 4], 34, 0);
}, [[.05, 'step'], [.6, 'step'], [1.15, 'step'], [1.7, 'step'], [2.25, 'step'], [2.8, 'step']]);

shot('60 skyline', 3.2, c => { const { E: X, lt, p } = c;
  const sky = X.city.userData.sky.material.uniforms;
  sky.uTop.value.setHex(0x30447a); sky.uMid.value.setHex(0x7a86b0); sky.uHor.value.setHex(0xffc090);
  X.scene.fog.color.setHex(0x5a6690); X.scene.fog.density = .005; slicePose(X, 60);
  X.rain.visible = false; hide(X.villain, X.hero);
  const e = E.io(p);
  cam(X, [2, lerp(4, 70, e), -30], [0, lerp(8, 40, e), -200], 50, 0);
  X.overlay.fill('#000', prog(lt, 2.6, 3.2));
}, []);

shot('61 end card', 4.0, c => { const { E: X, lt } = c;
  hide(X.hero, X.villain);
  X.overlay.fill('#000');
  const a = prog(lt, .2, .8) * (1 - prog(lt, 3.4, 4.0));
  X.overlay.title('墨ノ刻', 'HOUR OF INK', a, { size: 170, spacing: 30, y: .42 });
  X.overlay.text('CHARACTERS  AvatarSample_B © pixiv Inc. · Seed-san © VirtualCast, Inc.   ·   ORCHESTRA  VSCO-2 CE (CC0)', 960, 900, { font: `500 20px ${FONTS.LATIN}`, color: '#8d8a84', a, ls: 3 });
  X.overlay.text('An original short in the style of modern shōnen action anime', 960, 940, { font: `500 20px ${FONTS.LATIN}`, color: '#8d8a84', a, ls: 3 });
}, [[0, 'end']]);

export const DURATION = Math.round(acc * 1e6) / 1e6;

// everything a shot may have changed that must not leak into the next frame rendered
export function resetStory(X) {
  const sky = X.city.userData.sky.material.uniforms;
  sky.uTop.value.setHex(0x070b1a); sky.uMid.value.setHex(0x1a2a55); sky.uHor.value.setHex(0x5a3a5e);
  const m = X.city.userData.moon; m.position.set(-160, 300, -620); m.lookAt(0, 0, 0);
  for (const b of X.city.userData.buildings) b.visible = true;
  if (CRATER) CRATER.visible = false;
  if (POOL) POOL.visible = false;
  if (SLICE) { SLICE.b.visible = true; SLICE.lower.visible = false; SLICE.upper.visible = false; SLICE.cap.visible = false; }
  if (SHELTER) SHELTER.glass.visible = true;
  calmWind(X.hero); calmWind(X.villain);
  X.hemi.color.setHex(0x6a7aa8); X.hemi.groundColor.setHex(0x201820);
  X.fxLight.color.setHex(0x4060ff);
  X.post.U.uImpactCol.value.setHex(0xd01020);
  const seaU = X.domain.userData.sea.material.uniforms.uRipples.value; seaU.forEach(v => v.set(0, 0, -99, 0));
}
