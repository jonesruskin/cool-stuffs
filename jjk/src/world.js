// Environments: a rain-soaked Shinjuku side street at night, and the hero's domain.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ------------------------------------------------------------------ procedural textures
function windowsTexture(r, cols, rows, style) {
  const cw = 32, rh = 44;
  const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * rh;
  const x = c.getContext('2d');
  // facade base with a vertical grime gradient
  const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, style.wall); g.addColorStop(1, '#07080c');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  const kind = r();
  for (let j = 0; j < rows; j++) {
    const bandLit = r() < style.lit * .5;
    for (let i = 0; i < cols; i++) {
      const lit = bandLit ? r() < .85 : r() < style.lit;
      const warm = r() < .62;
      const base = lit ? (warm ? [34 + r() * 16, 65 + r() * 25, 52 + r() * 20] : [195 + r() * 25, 30 + r() * 30, 66 + r() * 18]) : [225, 30, 6 + r() * 5];
      const wx = i * cw + 5, wy = j * rh + 8, ww = kind < .35 ? cw - 4 : cw - 10, wh = rh - 16;
      const wg = x.createLinearGradient(0, wy, 0, wy + wh);
      wg.addColorStop(0, `hsl(${base[0]},${base[1]}%,${base[2]}%)`);
      wg.addColorStop(1, `hsl(${base[0]},${base[1]}%,${Math.max(4, base[2] - (lit ? 22 : 2))}%)`);
      x.fillStyle = wg; x.fillRect(wx, wy, ww, wh);
      if (lit) {
        // blinds / curtains / silhouettes of furniture
        x.fillStyle = 'rgba(0,0,0,.28)';
        if (r() < .35) for (let k = 0; k < wh; k += 4) x.fillRect(wx, wy + k, ww, 1.5);
        else if (r() < .4) x.fillRect(wx + ww * r() * .6, wy + wh * .45, ww * .35, wh * .55);
      }
      // mullion
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(wx + ww / 2 - 1, wy, 2, wh);
    }
    // floor slab + balcony rail
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, j * rh, c.width, 4);
    if (kind > .7) { x.fillStyle = 'rgba(120,130,150,.25)'; x.fillRect(0, j * rh + rh - 8, c.width, 2); }
  }
  // vertical pilasters
  if (kind > .5) { x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i <= cols; i += 3) x.fillRect(i * cw - 3, 0, 6, c.height); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.anisotropy = 8;
  return t;
}
function shopTexture(r, w) {
  const c = document.createElement('canvas'); c.width = Math.round(w * 64); c.height = 200;
  const x = c.getContext('2d');
  const hue = r() * 360, warm = r() < .6;
  // awning / fascia band with a sign
  x.fillStyle = `hsl(${hue},${40 + r() * 40}%,${18 + r() * 20}%)`; x.fillRect(0, 0, c.width, 46);
  x.font = '900 34px "Noto Sans JP", sans-serif'; x.fillStyle = `hsl(${(hue + 180) % 360},80%,85%)`; x.textBaseline = 'middle';
  x.fillText(SIGNS[Math.floor(r() * SIGNS.length)], 12 + r() * (c.width - 200), 24);
  // interior glow behind glass, or a closed shutter
  if (r() < .7) {
    const g = x.createLinearGradient(0, 46, 0, 200);
    g.addColorStop(0, warm ? '#ffd9a0' : '#d8f0ff'); g.addColorStop(1, warm ? '#6a3a1a' : '#1a3a5a');
    x.fillStyle = g; x.fillRect(0, 46, c.width, 154);
    x.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i < c.width; i += 60 + r() * 60) x.fillRect(i, 46, 5, 154);             // window frames
    for (let i = 0; i < 6; i++) x.fillRect(r() * c.width, 110 + r() * 40, 20 + r() * 60, 60);  // shelves / people
  } else {
    x.fillStyle = '#2a2d36'; x.fillRect(0, 46, c.width, 154);
    x.fillStyle = 'rgba(0,0,0,.4)'; for (let k = 50; k < 200; k += 7) x.fillRect(0, k, c.width, 2);
    x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(c.width * .3, 90, c.width * .2, 60);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const SIGNS = ['居酒屋', 'カラオケ', '薬局', 'ラーメン', '焼肉', '喫茶', '質屋', 'ホテル', '寿司', '書店', '雀荘', '整体', 'BAR', '酒', '眼科', '新宿', '二十四時間', '占い', '古着', '将棋'];
const NEON = ['#ff3b6b', '#35e0ff', '#ffd23b', '#ff7a1a', '#9d6bff', '#4dff9a', '#ff4dd8', '#ffffff'];
function signTexture(text, color, vertical, bg) {
  const c = document.createElement('canvas');
  const n = [...text].length;
  const s = 96;
  if (vertical) { c.width = s + 24; c.height = n * s + 24; } else { c.width = n * s + 48; c.height = s + 24; }
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = color; x.lineWidth = 5; x.strokeRect(5, 5, c.width - 10, c.height - 10);
  x.font = `900 ${s * .82}px "Noto Sans JP", "Dela Gothic One", sans-serif`;
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = color; x.shadowBlur = 14;
  [...text].forEach((ch, i) => {
    if (vertical) x.fillText(ch, c.width / 2, 12 + s * (i + .5));
    else x.fillText(ch, 24 + s * (i + .5), c.height / 2);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { tex: t, w: c.width, h: c.height };
}
function asphaltTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d'); const r = rng(9);
  x.fillStyle = '#0e1016'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) { const v = 10 + r() * 30; x.fillStyle = `rgba(${v},${v + 3},${v + 10},.5)`; x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
  // puddles (darker, glossy)
  for (let i = 0; i < 14; i++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    x.save(); x.translate(r() * 512, r() * 512); x.scale(30 + r() * 70, 12 + r() * 30);
    g.addColorStop(0, 'rgba(3,5,10,.9)'); g.addColorStop(1, 'rgba(3,5,10,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, Math.PI * 2); x.fill(); x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------ city
export function buildCity() {
  const r = rng(1234);
  const city = new THREE.Group(); city.name = 'city';
  const buildings = [];
  const lights = [];

  // sky dome: deep navy with a sodium glow at the horizon
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(0x070b1a) }, uMid: { value: new THREE.Color(0x1a2a55) }, uHor: { value: new THREE.Color(0x5a3a5e) }, uTime: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform vec3 uTop,uMid,uHor; uniform float uTime,uFlash;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
      float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.1; a*=.5; } return s; }
      void main(){ float y = vP.y; vec3 c = mix(uHor, uMid, smoothstep(-.02,.25,y)); c = mix(c, uTop, smoothstep(.25,.8,y));
        vec2 uv = vP.xz/(y+.35)*1.6; float cl = fbm(uv*1.3 + vec2(uTime*.01,0.));
        c = mix(c, c*1.9 + vec3(.02,.025,.04), smoothstep(.45,.85,cl)*smoothstep(.02,.3,y));
        c += uFlash*vec3(.55,.6,.8)*smoothstep(0.,.6,y);
        gl_FragColor = vec4(c,1.); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat); sky.name = 'sky'; sky.renderOrder = -10;
  city.add(sky); city.userData.sky = sky;
  // moon
  const moon = new THREE.Mesh(new THREE.CircleGeometry(22, 48), new THREE.MeshBasicMaterial({ color: 0xf3efe2, fog: false }));
  moon.position.set(-160, 300, -620); moon.lookAt(0, 0, 0); city.add(moon); city.userData.moon = moon;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vU; void main(){ float d=length(vU-.5)*2.; gl_FragColor=vec4(vec3(.7,.75,.9), pow(max(0.,1.-d),3.)*.35); }' }));
  halo.position.copy(moon.position).multiplyScalar(1.01); halo.lookAt(0, 0, 0); city.add(halo);

  // ground
  const asphalt = asphaltTexture(); asphalt.repeat.set(4, 60);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 420), new THREE.MeshLambertMaterial({ map: asphalt, color: 0x9aa0b0 }));
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true; city.add(road);
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(420, 14), road.material.clone()); cross.material.map = asphalt.clone(); cross.material.map.repeat.set(60, 4); cross.material.map.needsUpdate = true;
  cross.rotation.x = -Math.PI / 2; cross.position.y = .002; city.add(cross);
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: .5 });
  for (const s of [-1, 1]) {
    for (const zz of [[-210, -7], [7, 210]]) {
      const len = zz[1] - zz[0];
      const w = new THREE.Mesh(new THREE.BoxGeometry(4, .15, len), walkMat); w.position.set(s * 9, .075, (zz[0] + zz[1]) / 2); city.add(w);
      const w2 = new THREE.Mesh(new THREE.BoxGeometry(len, .15, 4), walkMat); w2.position.set((zz[0] + zz[1]) / 2, .075, s * 9); city.add(w2);
    }
  }
  // road markings: centre dashes + a zebra crossing on each side of the junction
  const paint = new THREE.MeshBasicMaterial({ color: 0xb8bcc8, transparent: true, opacity: .55 });
  const marks = [];
  for (let z = -200; z < 200; z += 8) if (Math.abs(z) > 14) { const g = new THREE.PlaneGeometry(.18, 3.5); g.rotateX(-Math.PI / 2); g.translate(0, .006, z); marks.push(g); }
  for (const zc of [-9.5, 9.5]) for (let i = -6; i <= 6; i++) { const g = new THREE.PlaneGeometry(.55, 3); g.rotateX(-Math.PI / 2); g.translate(i * 1.05, .006, zc); marks.push(g); }
  for (const xc of [-9.5, 9.5]) for (let i = -6; i <= 6; i++) { const g = new THREE.PlaneGeometry(3, .55); g.rotateX(-Math.PI / 2); g.translate(xc, .006, i * 1.05); marks.push(g); }
  city.add(new THREE.Mesh(mergeGeometries(marks), paint));

  // buildings
  const wallCols = ['#161a24', '#1a1c22', '#1d1a1f', '#141a1f', '#20222a', '#191d28'];
  // place(centre along the street, side, alongZ): alongZ buildings line the main street (x = ±),
  // the others line the cross street (z = ±)
  const place = (c, side, alongZ) => {
    const w = 7 + r() * 11, d = 12 + r() * 8, h = 10 + Math.pow(r(), 1.6) * 70;
    const cols = Math.max(3, Math.round(w / 1.6)), rows = Math.max(3, Math.round(h / 3.2));
    const tex = windowsTexture(r, cols, rows, { wall: wallCols[Math.floor(r() * wallCols.length)], lit: .25 + r() * .45 });
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xb7bccc });
    const topMat = new THREE.MeshBasicMaterial({ color: 0x0b0d14 });
    const mats = [mat, mat, topMat, topMat, mat, mat];
    const cc = c + Math.sign(c) * w / 2;
    const sx = alongZ ? d : w, sz = alongZ ? w : d;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mats);
    const px = alongZ ? side * (11 + d / 2) : cc, pz = alongZ ? cc : side * (11 + d / 2);
    m.position.set(px, h / 2, pz);
    m.userData = { w: sx, h, d: sz };
    city.add(m); buildings.push(m);
    // neon sign bolted to the facade facing the street
    if (r() < .75 && h > 12) {
      const txt = SIGNS[Math.floor(r() * SIGNS.length)], col = NEON[Math.floor(r() * NEON.length)];
      const vert = [...txt].length > 1 && r() < .7;
      const st = signTexture(txt, col, vert, r() < .5 ? '#0b0b10' : '#16060c');
      const sh = vert ? 1.2 * [...txt].length : 1.5, sw = vert ? 1.2 : 1.3 * [...txt].length;
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: st.tex, side: THREE.DoubleSide }));
      const sy = 4 + r() * Math.min(h - 6, 16);
      const along = cc + (r() - .5) * w * .6;
      if (alongZ) {
        if (vert) { sg.position.set(side * 10.2, sy, along); sg.rotation.y = 0; }
        else { sg.position.set(side * 10.95, sy, along); sg.rotation.y = -side * Math.PI / 2; }
      } else {
        if (vert) { sg.position.set(along, sy, side * 10.2); sg.rotation.y = Math.PI / 2; }
        else { sg.position.set(along, sy, side * 10.95); sg.rotation.y = side > 0 ? Math.PI : 0; }
      }
      city.add(sg);
      if (lights.length < 12 && Math.abs(cc) < 50) lights.push({ pos: sg.position.clone(), color: new THREE.Color(col) });
    }
    // shopfront glow at street level
    const shop = new THREE.Mesh(new THREE.PlaneGeometry(w * .9, 3.2), new THREE.MeshBasicMaterial({ map: shopTexture(r, w * .9), color: 0xc8c8c8 }));
    if (alongZ) { shop.position.set(side * 10.97, 1.75, cc); shop.rotation.y = -side * Math.PI / 2; }
    else { shop.position.set(cc, 1.75, side * 10.97); shop.rotation.y = side > 0 ? Math.PI : 0; }
    city.add(shop);
    // rooftop clutter: water tanks, AC units, a railing
    for (let k = 0; k < 3; k++) {
      if (r() < .4) continue;
      const b = new THREE.Mesh(new THREE.BoxGeometry(1 + r() * 2.5, .8 + r() * 2.5, 1 + r() * 2.5), topMat);
      b.position.set(px + (r() - .5) * (sx - 3), h + .6, pz + (r() - .5) * (sz - 3)); city.add(b);
    }
    return w;
  };
  for (const side of [-1, 1]) {
    for (let z = 11; z < 230;) z += place(z, side, true) + .5 + r();
    for (let z = -11; z > -230;) z -= place(z, side, true) + .5 + r();
    for (let x = 31; x < 230;) x += place(x, side, false) + .5 + r();
    for (let x = -31; x > -230;) x -= place(x, side, false) + .5 + r();
  }

  // street furniture: lamps, utility poles + sagging wires, vending machines
  const poleMat = new THREE.MeshBasicMaterial({ color: 0x06070b });
  const lampHead = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const furniture = [];
  const wirePts = [];
  for (const side of [-1, 1]) for (let z = -120; z <= 120; z += 22) {
    if (Math.abs(z) < 8) continue;
    const pole = new THREE.CylinderGeometry(.13, .16, 9, 8); pole.translate(side * 7.8, 4.5, z); furniture.push(pole);
    const arm = new THREE.BoxGeometry(1.6, .08, .08); arm.translate(side * 7.1, 8.4, z); furniture.push(arm);
    const cross1 = new THREE.BoxGeometry(1.8, .1, .1); cross1.rotateY(Math.PI / 2); cross1.translate(side * 7.8, 8.9, z); furniture.push(cross1);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.6, .12, .3), lampHead); head.position.set(side * 6.4, 8.3, z); city.add(head);
    if (Math.abs(z) < 50) lights.push({ pos: new THREE.Vector3(side * 6.4, 8, z), color: new THREE.Color(0xffb46a), lamp: true });
    wirePts.push([side, z]);
  }
  city.add(new THREE.Mesh(mergeGeometries(furniture), poleMat));
  // catenary wires between consecutive poles
  const wireMat = new THREE.LineBasicMaterial({ color: 0x05060a });
  for (const side of [-1, 1]) for (const off of [-.8, 0, .8]) {
    const pts = [];
    for (let z = -120; z < 120; z += 22) {
      if (Math.abs(z) < 8 || Math.abs(z + 22) < 8) continue;
      for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(side * 7.8 + off, 8.9 - Math.sin(Math.PI * t) * .9, z + 22 * t)); }
      const g = new THREE.BufferGeometry().setFromPoints(pts.splice(0)); city.add(new THREE.Line(g, wireMat));
    }
  }
  // vending machines
  const vmTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#e8f4ff'; x.fillRect(0, 0, 64, 128); for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) { x.fillStyle = NEON[(i + j) % 7]; x.fillRect(4 + i * 12, 10 + j * 18, 8, 12); }
    x.fillStyle = '#1b1e28'; x.fillRect(0, 86, 64, 42); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  for (const [x, z] of [[-9.3, 14], [-9.3, 15.1], [9.3, -18], [9.3, 26]]) {
    const vm = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.9, 1.0), [new THREE.MeshBasicMaterial({ color: 0xdfe6f0 }), new THREE.MeshBasicMaterial({ color: 0xdfe6f0 }), poleMat, poleMat, new THREE.MeshBasicMaterial({ map: vmTex }), new THREE.MeshBasicMaterial({ map: vmTex })]);
    vm.position.set(x, 1.1, z); vm.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; city.add(vm);
    lights.push({ pos: new THREE.Vector3(x + (x < 0 ? .8 : -.8), 1.2, z), color: new THREE.Color(0xcfe6ff), small: true });
  }
  city.userData.buildings = buildings;
  city.userData.lights = lights;
  return city;
}

