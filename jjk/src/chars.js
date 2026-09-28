// Characters: load VRM models, restyle them into the two leads, and drive them with poses.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const D2R = Math.PI / 180;
export { D2R };

// ------------------------------------------------------------------ texture recolouring
function texToCanvas(tex) {
  const img = tex.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  return { c, x };
}
function canvasTex(orig, c) {
  const t = new THREE.CanvasTexture(c);
  t.flipY = orig.flipY; t.colorSpace = orig.colorSpace; t.wrapS = orig.wrapS; t.wrapT = orig.wrapT;
  t.magFilter = orig.magFilter; t.minFilter = orig.minFilter; t.channel = orig.channel;
  t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
const hex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
// remap every pixel through fn(r,g,b,a,lum,h,s,l) -> [r,g,b] (or null to keep)
function remap(tex, fn) {
  const { c, x } = texToCanvas(tex);
  const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const [h, s, l] = rgb2hsl(r, g, b);
    const o = fn(r, g, b, d[i + 3], lum, h, s, l);
    if (o) { d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; }
  }
  x.putImageData(im, 0, 0);
  return { c, x };
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function forMaterials(vrm, fn) {
  vrm.scene.traverse(o => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach(m => fn(m, o));
  });
}
// apply a remap to every material sharing a texture, once per texture
function recolor(vrm, matTest, fn, post) {
  const done = new Map();
  forMaterials(vrm, m => {
    if (!matTest(m.name)) return;
    for (const key of ['map', 'shadeMultiplyTexture']) {
      const t = m[key]; if (!t || !t.image) continue;
      if (!done.has(t)) {
        const cv = remap(t, fn);
        if (post) post(cv, t);
        done.set(t, canvasTex(t, cv.c));
      }
      m[key] = done.get(t);
    }
    m.needsUpdate = true;
  });
}

// ------------------------------------------------------------------ anime material tuning
function toonify(vrm, opts) {
  forMaterials(vrm, m => {
    if (!m.isMToonMaterial) return;
    m.shadingToonyFactor = Math.max(m.shadingToonyFactor ?? .9, opts.toony ?? .96);
    if (m.shadingShiftFactor !== undefined) m.shadingShiftFactor = opts.shift ?? -0.05;
    if (m.shadeColorFactor && !m.isOutline) m.shadeColorFactor.multiplyScalar(0).add(new THREE.Color(opts.shade ?? 0x7d7f9e));
    if (m.outlineWidthFactor !== undefined && m.outlineWidthMode !== 'none' && m.outlineWidthMode !== 0) {
      m.outlineWidthFactor = Math.max(m.outlineWidthFactor, 0.001) * (opts.outline ?? 1.9);
    }
    if (m.outlineColorFactor) m.outlineColorFactor.setRGB(.04, .035, .05);
    if (m.outlineLightingMixFactor !== undefined) m.outlineLightingMixFactor = 0;
    if (m.parametricRimColorFactor) { m.parametricRimColorFactor.setRGB(0, 0, 0); m.parametricRimFresnelPowerFactor = 3.5; m.parametricRimLiftFactor = 0.05; }
    if (m.rimLightingMixFactor !== undefined) m.rimLightingMixFactor = 1;
    if (m.matcapFactor) m.matcapFactor.setRGB(0, 0, 0);
    if (m.giEqualizationFactor !== undefined) m.giEqualizationFactor = 0.9;
    m.needsUpdate = true;
  });
}

// rim colour is set per shot (neon blue / crimson / white moon light)
export function setRim(ch, color, power = 3.5, lift = 0.05) {
  forMaterials(ch.vrm, m => {
    if (!m.isMToonMaterial || m.isOutline || !m.parametricRimColorFactor) return;
    m.parametricRimColorFactor.copy(color);
    m.parametricRimFresnelPowerFactor = power; m.parametricRimLiftFactor = lift;
  });
}

