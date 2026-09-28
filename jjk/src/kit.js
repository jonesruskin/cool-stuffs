// Animation kit shared by the shots: easing, pose sequencing on twos, camera moves, shake.
import * as THREE from 'three';
import { applyPose, setFace } from './chars.js';
import { P } from './poses.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (x, a, b) => clamp((x - a) / (b - a));
export const E = {
  lin: t => t,
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  expo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  // anime "snap": most of the move happens in the first third, then it settles into the hold
  snap: t => t >= 1 ? 1 : 1 - Math.pow(1 - t, 5),
  back: t => { const s = 1.9; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
  step: t => t < 1 ? 0 : 1,
};
export const h1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Pose keys: [[time, poseName | poseObj, transitionDuration=0.12, ease='snap', face]]
// Holds between keys like limited animation; transitions snap over `dur` seconds.
export function seq(ch, lt, keys, { twos = true, extra = null } = {}) {
  const tt = twos ? Math.floor(lt * 12 + 1e-6) / 12 : lt;
  let k = 0; while (k + 1 < keys.length && tt >= keys[k + 1][0]) k++;
  const cur = keys[k];
  const prev = keys[Math.max(0, k - 1)];
  const dur = cur[2] ?? .12;
  const p = k === 0 ? 1 : clamp((tt - cur[0]) / dur);
  const A = typeof prev[1] === 'string' ? P[prev[1]] : prev[1];
  const Bp = typeof cur[1] === 'string' ? P[cur[1]] : cur[1];
  if (!A || !Bp) throw new Error('missing pose ' + prev[1] + ' / ' + cur[1]);
  const e = (E[cur[3] || 'snap'])(p);
  applyPose(ch, A, Bp, e, extra);
  const face = cur[4] || Bp.face || {};
  setFace(ch, face);
  return { k, p: e };
}
// cyclic pose sequence (walks, runs)
export function cycle(ch, lt, names, period, { twos = true, extra = null, face = {} } = {}) {
  const tt = twos ? Math.floor(lt * 12 + 1e-6) / 12 : lt;
  const n = names.length, u = ((tt / period) % 1 + 1) % 1 * n, i = Math.floor(u), f = u - i;
  applyPose(ch, P[names[i]], P[names[(i + 1) % n]], E.io(f), extra);
  setFace(ch, face);
}
export function place(ch, x, y, z, yawDeg = 0, extra = {}) {
  ch.root.position.set(x, y, z); ch.root.rotation.set(extra.pitch || 0, yawDeg * Math.PI / 180, extra.roll || 0, 'YXZ');
}
export function lerpV(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
// camera: position, look target, fov, roll (degrees)
export function cam(Eng, pos, target, fov = 35, roll = 0) {
  const c = Eng.camera; c.position.set(...pos); c.fov = fov; c.up.set(0, 1, 0); c.lookAt(...target);
  if (roll) c.rotateZ(roll * Math.PI / 180);
}
export function shake(Eng, amt, t, freq = 38) {
  if (amt <= 0) return;
  const c = Eng.camera;
  c.rotateX((h1(Math.floor(t * freq)) - .5) * amt * .06);
  c.rotateY((h1(Math.floor(t * freq) + 17) - .5) * amt * .06);
  c.rotateZ((h1(Math.floor(t * freq) + 43) - .5) * amt * .04);
}
// bone world position helper (for effects anchored to fists etc.)
const _v = new THREE.Vector3();
export function bonePos(ch, bone) {
  ch.vrm.scene.updateMatrixWorld(true);
  const hum = ch.vrm.humanoid;
  const n = hum.getNormalizedBoneNode(bone) || hum.getRawBoneNode(bone);
  if (n) return n.getWorldPosition(new THREE.Vector3());
  if (/Eye$/.test(bone)) {
    // no eye bones on this model: estimate from the head (eyes sit ~6 cm up, 7 cm forward, 3 cm to the side)
    const head = hum.getNormalizedBoneNode('head');
    const side = bone.startsWith('left') ? 1 : -1;
    return head.localToWorld(new THREE.Vector3(.032 * side, .062, .075));
  }
  return (hum.getNormalizedBoneNode('hips')).getWorldPosition(new THREE.Vector3());
}
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