// light-pool reflections on the wet road: long soft streaks under every lamp & sign (the anime trick)
export function buildReflections(city) {
  const g = new THREE.Group();
  const mat = (col, a) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: col }, uA: { value: a } },
    vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec2 vU; uniform vec3 uC; uniform float uA;
      float h(float x){ return fract(sin(x*91.7)*437.5); }
      void main(){ float x=abs(vU.x-.5)*2.; float y=vU.y; float a = pow(max(0.,1.-x),2.) * smoothstep(0.,.15,y) * pow(1.-y, 1.5);
        a *= .6 + .4*h(floor(y*40.)); gl_FragColor=vec4(uC*a*uA, 1.); }` });
  for (const L of city.userData.lights) {
    if (L.small) continue;
    const len = L.small ? 2.5 : L.lamp ? 9 : 7;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L.small ? .8 : 1.4, len), mat(L.color.clone(), L.small ? .5 : .75));
    m.rotation.x = -Math.PI / 2;
    m.position.set(L.pos.x * (L.lamp ? .97 : .9), .012, L.pos.z);
    m.userData.anchor = L.pos.clone();
    g.add(m);
  }
  g.userData.billboard = true;
  return g;
}

// ------------------------------------------------------------------ rain
export function buildRain(count = 9000) {
  const geo = new THREE.BufferGeometry();
  const r = rng(77);
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = (r() - .5) * 60; pos[i * 3 + 1] = r() * 30; pos[i * 3 + 2] = (r() - .5) * 60; seed[i] = r(); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSpeed: { value: 1 }, uAlpha: { value: .5 }, uLen: { value: 1 } },
    vertexShader: `attribute float seed; uniform float uTime, uSpeed, uLen; uniform vec3 uCenter; varying float vA;
      void main(){ vec3 p = position; float fall = mod(p.y - uTime*22.*uSpeed*(0.8+seed*.4), 30.);
        p.y = fall; p.x = mod(p.x - uCenter.x + 30., 60.) - 30. + uCenter.x; p.z = mod(p.z - uCenter.z + 30., 60.) - 30. + uCenter.z;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; gl_PointSize = 1.; vA = (.35+seed*.65) * smoothstep(2.5, 9., -mv.z); }`,
    fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(.75,.82,.95, vA*uAlpha); }' });
  // draw as short vertical streaks: use LineSegments with duplicated verts
  const lg = new THREE.BufferGeometry();
  const lp = new Float32Array(count * 6), ls = new Float32Array(count * 2), le = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { for (let k = 0; k < 2; k++) { lp[i * 6 + k * 3] = pos[i * 3]; lp[i * 6 + k * 3 + 1] = pos[i * 3 + 1]; lp[i * 6 + k * 3 + 2] = pos[i * 3 + 2]; ls[i * 2 + k] = seed[i]; le[i * 2 + k] = k; } }
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('seed', new THREE.BufferAttribute(ls, 1)); lg.setAttribute('endp', new THREE.BufferAttribute(le, 1));
  mat.vertexShader = mat.vertexShader.replace('attribute float seed;', 'attribute float seed; attribute float endp;').replace('p.y = fall;', 'p.y = fall + endp*.55*uLen*uSpeed; p.x += endp*.05;');
  const rain = new THREE.LineSegments(lg, mat); rain.frustumCulled = false; rain.renderOrder = 5;
  return rain;
}

// ------------------------------------------------------------------ domain: 墨海浄土 (Ink-Sea Pure Land)
export function buildDomain() {
  const dom = new THREE.Group(); dom.name = 'domain';
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
      void main(){ float y=vP.y; vec3 paper=vec3(.93,.91,.86); vec3 c = mix(vec3(.86,.84,.79), paper, smoothstep(0.,.5,y));
        float ink = n(vP.xz/(y+.2)*2. + uTime*.02)*n(vP.xz/(y+.2)*5.);
        c = mix(c, vec3(.1), smoothstep(.55,.9,ink)*smoothstep(.05,.4,y)*.35);
        c *= mix(.55, 1., smoothstep(-.05,.12,y));
        gl_FragColor=vec4(c,1.); }` }));
  dom.add(sky);
  // the black sun (an ink disk ringed in white)
  const sun = new THREE.Mesh(new THREE.CircleGeometry(90, 64), new THREE.ShaderMaterial({ transparent: true, fog: false, depthWrite: false,
    vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec2 vU; void main(){ float d=length(vU-.5)*2.; vec3 c = d<.78 ? vec3(.02) : vec3(1.); float a = d<.78?1.:smoothstep(1.,.8,d); gl_FragColor=vec4(c,a); }` }));
  sun.position.set(0, 140, -600); dom.add(sun);
  // the ink sea: glossy black with ripple rings
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1), new THREE.ShaderMaterial({ fog: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uRipples: { value: [new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0)] } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `varying vec3 vW; uniform float uTime; uniform vec3 uCam; uniform vec4 uRipples[4];
      void main(){ vec3 v = normalize(uCam - vW); float fres = pow(1.-max(v.y,0.), 4.);
        float rings = 0.;
        for(int i=0;i<4;i++){ float age = uTime - uRipples[i].z; if(age<0.||age>6.) continue; float d = length(vW.xz - uRipples[i].xy);
          float r = age*uRipples[i].w; rings += smoothstep(.35,0.,abs(d-r)) * exp(-age*.6) * smoothstep(0.,.2,age); }
        float far = smoothstep(40.,500.,length(vW.xz-uCam.xz));
        vec3 c = mix(vec3(.008), vec3(.72,.71,.68), fres*.45 + far*.35);
        c += rings*vec3(.9);
        // reflected sun stripe
        c += vec3(1.)*smoothstep(.985,1.,1.-abs(vW.x/ (abs(vW.z+600.)+1.)))*.15*(1.-far);
        gl_FragColor=vec4(c,1.); }` }));
  sea.rotation.x = -Math.PI / 2; dom.add(sea); dom.userData.sea = sea;
  // torii gates standing in the sea, receding to the horizon
  const toriiMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const parts = [];
  const torii = (x, z, s, ry) => {
    const g = [];
    const pillar = () => new THREE.CylinderGeometry(.35 * s, .42 * s, 9 * s, 12);
    const p1 = pillar(); p1.translate(-3.2 * s, 4.5 * s, 0); const p2 = pillar(); p2.translate(3.2 * s, 4.5 * s, 0);
    const kasagi = new THREE.BoxGeometry(10.5 * s, .7 * s, .9 * s); kasagi.translate(0, 9.3 * s, 0);
    const shimaki = new THREE.BoxGeometry(9.5 * s, .45 * s, .7 * s); shimaki.translate(0, 8.6 * s, 0);
    const nuki = new THREE.BoxGeometry(8.4 * s, .45 * s, .5 * s); nuki.translate(0, 7.1 * s, 0);
    const gaku = new THREE.BoxGeometry(.8 * s, 1.2 * s, .3 * s); gaku.translate(0, 7.9 * s, 0);
    // upturned ends of the kasagi
    const e1 = new THREE.BoxGeometry(1.4 * s, .5 * s, .9 * s); e1.rotateZ(.25); e1.translate(-5.4 * s, 9.6 * s, 0);
    const e2 = new THREE.BoxGeometry(1.4 * s, .5 * s, .9 * s); e2.rotateZ(-.25); e2.translate(5.4 * s, 9.6 * s, 0);
    for (const q of [p1, p2, kasagi, shimaki, nuki, gaku, e1, e2]) { q.rotateY(ry); q.translate(x, 0, z); parts.push(q); }
  };
  const r = rng(55);
  for (let k = 0; k < 16; k++) torii(0, -20 - k * 38, 1.4 + k * .02, 0);
  for (let k = 0; k < 40; k++) { const a = r() * Math.PI * 2, d = 60 + r() * 400; torii(Math.cos(a) * d, Math.sin(a) * d, .8 + r() * 2.2, r() * Math.PI); }
  dom.add(new THREE.Mesh(mergeGeometries(parts), toriiMat));
  // floating ink drops rising from the sea
  const dg = new THREE.BufferGeometry(); const N = 900; const dp = new Float32Array(N * 3), ds = new Float32Array(N);
  for (let i = 0; i < N; i++) { dp[i * 3] = (r() - .5) * 160; dp[i * 3 + 1] = r() * 40; dp[i * 3 + 2] = (r() - .5) * 160; ds[i] = r(); }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('seed', new THREE.BufferAttribute(ds, 1));
  const drops = new THREE.Points(dg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 260 } },
    vertexShader: `attribute float seed; uniform float uTime, uScale; void main(){ vec3 p=position; p.y = mod(p.y + uTime*(0.6+seed), 40.);
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize = (1.+seed*3.)*uScale/(-mv.z) * smoothstep(2.,8.,-mv.z); }`,
    fragmentShader: 'void main(){ vec2 d=gl_PointCoord-.5; if(dot(d,d)>.25) discard; gl_FragColor=vec4(0.,0.,0.,.85); }' }));
  drops.frustumCulled = false; dom.add(drops); dom.userData.drops = drops; dom.userData.sky = sky;
  return dom;
}