// ------------------------------------------------------------------ restyles
function restyleHero(vrm) {
  // strip the robot arm + backpack, keep the boy
  const hide = /robo_face|glass|backpack|anim_logo|green_emit|arm_mat|arm_plastic/;
  vrm.scene.traverse(o => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (o.name.startsWith('robo_arm') || ms.some(m => hide.test(m.name))) o.visible = false;
    }
  });
  // white tunic -> near-black navy sorcerer uniform; cyan trim -> muted steel
  const lo = hex(0x10131d), hi = hex(0x4a5470), trim = hex(0x2a3142);
  recolor(vrm, n => /huku_bake|armgear|wear_metal/.test(n), (r, g, b, a, lum, h, s) => {
    if (s > .35 && h > 170 && h < 230) return mixc(lo, trim, lum);
    if (lum < .18) return mixc([6, 6, 9], lo, lum / .18);
    return mixc(lo, hi, Math.pow(lum, 1.6));
  });
  recolor(vrm, n => /body_bake|body_nm/.test(n), (r, g, b, a, lum, h, s) => (s > .3 && h > 170 && h < 235) ? mixc(hex(0x0c0e15), hex(0x2a3142), lum) : null);
  // bare feet/calves -> dark boots (paint every body triangle below mid-calf in UV space)
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const body = ms.find(m => /body_bake|body_nm/.test(m.name));
    if (!body || !body.map) return;
    const g = o.geometry, pos = g.attributes.position, uv = g.attributes.uv, idx = g.index;
    if (!uv) return;
    const t = body.map;
    if (!t.__bootCanvas) {
      const cv = texToCanvas(t); t.__bootCanvas = cv;
    }
    const { c, x } = t.__bootCanvas;
    x.fillStyle = '#101117'; x.strokeStyle = '#101117'; x.lineWidth = 3;
    const W = c.width, H = c.height;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      if (pos.getY(ia) < .42 && pos.getY(ib) < .42 && pos.getY(ic) < .42) {
        x.beginPath();
        x.moveTo(uv.getX(ia) * W, uv.getY(ia) * H); x.lineTo(uv.getX(ib) * W, uv.getY(ib) * H); x.lineTo(uv.getX(ic) * W, uv.getY(ic) * H);
        x.closePath(); x.fill(); x.stroke();
      }
    }
    const nt = canvasTex(t, c);
    ms.forEach(m => { if (m.map === t) m.map = nt; if (m.shadeMultiplyTexture === t) m.shadeMultiplyTexture = nt; m.needsUpdate = true; });
  });
  toonify(vrm, { shade: 0x6f7391, outline: 2.2 });
}

function restyleVillain(vrm) {
  const skinLo = hex(0xb9aeb0), skinHi = hex(0xf1e8e6);
  const isSkin = (h, s, l) => h >= 5 && h <= 45 && s > .18 && s < .75 && l > .25 && l < .92;
  // hair: violet -> bone white with cold shadow
  recolor(vrm, n => /HAIR/.test(n), (r, g, b, a, lum) => mixc(hex(0x8d93a6), hex(0xf6f6f8), Math.min(1, Math.pow(lum, .7) * 1.35)));
  // jacket: two-tone black
  recolor(vrm, n => /Tops/.test(n), (r, g, b, a, lum) => mixc(hex(0x09080b), hex(0x3a353d), Math.pow(lum, 1.2) * .8));
  // skirt: pink -> blood crimson hakama tone
  recolor(vrm, n => /Bottoms/.test(n), (r, g, b, a, lum) => mixc(hex(0x16030a), hex(0x8c1222), Math.pow(lum, 1.8)));
  // shoes: desaturate
  recolor(vrm, n => /Shoes/.test(n), (r, g, b, a, lum) => mixc(hex(0x0c0c0e), hex(0x9a9aa2), lum));
  // body: tan skin -> ashen, loud graphics -> black
  recolor(vrm, n => /Body_00_SKIN/.test(n), (r, g, b, a, lum, h, s, l) => {
    if (isSkin(h, s, l)) return mixc(skinLo, skinHi, Math.min(1, (l - .25) / .6));
    if (s > .3) return mixc([10, 8, 12], [60, 50, 60], lum);
    return null;
  });
  // face skin + cursed markings under the eyes and across the cheek
  recolor(vrm, n => /Face_00_SKIN/.test(n), (r, g, b, a, lum, h, s, l) => isSkin(h, s, l) ? mixc(skinLo, skinHi, Math.min(1, (l - .25) / .6)) : null,
    ({ c, x }) => {
      const W = c.width, H = c.height;
      x.save(); x.lineCap = 'round';
      for (const [ex, dir] of [[.295, -1], [.705, 1]]) {
        x.strokeStyle = 'rgba(150,10,24,.95)';
        x.lineWidth = W * .012;
        x.beginPath(); x.moveTo(ex * W, .585 * H); x.quadraticCurveTo((ex + dir * .01) * W, .63 * H, (ex - dir * .005) * W, .675 * H); x.stroke();
        x.lineWidth = W * .007;
        x.beginPath(); x.moveTo((ex + dir * .045) * W, .59 * H); x.quadraticCurveTo((ex + dir * .06) * W, .625 * H, (ex + dir * .05) * W, .655 * H); x.stroke();
      }
      x.restore();
    });
  // irises -> crimson
  recolor(vrm, n => /EyeIris/.test(n), (r, g, b, a, lum) => mixc(hex(0x2a0306), hex(0xff3346), Math.pow(lum, .9)));
  toonify(vrm, { shade: 0x857a8f, outline: 2.0 });
}

