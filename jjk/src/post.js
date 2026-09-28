// Anime post pipeline: character masks -> cursed-energy aura, bloom, grade, impact frames,
// speed lines, chromatic aberration, grain. One full-screen composite pass at the end.
import * as THREE from 'three';

const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

function fsQuad(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false;
  const s = new THREE.Scene(); s.add(q);
  return { m, s };
}

const BLUR = `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
  void main(){ vec4 c = texture2D(tSrc, vUv)*0.227;
    c += texture2D(tSrc, vUv + uDir*1.385)*0.316; c += texture2D(tSrc, vUv - uDir*1.385)*0.316;
    c += texture2D(tSrc, vUv + uDir*3.231)*0.070; c += texture2D(tSrc, vUv - uDir*3.231)*0.070;
    gl_FragColor = c; }`;
const BRIGHT = `varying vec2 vUv; uniform sampler2D tSrc; uniform float uThr;
  void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(uThr, uThr + .25, l), 1.); }`;

const COMPOSITE = `
varying vec2 vUv;
uniform sampler2D tScene, tMask, tMaskBlur, tBloom;
uniform float uTime, uAspect;
uniform vec4 uAuraH;  // rgb edge colour, strength
uniform vec4 uAuraV;
uniform vec3 uAuraCoreH, uAuraCoreV;
uniform float uBloom, uExposure, uSat, uContrast;
uniform vec3 uLift, uGain, uTint;
uniform float uImpact;      // 0 none, 1 negative, 2 red/black two-tone, 3 white void w/ black silhouettes, 4 black void w/ white silhouettes
uniform vec3 uImpactCol;
uniform float uSpeed;       // speed-line strength
uniform vec2 uSpeedC;       // radial centre (uv)  / if uSpeedMode==1 direction
uniform float uSpeedMode;   // 0 radial, 1 linear
uniform vec3 uSpeedCol;
uniform float uCA, uVignette, uGrain, uFlash, uFade;
uniform vec3 uFlashCol;
uniform float uSeed;

float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+1.), f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s += a*noise(p); p *= 2.03; a *= .5; } return s; }

vec3 sceneCA(vec2 uv){
  vec2 d = (uv - .5) * uCA;
  return vec3(texture2D(tScene, uv + d).r, texture2D(tScene, uv).g, texture2D(tScene, uv - d).b);
}

void main(){
  vec2 uv = vUv;
  vec3 col = uCA > 0. ? sceneCA(uv) : texture2D(tScene, uv).rgb;
  vec4 mk = texture2D(tMask, uv);

  // ---- cursed energy: silhouette extruded upward and carved by rising noise into flame tongues.
  // Luminous near the body, deepening to translucent colour at the tips, bright rim on every tongue,
  // with dark ink strands running through it.
  float tq = floor(uTime * 12.) / 12.;           // fx animate on twos, like hand-drawn effects
  vec2 q = vec2(uv.x * uAspect, uv.y);
  for (int k = 0; k < 2; k++) {
    vec4 A = k == 0 ? uAuraH : uAuraV;
    if (A.a <= 0.) continue;
    vec3 inkc = k == 0 ? uAuraCoreH : uAuraCoreV;
    float sd = float(k) * 7.3;
    float ext = 0.;
    for (int j = 0; j < 8; j++) {
      float fj = float(j);
      vec2 o = vec2((noise(vec2(q.x * 7. + sd + fj * .7, q.y * 6. - tq * 4.)) - .5) * .05 * (fj / 8.), -fj * .026 * A.a);
      vec4 m = texture2D(tMaskBlur, uv + o);
      ext = max(ext, (k == 0 ? m.r : m.g) * (1. - fj / 9.));
    }
    vec4 mc = texture2D(tMaskBlur, uv);
    float near = k == 0 ? mc.r : mc.g;
    float tongues = smoothstep(.25, .75, fbm(vec2(q.x * 16. + sd, q.y * 2.6 - tq * 6.)));
    float fine = noise(vec2(q.x * 46. + sd, q.y * 7. - tq * 10.));
    float f = ext * (.25 + 1.25 * tongues) + near * .35;
    float core = k == 0 ? mk.r : mk.g;
    float body = smoothstep(.36, .44, f);
    float edge = smoothstep(.30, .36, f) * (1. - smoothstep(.40, .48, f));
    float outside = 1. - smoothstep(.25, .7, core);
    vec3 hot = mix(A.rgb, vec3(1.), .55);
    vec3 fc = mix(A.rgb * .55, hot, smoothstep(.2, .75, near));
    float strands = smoothstep(.62, .7, fine) * (1. - smoothstep(.7, .8, fine));
    fc = mix(fc, inkc, strands * .85);
    col = mix(col, fc, body * outside * .72 * min(1., A.a * 1.3));
    col += hot * edge * outside * min(1., A.a * 1.3) * 1.2;
    // energy clinging to the body edges
    col += A.rgb * smoothstep(.15, .5, core) * (1. - smoothstep(.5, .95, core)) * (.4 + tongues) * .6 * A.a;
  }

  // ---- bloom + grade
  col += texture2D(tBloom, uv).rgb * uBloom;
  col *= uExposure;
  col = col * uGain + uLift;
  col *= uTint;
  float l = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l), col, uSat);
  col = (col - .5) * uContrast + .5;

  // ---- speed lines
  if (uSpeed > 0.) {
    float lines;
    if (uSpeedMode < .5) {
      vec2 d = (uv - uSpeedC) * vec2(uAspect, 1.);
      float ang = atan(d.y, d.x);
      float r = length(d);
      float n = h21(vec2(floor(ang * 110.), floor(uTime * 24.)));
      float w = h21(vec2(floor(ang * 110.) + .5, 3.));
      lines = step(.72 - .3 * uSpeed, n) * smoothstep(.16 + .25 * w, .55 + .2 * w, r);
    } else {
      vec2 dir = normalize(uSpeedC);
      vec2 perp = vec2(-dir.y, dir.x);
      float s = dot((uv - .5) * vec2(uAspect, 1.), perp);
      float along = dot((uv - .5) * vec2(uAspect, 1.), dir);
      float id = floor(s * 160.);
      float n = h21(vec2(id, floor(uTime * 24.)));
      float len = h21(vec2(id, 7.));
      float ph = fract(along * (.6 + len) + n * 5. + uTime * 3.);
      lines = step(.8 - .3 * uSpeed, n) * step(.35, ph);
    }
    col = mix(col, uSpeedCol, lines * min(1., uSpeed));
  }

  // ---- impact frames
  float L = dot(col, vec3(.299, .587, .114));
  if (uImpact > .5 && uImpact < 1.5) {
    col = vec3(1.) - col; col = mix(vec3(dot(col, vec3(.333))), col, .15);
    col = (col - .5) * 1.8 + .5;
  } else if (uImpact > 1.5 && uImpact < 2.5) {
    float t = smoothstep(.2, .3, L);
    col = mix(vec3(.02, 0., .0), uImpactCol, t);
  } else if (uImpact > 2.5 && uImpact < 3.5) {
    float sil = max(mk.r, mk.g);
    col = mix(vec3(.96, .95, .92), vec3(.02), smoothstep(.3, .6, sil));
  } else if (uImpact > 3.5) {
    float sil = max(mk.r, mk.g);
    col = mix(vec3(.02), uImpactCol, smoothstep(.3, .6, sil));
  }

  col = mix(col, uFlashCol, uFlash);

  // ---- vignette + grain + fade
  vec2 vd = (uv - .5) * vec2(uAspect, 1.);
  col *= 1. - uVignette * smoothstep(.35, 1.1, length(vd));
  float g = h21(uv * vec2(1920., 1080.) + uSeed * 91.3) - .5;
  col += g * uGrain;
  col *= uFade;
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;

export class Post {
  constructor(renderer, w, h) {
    this.r = renderer; this.w = w; this.h = h;
    const f = { type: THREE.HalfFloatType };
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { ...f, samples: 4 });
    this.rtMask = new THREE.WebGLRenderTarget(w / 2, h / 2, { samples: 2 });
    this.rtMaskA = new THREE.WebGLRenderTarget(w / 4, h / 4, {});
    this.rtMaskB = new THREE.WebGLRenderTarget(w / 4, h / 4, {});
    this.rtB1 = new THREE.WebGLRenderTarget(w / 4, h / 4, f);
    this.rtB2 = new THREE.WebGLRenderTarget(w / 4, h / 4, f);
    this.rtB3 = new THREE.WebGLRenderTarget(w / 8, h / 8, f);
    this.rtB4 = new THREE.WebGLRenderTarget(w / 8, h / 8, f);
    this.blur = fsQuad(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.bright = fsQuad(BRIGHT, { tSrc: { value: null }, uThr: { value: .92 } });
    this.copy = fsQuad('varying vec2 vUv; uniform sampler2D tSrc; void main(){ gl_FragColor = texture2D(tSrc, vUv); }', { tSrc: { value: null } });
    this.comp = fsQuad(COMPOSITE, {
      tScene: { value: this.rtScene.texture }, tMask: { value: this.rtMask.texture }, tMaskBlur: { value: this.rtMaskB.texture }, tBloom: { value: this.rtB3.texture },
      uTime: { value: 0 }, uAspect: { value: w / h },
      uAuraH: { value: new THREE.Vector4(.25, .45, 1, 0) }, uAuraV: { value: new THREE.Vector4(1, .1, .15, 0) },
      uAuraCoreH: { value: new THREE.Color(0x020308) }, uAuraCoreV: { value: new THREE.Color(0x140002) },
      uBloom: { value: .8 }, uExposure: { value: 1 }, uSat: { value: 1 }, uContrast: { value: 1.08 },
      uLift: { value: new THREE.Vector3(.01, .012, .03) }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uTint: { value: new THREE.Vector3(1, 1, 1) },
      uImpact: { value: 0 }, uImpactCol: { value: new THREE.Color(0xd01020) },
      uSpeed: { value: 0 }, uSpeedC: { value: new THREE.Vector2(.5, .5) }, uSpeedMode: { value: 0 }, uSpeedCol: { value: new THREE.Color(1, 1, 1) },
      uCA: { value: 0 }, uVignette: { value: .45 }, uGrain: { value: .045 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) }, uFade: { value: 1 },
      uSeed: { value: 0 },
    });
    this.maskMatH = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.maskMatV = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.U = this.comp.m.uniforms;
  }
  pass(q, target) { this.r.setRenderTarget(target); this.r.render(q.s, CAM); }
  blurPass(src, tmp, dst, px) {
    this.blur.m.uniforms.tSrc.value = src.texture; this.blur.m.uniforms.uDir.value.set(px / src.width, 0); this.pass(this.blur, tmp);
    this.blur.m.uniforms.tSrc.value = tmp.texture; this.blur.m.uniforms.uDir.value.set(0, px / src.height); this.pass(this.blur, dst);
  }
  render(scene, camera, opts = {}) {
    const r = this.r;
    r.setRenderTarget(this.rtScene); r.clear(); r.render(scene, camera);
    // character masks (hero -> red, villain -> green); use depth-less draw so the aura wraps them
    const needMask = this.U.uAuraH.value.w > 0 || this.U.uAuraV.value.w > 0 || this.U.uImpact.value > 2.5;
    r.setRenderTarget(this.rtMask); r.setClearColor(0x000000, 1); r.clear();
    if (needMask) {
      const bg = scene.background; scene.background = null;
      const fog = scene.fog; scene.fog = null;
      const layers = camera.layers.mask;
      r.autoClear = false;
      scene.overrideMaterial = this.maskMatH; camera.layers.set(1); r.render(scene, camera);
      scene.overrideMaterial = this.maskMatV; camera.layers.set(2); r.render(scene, camera);
      scene.overrideMaterial = null; camera.layers.mask = layers; r.autoClear = true;
      scene.background = bg; scene.fog = fog;
      this.copy.m.uniforms.tSrc.value = this.rtMask.texture; this.pass(this.copy, this.rtMaskA);
      this.blurPass(this.rtMaskA, this.rtMaskB, this.rtMaskA, 1.5);
      this.blurPass(this.rtMaskA, this.rtMaskB, this.rtMaskA, 2.5);
      this.copy.m.uniforms.tSrc.value = this.rtMaskA.texture; this.pass(this.copy, this.rtMaskB);
    } else { r.setRenderTarget(this.rtMaskB); r.clear(); }
    r.setClearColor(0x000000, 1);
    // bloom
    this.bright.m.uniforms.tSrc.value = this.rtScene.texture; this.pass(this.bright, this.rtB1);
    this.blurPass(this.rtB1, this.rtB2, this.rtB1, 1.5);
    this.copy.m.uniforms.tSrc.value = this.rtB1.texture; this.pass(this.copy, this.rtB3);
    this.blurPass(this.rtB3, this.rtB4, this.rtB3, 2.0);
    this.blurPass(this.rtB3, this.rtB4, this.rtB3, 3.0);
    this.pass(this.comp, null);
  }
}
const CAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
