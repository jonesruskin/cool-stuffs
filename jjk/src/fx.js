// Immediate-mode effects: each frame the shot re-declares what exists at that instant, so any
// frame can be rendered independently. Pools are reset at the start of every frame.
import * as THREE from 'three';
import { rng } from './world.js';

const V3 = () => new THREE.Vector3();

// ---------------------------------------------------------------- sprite batch (dust, sparks, ink drops)
class Sprites {
  constructor(scene, cap, frag, blending = THREE.NormalBlending) {
    this.cap = cap; this.n = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); // xyz size
    this.b = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); // rot alpha seed tone
    this.c = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); // colour
    g.setAttribute('iA', this.a); g.setAttribute('iB', this.b); g.setAttribute('iC', this.c);
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending,
      uniforms: { uLight: { value: new THREE.Vector3(-.4, .8, .2).normalize() } },
      vertexShader: `attribute vec4 iA; attribute vec4 iB; attribute vec3 iC; varying vec2 vU; varying vec4 vB; varying vec3 vC;
        void main(){ vU = position.xy; vB = iB; vC = iC; vec4 mv = modelViewMatrix * vec4(iA.xyz, 1.);
          float c = cos(iB.x), s = sin(iB.x); vec2 p = mat2(c, s, -s, c) * position.xy;
          mv.xy += p * iA.w; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: frag });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 8;
    scene.add(this.mesh); this.g = g;
  }
  add(p, size, rot, alpha, seed, tone, col) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.a.setXYZW(i, p.x, p.y, p.z, size); this.b.setXYZW(i, rot, alpha, seed, tone); this.c.setXYZ(i, col.r, col.g, col.b);
  }
  commit() { this.g.instanceCount = this.n; this.a.needsUpdate = this.b.needsUpdate = this.c.needsUpdate = true; }
}
const NOISE = `float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+1.), f.x), f.y); }`;
// anime smoke: lumpy disc, hard two-tone shading, soft alpha only at the very edge
const DUST_FRAG = `varying vec2 vU; varying vec4 vB; varying vec3 vC; ${NOISE}
  void main(){ float r = length(vU); float n = noise(vU * 2.5 + vB.z * 17.) * .35 + noise(vU * 6. + vB.z * 9.) * .15;
    float edge = .78 + n - .25;
    if (r > edge) discard;
    float lit = step(.05, dot(normalize(vec3(vU, sqrt(max(0., 1. - r*r)))), normalize(vec3(-.5, .7, .5))) + n * .3 - .1);
    vec3 c = mix(vC * .45, vC, lit * .9 + .1 * vB.w);
    gl_FragColor = vec4(c, vB.y * smoothstep(edge, edge - .08, r)); }`;
const GLOW_FRAG = `varying vec2 vU; varying vec4 vB; varying vec3 vC;
  void main(){ float r = length(vU); float a = pow(max(0., 1. - r), 2.2) * vB.y; float core = smoothstep(.35, 0., r);
    gl_FragColor = vec4(vC * a + vec3(core) * a * .6, 1.); }`;
const INKDROP_FRAG = `varying vec2 vU; varying vec4 vB; varying vec3 vC; ${NOISE}
  void main(){ float r = length(vU * vec2(1., .8 + vB.w * .4)); float e = .8 + (noise(vU * 4. + vB.z * 13.) - .5) * .3;
    if (r > e) discard; vec3 c = vC; float hl = smoothstep(.2, .0, length(vU - vec2(-.3, .3)));
    gl_FragColor = vec4(c + hl * .5, vB.y); }`;

// ---------------------------------------------------------------- camera-facing ribbons (threads, slashes, trails)
class Strips {
  constructor(scene, cap, additive) {
    this.cap = cap; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(cap * 4 * 3), 3);
    this.col = new THREE.BufferAttribute(new Float32Array(cap * 4 * 4), 4);
    this.uv = new THREE.BufferAttribute(new Float32Array(cap * 4 * 2), 2);
    const idx = []; for (let i = 0; i < cap; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    g.setIndex(idx); g.setAttribute('position', this.pos); g.setAttribute('color', this.col); g.setAttribute('uv', this.uv);
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute vec4 color; varying vec4 vC; varying vec2 vU; void main(){ vC = color; vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: additive
        ? 'varying vec4 vC; varying vec2 vU; void main(){ float d = abs(vU.y-.5)*2.; float a = pow(1.-d, 1.6); float core = smoothstep(.35,0.,d); gl_FragColor = vec4((vC.rgb*a + vec3(1.,.85,.85)*core*.8)*vC.a, 1.); }'
        : 'varying vec4 vC; varying vec2 vU; void main(){ float d = abs(vU.y-.5)*2.; float taper = smoothstep(0.,.12,vU.x)*smoothstep(1.,.75,vU.x); if (d > taper) discard; gl_FragColor = vec4(vC.rgb, vC.a); }' });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
    scene.add(this.mesh); this.g = g;
  }
  add(a, b, w, col, alpha, cam) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    const dir = V3().subVectors(b, a); const mid = V3().addVectors(a, b).multiplyScalar(.5);
    const view = V3().subVectors(cam.position, mid);
    const side = V3().crossVectors(dir, view).normalize().multiplyScalar(w / 2);
    const P = [V3().subVectors(a, side), V3().subVectors(b, side), V3().addVectors(b, side), V3().addVectors(a, side)];
    const U = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let k = 0; k < 4; k++) { this.pos.setXYZ(i * 4 + k, P[k].x, P[k].y, P[k].z); this.col.setXYZW(i * 4 + k, col.r, col.g, col.b, alpha); this.uv.setXY(i * 4 + k, U[k][0], U[k][1]); }
  }
  commit() {
    this.g.setDrawRange(0, this.n * 6);
    this.pos.needsUpdate = this.col.needsUpdate = this.uv.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- the FX manager
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.dust = new Sprites(scene, 1500, DUST_FRAG);
    this.glow = new Sprites(scene, 2500, GLOW_FRAG, THREE.AdditiveBlending);
    this.ink = new Sprites(scene, 1500, INKDROP_FRAG);
    this.threads = new Strips(scene, 1200, true);
    this.slash = new Strips(scene, 400, false);
    // debris chunks
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ color: 0x3a3d48 }), 700);
    this.debris.frustumCulled = false; scene.add(this.debris); this.nDebris = 0;
    this.glass = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: .8 }), 400);
    this.glass.frustumCulled = false; scene.add(this.glass); this.nGlass = 0;
    // shockwave rings
    this.rings = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 96, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uC: { value: new THREE.Color() }, uA: { value: 1 } },
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: 'varying vec2 vU; uniform vec3 uC; uniform float uA; void main(){ gl_FragColor = vec4(uC, uA); }' }));
      m.visible = false; m.renderOrder = 7; scene.add(m); this.rings.push(m);
    }
    this.nRings = 0;
    // blob contact shadows
    this.shadows = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
        uniforms: { uA: { value: .6 } },
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: 'varying vec2 vU; uniform float uA; void main(){ float d = length(vU-.5)*2.; gl_FragColor = vec4(0.,0.,.01, uA*smoothstep(1.,.3,d)); }' }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 1; scene.add(m); return m;
    });
    // ink masses (waves, tendrils' bulbs, the domain fist): noise-displaced blobs, black with a blue sheen
    this.blobs = [];
    const blobMat = () => new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uAmp: { value: .35 }, uFreq: { value: 1.5 }, uRim: { value: new THREE.Color(0x3a66ff) }, uStretch: { value: new THREE.Vector3(1, 1, 1) } },
      vertexShader: `uniform float uT, uAmp, uFreq; uniform vec3 uStretch; varying vec3 vN; varying vec3 vV; varying float vD;
        vec3 h3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453)*2.-1.; }
        float n3(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.-2.*f);
          return mix(mix(mix(dot(h3(i),f), dot(h3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x), mix(dot(h3(i+vec3(0,1,0)),f-vec3(0,1,0)), dot(h3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
                     mix(mix(dot(h3(i+vec3(0,0,1)),f-vec3(0,0,1)), dot(h3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x), mix(dot(h3(i+vec3(0,1,1)),f-vec3(0,1,1)), dot(h3(i+1.),f-1.),u.x),u.y),u.z); }
        void main(){ vec3 p = position; float d = n3(p*uFreq + vec3(0., -uT*1.3, uT*.4)) + .5*n3(p*uFreq*2.3 - uT*.9);
          p += normal * d * uAmp; p *= uStretch; vD = d;
          vec4 mv = modelViewMatrix*vec4(p,1.); vV = -mv.xyz; vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uRim; varying vec3 vN; varying vec3 vV; varying float vD;
        void main(){ vec3 n = normalize(vN); vec3 v = normalize(vV); float f = pow(1.-max(dot(n,v),0.), 3.);
          vec3 c = vec3(.01,.012,.02) + uRim * smoothstep(.5,.72,f) * 1.2;
          float spec = smoothstep(.975, .995, dot(reflect(-v, n), normalize(vec3(-.3,.8,.5))));
          c += vec3(.55,.6,.75) * spec * .35;
          gl_FragColor = vec4(c, 1.); }` });
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 5), blobMat()); m.visible = false; scene.add(m); this.blobs.push(m);
    }
    this.nBlobs = 0;
    // generic solid meshes the shots can borrow (spear, cut building halves, crater rim) are created by shots
    this.cam = null;
    this._c = new THREE.Color();
  }
  reset() {
    for (const s of [this.dust, this.glow, this.ink, this.threads, this.slash]) s.n = 0;
    this.nDebris = 0; this.nGlass = 0; this.nRings = 0; this.nBlobs = 0;
    for (const r of this.rings) r.visible = false;
    for (const b of this.blobs) b.visible = false;
    for (const s of this.shadows) s.visible = false;
  }
  update(t, cam) {
    this.cam = cam;
    for (const s of [this.dust, this.glow, this.ink, this.threads, this.slash]) s.commit();
    this.debris.count = this.nDebris; this.debris.instanceMatrix.needsUpdate = true;
    this.glass.count = this.nGlass; this.glass.instanceMatrix.needsUpdate = true;
  }

  // ---- primitives the shots call -------------------------------------------------------
  shadow(i, ch, groundY = 0, size = .45, a = .55) {
    const s = this.shadows[i]; s.visible = true;
    const hips = ch.vrm.humanoid.getNormalizedBoneNode('hips'); const p = V3(); hips.getWorldPosition(p);
    const hgt = Math.max(0, p.y - groundY - .75);
    s.position.set(p.x, groundY + .015, p.z); s.scale.setScalar(size * (1 + hgt * .3)); s.material.uniforms.uA.value = a / (1 + hgt * 2);
  }
  ring(pos, age, { r0 = .3, r1 = 6, dur = .45, color = 0xffffff, width = .12, normal = null, alpha = 1 } = {}) {
    if (age < 0 || age > dur || this.nRings >= this.rings.length) return;
    const m = this.rings[this.nRings++]; m.visible = true;
    const p = age / dur, e = 1 - Math.pow(1 - p, 3);
    const R = r0 + (r1 - r0) * e;
    m.position.copy(pos);
    if (normal) m.lookAt(V3().addVectors(pos, normal)); else m.rotation.set(-Math.PI / 2, 0, 0);
    m.scale.setScalar(R);
    m.geometry.dispose(); m.geometry = new THREE.RingGeometry(1 - width * (1 - p) * (6 / R) * .25 - .005, 1, 96, 1);
    m.material.uniforms.uC.value.set(color); m.material.uniforms.uA.value = alpha * (1 - p);
  }
  // dust burst: puffs expand from pos, rise and dissipate
  dustBurst(pos, age, { n = 40, spread = 3, rise = 1, size = 1, dur = 2.2, color = 0x6b6f80, seed = 1, flat = true } = {}) {
    if (age < 0 || age > dur) return;
    const r = rng(seed); const c = this._c.set(color);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, sp = (.4 + r() * .6) * spread, lag = r() * .15;
      const t = Math.max(0, age - lag), e = 1 - Math.exp(-t * 3.2);
      const x = Math.cos(a) * sp * e, z = Math.sin(a) * sp * e;
      const y = (flat ? .25 + r() * .6 : (r() - .3) * sp) * e + rise * t * (.3 + r() * .5);
      const s = size * (.35 + r() * .6) * (.4 + e * .9);
      const alpha = Math.min(1, t * 10) * (1 - Math.pow(Math.min(1, age / dur), 2));
      this.dust.add(V3().set(pos.x + x, pos.y + y, pos.z + z), s, r() * 6, alpha, r(), r(), c);
    }
  }
  // debris chunks with gravity and ground bounce
  debrisBurst(pos, age, { n = 40, speed = 8, up = 6, size = .25, seed = 2, dir = null, spread = 1, ground = 0 } = {}) {
    if (age < 0 || age > 4) return;
    const r = rng(seed); const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = V3(), E = new THREE.Euler();
    for (let i = 0; i < n && this.nDebris < 700; i++) {
      let vx = (r() - .5) * 2 * spread, vz = (r() - .5) * 2 * spread, vy = r();
      if (dir) { vx += dir.x; vz += dir.z; vy += dir.y; }
      const v = V3().set(vx, vy, vz).normalize().multiplyScalar(speed * (.4 + r() * .8));
      v.y += up * r();
      let x = pos.x + v.x * age, z = pos.z + v.z * age, y = pos.y + v.y * age - 4.9 * age * age;
      if (y < ground) { y = ground + .05; }
      const s = size * (.3 + r());
      E.set(r() * 6 + age * 8 * r(), r() * 6 + age * 5, 0); Q.setFromEuler(E);
      M.compose(V3().set(x, y, z), Q, S.set(s, s * (.4 + r() * .6), s * (.5 + r())));
      this.debris.setMatrixAt(this.nDebris++, M);
    }
  }
  glassBurst(pos, age, { n = 80, speed = 6, seed = 3, dir = new THREE.Vector3(0, 0, 1) } = {}) {
    if (age < 0 || age > 3) return;
    const r = rng(seed); const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
    for (let i = 0; i < n && this.nGlass < 400; i++) {
      const v = V3().set(dir.x + (r() - .5) * 1.4, dir.y + r() * .8, dir.z + (r() - .5) * 1.4).normalize().multiplyScalar(speed * (.3 + r()));
      let y = pos.y + (r() - .5) * 2 + v.y * age - 4.9 * age * age; if (y < .05) y = .05;
      const s = .03 + r() * .1;
      E.set(r() * 6 + age * 10, r() * 6 + age * 7, r() * 6); Q.setFromEuler(E);
      M.compose(V3().set(pos.x + (r() - .5) * 1.5 + v.x * age, y, pos.z + (r() - .5) * 1.5 + v.z * age), Q, V3().set(s, s * .1, s * 1.4));
      this.glass.setMatrixAt(this.nGlass++, M);
    }
  }
  sparks(pos, age, { n = 30, speed = 7, dur = .6, color = 0xffc070, seed = 4, size = .06, len = .25 } = {}) {
    if (age < 0 || age > dur) return;
    const r = rng(seed); const c = this._c.set(color);
    for (let i = 0; i < n; i++) {
      const v = V3().set(r() - .5, r() - .3, r() - .5).normalize().multiplyScalar(speed * (.4 + r() * .8));
      const p0 = V3().set(pos.x + v.x * age, pos.y + v.y * age - 3 * age * age, pos.z + v.z * age);
      const p1 = V3().copy(p0).addScaledVector(v, -len / speed * 3);
      const a = 1 - age / dur;
      if (this.cam) this.threads.add(p1, p0, size, c, a, this.cam);
    }
  }
  glowDot(pos, size, color, alpha = 1) { this.glow.add(pos, size, 0, alpha, 0, 0, this._c.set(color)); }
  line(a, b, w, color, alpha = 1) { if (this.cam) this.threads.add(a, b, w, this._c.set(color), alpha, this.cam); }
  inkLine(a, b, w, color = 0x020204, alpha = 1) { if (this.cam) this.slash.add(a, b, w, this._c.set(color), alpha, this.cam); }
  inkDrop(pos, size, alpha = 1, seed = 0, color = 0x010103) { this.ink.add(pos, size, seed * 6, alpha, seed, .5, this._c.set(color)); }
  blob(pos, radius, { t = 0, amp = .35, freq = 1.5, rim = 0x3a66ff, stretch = [1, 1, 1], rot = null } = {}) {
    if (this.nBlobs >= this.blobs.length) return null;
    const m = this.blobs[this.nBlobs++]; m.visible = true;
    m.position.copy(pos); m.scale.setScalar(radius);
    m.rotation.set(0, 0, 0); if (rot) m.rotation.copy(rot);
    const u = m.material.uniforms; u.uT.value = t; u.uAmp.value = amp; u.uFreq.value = freq; u.uRim.value.set(rim); u.uStretch.value.set(...stretch);
    return m;
  }
}