// ------------------------------------------------------------------ loading
const loader = new GLTFLoader();
loader.register(p => new VRMLoaderPlugin(p));

export async function loadCharacter(kind) {
  const file = kind === 'hero' ? 'seed' : 'avatarB';
  const gltf = await loader.loadAsync(`assets/models/${file}.vrm`);
  const vrm = gltf.userData.vrm;
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } });
  if (kind === 'hero') restyleHero(vrm); else restyleVillain(vrm);
  const root = new THREE.Group(); root.add(vrm.scene);
  const ch = { kind, vrm, root, hipsRest: vrm.humanoid.getNormalizedBoneNode('hips').position.clone() };
  // mark all meshes of this character on layer 1 (mask for the aura pass)
  vrm.scene.traverse(o => o.layers.enable(kind === 'hero' ? 1 : 2));
  return ch;
}

// ------------------------------------------------------------------ poses
export const BONES = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes'];
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
const SEG = { Thumb: ['Metacarpal', 'Proximal', 'Distal'], other: ['Proximal', 'Intermediate', 'Distal'] };

// hand shapes: per-finger curl in degrees for each of the three joints; thumb has its own axes
export const HANDS = {
  relaxed: { curl: [18, 22, 14], thumb: [[0, 10, 0], [0, 10, 0], [0, 10, 0]], spread: 3 },
  open: { curl: [2, 2, 2], thumb: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], spread: 8 },
  fist: { curl: [85, 95, 60], thumb: [[25, 35, 20], [0, 30, 0], [0, 40, 0]], spread: 0 },
  claw: { curl: [30, 55, 45], thumb: [[0, 20, 0], [0, 20, 0], [0, 20, 0]], spread: 12 },
  blade: { curl: [0, 0, 0], thumb: [[20, 25, 0], [0, 10, 0], [0, 0, 0]], spread: 0 },
  point: { curl: [85, 95, 60], thumb: [[25, 35, 20], [0, 30, 0], [0, 40, 0]], spread: 0, index: [0, 0, 0], middle: [0, 0, 0] },
  sign: { curl: [80, 90, 55], thumb: [[25, 30, 10], [0, 20, 0], [0, 10, 0]], spread: 0, index: [0, 0, 0], middle: [0, 0, 0] },
};

function applyHand(ch, side, handName, w = 1) {
  const H = HANDS[handName] || HANDS.relaxed;
  const hum = ch.vrm.humanoid;
  const sgn = side === 'left' ? -1 : 1;
  FINGERS.forEach((f, fi) => {
    const segs = f === 'Thumb' ? SEG.Thumb : SEG.other;
    segs.forEach((s, si) => {
      const node = hum.getNormalizedBoneNode(side + f + s);
      if (!node) return;
      let e;
      if (f === 'Thumb') {
        const [a, b, c] = H.thumb[si];
        e = new THREE.Euler(a * D2R, b * D2R * -sgn, c * D2R * sgn, 'XYZ');
      } else {
        let curl = H.curl[si];
        if (f === 'Index' && H.index) curl = H.index[si];
        if (f === 'Middle' && H.middle) curl = H.middle[si];
        const spread = si === 0 ? (fi - 2) * H.spread * D2R : 0;
        e = new THREE.Euler(0, spread * -sgn, curl * D2R * sgn, 'XYZ');
      }
      const q = new THREE.Quaternion().setFromEuler(e);
      node.quaternion.slerp(q, w);
    });
  });
}

// A pose is authored in body-space directions, which is far easier than raw Euler angles:
// { hip:[x,y,z] m offset, hr:[x,y,z] hips euler°, sp, ch, uc, nk, hd: euler°,
//   la/ra: { u:[dir upper arm], l:[dir forearm], tw: twist°, h:[wrist euler°] },
//   ll/rl: { u:[dir thigh], l:[dir shin], f:[foot euler°] }, L/R: hand shape }
// Directions: +X = the character's left, +Y up, +Z the way they face.
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
const V = a => new THREE.Vector3(a[0], a[1], a[2]).normalize();
const eq = v => v ? new THREE.Quaternion().setFromEuler(_e.set(v[0] * D2R, v[1] * D2R, v[2] * D2R, 'YXZ')) : new THREE.Quaternion();
const arc = (a, b) => new THREE.Quaternion().setFromUnitVectors(a, b);
function limb(rest, spec, twistAxisSign = 1) {
  const u = V(spec.u), l = V(spec.l || spec.u);
  const Ru = arc(rest, u);
  if (spec.tw) Ru.premultiply(new THREE.Quaternion().setFromAxisAngle(u, spec.tw * D2R * twistAxisSign));
  const Rl = arc(u, l).multiply(Ru);
  const local = Ru.clone().invert().multiply(Rl);
  return [Ru, local];
}
export function poseQuats(pose) {
  const o = {};
  o.hips = eq(pose.hr); o.spine = eq(pose.sp); o.chest = eq(pose.ch); o.upperChest = eq(pose.uc);
  o.neck = eq(pose.nk); o.head = eq(pose.hd);
  const RX = new THREE.Vector3(1, 0, 0), LX = new THREE.Vector3(-1, 0, 0), DN = new THREE.Vector3(0, -1, 0);
  for (const [k, side, rest] of [['la', 'left', RX], ['ra', 'right', LX]]) {
    const spec = pose[k] || { u: [side === 'left' ? .15 : -.15, -1, 0], l: [side === 'left' ? .1 : -.1, -1, .15] };
    const [a, b] = limb(rest, spec);
    o[side + 'UpperArm'] = a; o[side + 'LowerArm'] = b; o[side + 'Hand'] = eq(spec.h);
  }
  for (const [k, side] of [['ll', 'left'], ['rl', 'right']]) {
    const spec = pose[k] || { u: [0, -1, 0], l: [0, -1, 0] };
    const [a, b] = limb(DN, spec);
    o[side + 'UpperLeg'] = a; o[side + 'LowerLeg'] = b; o[side + 'Foot'] = eq(spec.f);
  }
  return o;
}
const cache = new WeakMap();
function qs(pose) { let v = cache.get(pose); if (!v) { v = poseQuats(pose); cache.set(pose, v); } return v; }

// blend two poses (t 0..1) and write them to the rig; `extra` adds euler° offsets per bone
export function applyPose(ch, A, Bp = A, t = 0, extra = null) {
  const hum = ch.vrm.humanoid;
  const qa = qs(A), qb = qs(Bp);
  const hasUC = !!hum.getNormalizedBoneNode('upperChest');
  for (const name of BONES) {
    const node = hum.getNormalizedBoneNode(name); if (!node) continue;
    const a = qa[name], b = qb[name];
    if (!a) { node.quaternion.identity(); continue; }
    node.quaternion.copy(a).slerp(b, t);
    if (name === 'chest' && !hasUC) node.quaternion.multiply(_q.copy(qa.upperChest).slerp(qb.upperChest, t));
    if (extra && extra[name]) node.quaternion.multiply(eq(extra[name]));
  }
  const ha = A.hip || [0, 0, 0], hb = Bp.hip || [0, 0, 0];
  const hips = hum.getNormalizedBoneNode('hips');
  hips.position.set(
    ch.hipsRest.x + ha[0] + (hb[0] - ha[0]) * t,
    ch.hipsRest.y + ha[1] + (hb[1] - ha[1]) * t,
    ch.hipsRest.z + ha[2] + (hb[2] - ha[2]) * t);
  applyHand(ch, 'left', A.L || 'relaxed', 1);
  if ((Bp.L || 'relaxed') !== (A.L || 'relaxed')) applyHand(ch, 'left', Bp.L || 'relaxed', t);
  applyHand(ch, 'right', A.R || 'relaxed', 1);
  if ((Bp.R || 'relaxed') !== (A.R || 'relaxed')) applyHand(ch, 'right', Bp.R || 'relaxed', t);
}

export function setFace(ch, face = {}) {
  const em = ch.vrm.expressionManager; if (!em) return;
  for (const k of ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'aa', 'ih', 'ou', 'ee', 'oh', 'blink', 'blinkLeft', 'blinkRight', 'lookUp', 'lookDown', 'lookLeft', 'lookRight']) {
    if (em.getExpression(k)) em.setValue(k, face[k] || 0);
  }
}
