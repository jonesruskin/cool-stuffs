/* Claude — Motion Reel 2026
 * Every pixel is a pure function of time: render(ctx, t). No keyframes, no assets
 * besides three typefaces. Timing lives on the same 128 BPM grid as music.py.
 */
(() => {
'use strict';

const W = 1920, H = 1080, FPS = 60, BPM = 128, B = 60 / BPM, DUR = 15;
const C = {
  ink: '#141413', ink2: '#1F1E1D', paper: '#F0EEE6', clay: '#D97757', oat: '#E3DACC',
  sky: '#6A9BCC', olive: '#788C5D', gray: '#B0AEA5', mid: '#87867F', clayHi: '#EDA283',
};
const SERIF = '"Instrument Serif", serif', SANS = '"Inter Tight", sans-serif', MONO = '"JetBrains Mono", monospace';

// ------------------------------------------------------------------ math kit
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (x, a, b) => clamp((x - a) / (b - a));
const TAU = Math.PI * 2;
const E = {
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inOutQuart: t => t < .5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2,
  outBack: (t, s = 1.70158) => t <= 0 ? 0 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};
// damped spring, t in seconds -> 0..1 with overshoot
const spring = (t, f = 2.2, d = 6) => t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(TAU * f * t);
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
const beatPulse = (b, from, to, k = 5) => (b >= from && b < to) ? Math.exp(-(b - Math.floor(b)) * k) : 0;

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, t)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t)),
        bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}
function font(ctx, fam, size, weight = 400, style = 'normal', ls = 0) {
  ctx.font = `${style} ${weight} ${size}px ${fam}`;
  ctx.letterSpacing = ls + 'px';
}
function rrect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/\\';
function scramble(str, p, t, seed = 0) {
  let out = '';
  const n = str.length;
  for (let i = 0; i < n; i++) {
    const thr = (i / n) * 0.75;
    if (str[i] === ' ') { out += ' '; continue; }
    if (p >= thr + 0.25) out += str[i];
    else if (p > thr) out += GLYPHS[Math.floor(hash(i * 7 + Math.floor(t * 30 + .25) * 13 + seed) * GLYPHS.length)];
    else out += ' ';
  }
  return out;
}

// ------------------------------------------------------------------ timeline (beats)
const SCENES = [
  [0, 'IGNITION'], [4, 'EMOTION'], [8, 'SPECIMENS'], [16, 'PARTICLES'], [24, 'CRAFT'], [28, 'SIGNATURE'],
];
const E_LAND = [6.0, 6.5, 6.75, 6.875];           // must match music.py bounce hits
const E_STRENGTH = [1, .6, .38, .22];

// ------------------------------------------------------------------ precomputed data
let TEXT_PTS = null, PIXEL_PTS = null;
const N_PARTS = 4200;
const PART = [];
for (let i = 0; i < N_PARTS; i++) {
  PART.push({
    h1: hash(i * 1.13 + 1), h2: hash(i * 2.71 + 2), h3: hash(i * 3.37 + 3),
    h4: hash(i * 4.19 + 4), h5: hash(i * 5.83 + 5), h6: hash(i * 6.61 + 6),
  });
}

function sampleText(draw, step, maxPts) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  draw(x);
  const d = x.getImageData(0, 0, W, H).data;
  const pts = [];
  for (let y = 0; y < H; y += step) for (let xx = 0; xx < W; xx += step) {
    if (d[(y * W + xx) * 4 + 3] > 140) pts.push([xx, y]);
  }
  if (maxPts) {                       // deterministic shuffle so particles map everywhere
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(hash(i * 9.1) * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]];
    }
  }
  return pts;
}

function precompute() {
  TEXT_PTS = sampleText(x => {
    font(x, SERIF, 440); x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillText('Claude', W / 2, 690);
  }, 3, true);
  PIXEL_PTS = sampleText(x => {
    font(x, SANS, 250, 900, 'normal', -6); x.textBaseline = 'alphabetic';
    x.fillText('pixel.', 0, 300);
  }, 14, false);
}

// grain tiles
const GRAIN = [];
function makeGrain() {
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'); const img = x.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = Math.floor(hash(i * 0.731 + k * 1000.37) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0); GRAIN.push(c);
  }
}

// ================================================================== SCENE 1 — IGNITION
const DOT_R = 26;
function scene1(ctx, t, b) {
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const sq = E.inOutCubic(prog(b, 3.0, 3.5));
  const st = E.outExpo(prog(b, 3.52, 3.98));
  const guideA = 1 - prog(b, 3.2, 3.7);

  // construction guides
  ctx.save();
  ctx.globalAlpha = guideA;
  ctx.strokeStyle = 'rgba(240,238,230,.14)'; ctx.lineWidth = 1;
  const lx = 960 * E.outExpo(prog(b, 0.4, 2.0)), ly = 540 * E.outExpo(prog(b, 0.7, 2.2));
  ctx.beginPath(); ctx.moveTo(cx - lx, cy); ctx.lineTo(cx + lx, cy); ctx.moveTo(cx, cy - ly); ctx.lineTo(cx, cy + ly); ctx.stroke();
  // ticks
  ctx.strokeStyle = 'rgba(240,238,230,.22)';
  ctx.beginPath();
  for (let k = -15; k <= 15; k++) {
    if (!k) continue;
    const x = cx + k * 60; if (Math.abs(k * 60) > lx) continue;
    const h = k % 5 === 0 ? 10 : 5; ctx.moveTo(x, cy - h); ctx.lineTo(x, cy + h);
  }
  for (let k = -8; k <= 8; k++) {
    if (!k) continue;
    const y = cy + k * 60; if (Math.abs(k * 60) > ly) continue;
    const h = k % 5 === 0 ? 10 : 5; ctx.moveTo(cx - h, y); ctx.lineTo(cx + h, y);
  }
  ctx.stroke();
  // rotating dashed orbit guide
  const ap = E.outCubic(prog(b, 1.0, 2.4));
  ctx.setLineDash([2, 10]); ctx.lineDashOffset = -t * 30;
  ctx.strokeStyle = 'rgba(240,238,230,.3)';
  ctx.beginPath(); ctx.arc(cx, cy, 190, -Math.PI / 2 + t * .4, -Math.PI / 2 + t * .4 + TAU * ap); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(cx, cy, 300, Math.PI * .9 - t * .25, Math.PI * .9 - t * .25 + TAU * .35 * ap); ctx.stroke();
  ctx.restore();

  // beat ripples
  for (let k = 0; k < 4; k++) {
    const e = prog(b, k, k + 1.6);
    if (e <= 0 || e >= 1) continue;
    ctx.strokeStyle = C.clay; ctx.globalAlpha = Math.pow(1 - e, 2) * .9 * guideA;
    ctx.lineWidth = 2 + 6 * (1 - e);
    ctx.beginPath(); ctx.arc(cx, cy, DOT_R + 420 * E.outExpo(e), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // the dot
  let s = spring(t, 2.4, 7);
  for (let k = 1; k < 4; k++) s *= 1 + .38 * Math.exp(-(b - k) * B * 9) * (b >= k);
  const pillW = lerp(DOT_R * 2 * s * (1 + .4 * sq), 2200, st);
  const pillH = lerp(DOT_R * 2 * s * (1 - .38 * sq), 6, st);
  const px = cx - pillW / 2 - (1 - st) * sq * 30;
  ctx.fillStyle = C.clay;
  rrect(ctx, px, cy - pillH / 2, pillW, pillH, pillH / 2); ctx.fill();

  // live annotation
  const an = E.outExpo(prog(b, 1.1, 1.6)) * guideA;
  if (an > 0) {
    ctx.save(); ctx.globalAlpha = an;
    ctx.strokeStyle = 'rgba(240,238,230,.45)'; ctx.lineWidth = 1;
    const ax = cx + 70, ay = cy - 90;
    ctx.beginPath(); ctx.moveTo(cx + DOT_R * s + 6, cy - 12); ctx.lineTo(ax - 6, ay + 6); ctx.lineTo(ax + 180 * an, ay + 6); ctx.stroke();
    font(ctx, MONO, 15, 400, 'normal', 1); ctx.fillStyle = 'rgba(240,238,230,.8)';
    ctx.fillText(`r ${(DOT_R * s).toFixed(2)}px`, ax, ay - 26);
    ctx.fillStyle = C.clay;
    ctx.fillText(`spring(k=${(180).toFixed(0)}, ζ=.42)`, ax, ay - 4);
    ctx.restore();
  }

  // typed comment
  const msg = '// every frame of this reel is written in code';
  const tp = prog(b, 1.0, 2.7);
  const nChars = Math.floor(msg.length * tp);
  if (tp > 0 && guideA > 0) {
    ctx.save(); ctx.globalAlpha = guideA;
    font(ctx, MONO, 22, 400, 'normal', 0.5); ctx.fillStyle = 'rgba(240,238,230,.62)';
    ctx.textAlign = 'left';
    const full = ctx.measureText(msg).width;
    const x0 = cx - full / 2, y0 = cy + 160;
    const shown = msg.slice(0, nChars);
    ctx.fillText(shown, x0, y0);
    const cw = ctx.measureText(shown).width;
    if (Math.floor(t * 3.4) % 2 === 0 || tp < 1) { ctx.fillStyle = C.clay; ctx.fillRect(x0 + cw + 3, y0 - 19, 11, 24); }
    ctx.restore();
  }
}

// ================================================================== SCENE 2 — MOTION → EMOTION
const S2 = { size: 330, base: 640 };
function s2Layout(ctx) {
  if (S2.xs) return S2;
  font(ctx, SERIF, S2.size);
  const word = 'motion';
  S2.xs = []; for (let k = 0; k <= word.length; k++) S2.xs.push(ctx.measureText(word.slice(0, k)).width);
  S2.mw = S2.xs[word.length];
  font(ctx, SERIF, S2.size, 400, 'italic');
  S2.ew = ctx.measureText('e').width - 6;
  S2.initL = W / 2 - S2.mw / 2;
  S2.finalL = W / 2 - (S2.ew + S2.mw) / 2;
  return S2;
}
// the "e": bouncing ball exercise, landings on E_LAND beats
const G = 26000;
function eState(t) {
  const L = E_LAND.map(x => x * B);
  let h;
  if (t < L[0]) h = .5 * G * (L[0] - t) ** 2;
  else if (t >= L[3]) h = 0;
  else { let k = 0; while (t >= L[k + 1]) k++; h = .5 * G * (t - L[k]) * (L[k + 1] - t); }
  const hp = prog(t, 5.3 * B, 6.875 * B);
  const dx = -520 * (1 - E.outCubic(hp));
  return { h, dx, rot: -0.9 * (1 - E.outQuart(hp)) };
}
function eSquash(t) {
  let sq = 0;
  for (let k = 0; k < 4; k++) {
    const dt = t - E_LAND[k] * B;
    if (dt >= 0) sq += .34 * E_STRENGTH[k] * Math.exp(-dt * 16) * Math.cos(dt * 42);
  }
  return sq;
}

function scene2(ctx, t, b) {
  const L = s2Layout(ctx);
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);

  const sp = E.inOutQuart(prog(b, 4.0, 4.55));
  const lineY = lerp(H / 2, L.base + 18, E.inOutCubic(prog(b, 4.0, 4.5)));
  const shift = E.inOutCubic(prog(b, 5.35, 5.92));
  const left = lerp(L.initL, L.finalL + L.ew, shift);

  // letters rise from behind the line
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, lineY - 3); ctx.clip();
  font(ctx, SERIF, L.size);
  ctx.fillStyle = C.ink;
  const word = 'motion';
  for (let k = 0; k < word.length; k++) {
    const st = 4.1 + k * 0.08;
    const p = E.outBack(prog(b, st, st + .42), 1.25);
    const y = L.base + (1 - p) * L.size * .95;
    // impact ripple travelling through the word when the e lands
    const dt = t - (6.0 * B + k * 0.03);
    const wob = dt > 0 ? .12 * Math.exp(-dt * 12) * Math.sin(dt * 38) : 0;
    const x = left + L.xs[k];
    ctx.save();
    ctx.translate(x + (L.xs[k + 1] - L.xs[k]) / 2, y);
    ctx.scale(1 + wob * .5, 1 - wob);
    ctx.fillText(word[k], -(L.xs[k + 1] - L.xs[k]) / 2, 0);
    ctx.restore();
  }
  ctx.restore();

  // bouncing e + motion path + onion skins
  if (b > 5.2) {
    const trailA = 1 - prog(b, 7.0, 7.5);
    const eW = L.ew;
    if (trailA > 0) {
      ctx.fillStyle = C.clay;
      for (let tt = 5.45 * B; tt <= Math.min(t, 6.875 * B); tt += 0.0075) {
        const s = eState(tt);
        const a = trailA * .55 * clamp((tt - 5.45 * B) * 8);
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(L.finalL + s.dx + eW / 2, L.base - s.h - L.size * .2, 2.6, 0, TAU); ctx.fill();
      }
      // onion skin ghosts at landings
      font(ctx, SERIF, L.size, 400, 'italic');
      ctx.strokeStyle = C.clay; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        if (t < E_LAND[k] * B) continue;
        const s = eState(E_LAND[k] * B - 0.0001);
        ctx.globalAlpha = trailA * .35 * (1 - k * .25);
        ctx.strokeText('e', L.finalL + s.dx, L.base);
      }
      ctx.globalAlpha = 1;
    }
    const s = eState(t);
    let sq = eSquash(t);
    const v = Math.abs(t < E_LAND[0] * B ? G * (E_LAND[0] * B - t) : 0);
    const stretch = Math.min(.28, v / 22000);
    ctx.save();
    ctx.translate(L.finalL + s.dx + eW / 2, L.base - s.h);
    ctx.rotate(s.rot);
    ctx.scale((1 + sq * .8) / (1 + stretch * .5), (1 - sq) * (1 + stretch));
    font(ctx, SERIF, L.size, 400, 'italic');
    ctx.fillStyle = C.clay;
    ctx.fillText('e', -eW / 2 - 3, 0);
    ctx.restore();

    // squash / stretch callouts
    const ca = prog(b, 5.6, 5.8) * (1 - prog(b, 6.9, 7.2));
    if (ca > 0) {
      ctx.save(); ctx.globalAlpha = ca;
      font(ctx, MONO, 15, 400, 'normal', 2); ctx.fillStyle = C.mid;
      const lbl = b < 6.0 ? 'STRETCH ↓' : 'SQUASH';
      ctx.textAlign = 'right';
      ctx.fillText(lbl, L.finalL + s.dx - 24, L.base - s.h - L.size * .55);
      ctx.restore();
    }
  }

  // clay baseline, shrinking from the full-width seam to an underline
  const lk = E.outExpo(prog(b, 4.15, 4.9));
  const eIn = E.inOutCubic(prog(b, 5.6, 6.1));
  const ul0 = lerp(left, L.finalL, eIn) - 18, ul1 = left + L.mw + 18;
  const lx0 = lerp(-140, ul0, lk), lx1 = lerp(W + 140, ul1, lk);
  const lh = lerp(6, 4, sp);
  ctx.fillStyle = C.clay;
  ctx.fillRect(lx0, lineY - lh / 2, lx1 - lx0, lh);

  // caption
  const cp = prog(b, 6.9, 7.45);
  if (cp > 0) {
    font(ctx, MONO, 19, 400, 'normal', 7); ctx.fillStyle = C.mid; ctx.textAlign = 'center';
    ctx.fillText(scramble('EVERY FRAME SHOULD FEEL SOMETHING', cp, t), W / 2, L.base + 110);
    ctx.textAlign = 'left';
  }

  // ink halves parting (continuation of scene 1's seam)
  if (sp < 1) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, -720 * sp, W, lineY);
    ctx.fillRect(0, lineY + 720 * sp, W, H);
    ctx.fillStyle = C.clay; ctx.fillRect(0, lineY - 3, W, 6);
  }

  // exit: clay iris from the e
  const ip = E.inExpo(prog(b, 7.45, 8.0));
  if (ip > 0) {
    ctx.fillStyle = C.clay;
    ctx.beginPath(); ctx.arc(L.finalL + L.ew / 2, L.base - L.size * .2, 2400 * ip, 0, TAU); ctx.fill();
  }
}

// ================================================================== SCENE 3 — SPECIMENS
const GRID = { tw: 400, th: 225, gap: 28, top: 372 };
GRID.left = (W - (GRID.tw * 4 + GRID.gap * 3)) / 2;
const TILES = [
  { name: 'EASING', bg: C.paper, fg: C.ink },
  { name: 'MORPH', bg: C.clay, fg: C.ink },
  { name: 'PARTICLES', bg: C.ink, fg: C.paper },
  { name: 'DIMENSION', bg: C.sky, fg: C.ink },
  { name: 'TYPOGRAPHY', bg: C.oat, fg: C.ink },
  { name: 'LIQUID', bg: C.ink2, fg: C.paper },
  { name: 'RHYTHM', bg: C.olive, fg: C.paper },
  { name: 'LOOP', bg: C.paper, fg: C.ink },
];
TILES.forEach((tl, i) => {
  tl.x = GRID.left + (i % 4) * (GRID.tw + GRID.gap);
  tl.y = GRID.top + Math.floor(i / 4) * (GRID.th + GRID.gap);
});

function camera3(t, b) {
  const drift = prog(b, 8, 15.3);
  const S0 = 1 + .045 * E.inOutCubic(drift);
  const f0x = W / 2 + 14 * Math.sin(t * .8), f0y = H / 2 + 8 * Math.cos(t * .6) + 10 * drift;
  const zp = E.inOutExpo(prog(b, 15.25, 16.0));
  const T = TILES[2];
  const S1 = W / GRID.tw;
  const f1x = T.x + GRID.tw / 2, f1y = T.y + GRID.th / 2;
  const S = Math.exp(lerp(Math.log(S0), Math.log(S1), zp));
  const Px = (S1 * f1x - S0 * f0x) / (S1 - S0), Py = (S1 * f1y - S0 * f0y) / (S1 - S0);
  const fx = Px - (S0 / S) * (Px - f0x), fy = Py - (S0 / S) * (Py - f0y);
  return { S, fx, fy, zp };
}

function scene3(ctx, t, b) {
  // background: clay (from scene 2) wiped by an ink iris
  const ip = E.outExpo(prog(b, 8.0, 8.5));
  ctx.fillStyle = C.clay; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(TILES[0].x + GRID.tw / 2, TILES[0].y + GRID.th / 2, 2300 * ip, 0, TAU); ctx.fill();

  const cam = camera3(t, b);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam.S, cam.S); ctx.translate(-cam.fx, -cam.fy);

  // header
  const hp = E.outExpo(prog(b, 8.05, 8.6));
  ctx.save();
  ctx.beginPath(); ctx.rect(GRID.left - 10, GRID.top - 150, 1700, 124); ctx.clip();
  font(ctx, SERIF, 84, 400, 'italic'); ctx.fillStyle = C.paper;
  ctx.fillText('Specimens', GRID.left - 4, GRID.top - 40 + (1 - hp) * 110);
  font(ctx, MONO, 16, 400, 'normal', 3); ctx.fillStyle = C.mid;
  const sub = prog(b, 8.3, 9.2);
  ctx.fillText(scramble('EIGHT TECHNIQUES · ONE PER BEAT', sub, t, 5), GRID.left + 400, GRID.top - 52);
  // odometer counter
  const count = clamp(Math.floor(b - 8) + 1, 1, 8);
  const roll = E.outExpo(prog(b - Math.floor(b), 0, .35));
  font(ctx, MONO, 44, 700, 'normal', 0); ctx.textAlign = 'right';
  const cxr = GRID.left + GRID.tw * 4 + GRID.gap * 3;
  ctx.fillStyle = C.mid; ctx.fillText('/08', cxr, GRID.top - 42);
  const ww = ctx.measureText('/08').width;
  ctx.fillStyle = C.clay;
  const yb = GRID.top - 42;
  ctx.beginPath(); ctx.rect(cxr - 300, yb - 40, 300, 50); ctx.clip();
  if (count > 1 && b < 16) {
    ctx.fillText('0' + (count - 1), cxr - ww - 8, yb - roll * 60);
    ctx.fillText('0' + count, cxr - ww - 8, yb + (1 - roll) * 60);
  } else ctx.fillText('0' + count, cxr - ww - 8, yb + (1 - hp) * 60);
  ctx.textAlign = 'left';
  ctx.restore();

  // empty slots
  ctx.setLineDash([4, 8]); ctx.lineWidth = 1 / cam.S * cam.S;
  for (let i = 0; i < 8; i++) {
    const T = TILES[i];
    const sa = prog(b, 8.0 + i * .04, 8.3 + i * .04) * (1 - prog(b, 8 + i, 8 + i + .2));
    if (sa <= 0) continue;
    ctx.strokeStyle = `rgba(240,238,230,${.25 * sa})`;
    rrect(ctx, T.x + .5, T.y + .5, GRID.tw - 1, GRID.th - 1, 14); ctx.stroke();
    font(ctx, MONO, 12, 400, 'normal', 2); ctx.fillStyle = `rgba(240,238,230,${.35 * sa})`;
    ctx.fillText('0' + (i + 1), T.x + 16, T.y + 28);
  }
  ctx.setLineDash([]);

  // tiles
  for (let i = 0; i < 8; i++) {
    const T = TILES[i];
    const at = 8 + i;
    const ap = prog(b, at - .02, at + .55);
    if (ap <= 0) continue;
    const sc = lerp(.55, 1, E.outBack(ap, 2.2));
    const zp = i === 2 ? cam.zp : 0;
    const r = 14 * (1 - zp);
    const cx = T.x + GRID.tw / 2, cy = T.y + GRID.th / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((1 - E.outExpo(ap)) * (i % 2 ? .12 : -.12));
    ctx.scale(sc, sc);
    ctx.translate(-GRID.tw / 2, -GRID.th / 2);
    rrect(ctx, 0, 0, GRID.tw, GRID.th, r); ctx.save(); ctx.clip();
    ctx.scale(GRID.tw / W, GRID.tw / W);
    VIGNETTES[i](ctx, t - at * B, t, b);
    ctx.restore();
    // landing flash
    const fl = Math.exp(-(b - at) * 7) * (b >= at);
    if (fl > .01) {
      ctx.fillStyle = `rgba(255,255,255,${fl * .55})`; rrect(ctx, 0, 0, GRID.tw, GRID.th, r); ctx.fill();
    }
    // labels
    const la = E.outExpo(prog(b, at + .1, at + .5)) * (1 - zp * 4);
    if (la > 0) {
      ctx.globalAlpha = clamp(la);
      font(ctx, MONO, 11, 700, 'normal', 2.5); ctx.fillStyle = T.fg;
      ctx.fillText('0' + (i + 1), 16, 26);
      font(ctx, MONO, 11, 400, 'normal', 2.5);
      ctx.fillText(T.name, 16, GRID.th - 16);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---- tile vignettes, each authored as a full 1920x1080 shot
function vEasing(ctx, lt, t) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  const ease = E.inOutExpo;
  const per = 1.3;
  const ph = (Math.max(0, lt) / per) % 2;
  const u = ph < 1 ? ph : 2 - ph;
  const ox = 230, oy = 900, gs = 600;
  ctx.strokeStyle = 'rgba(20,20,19,.25)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(ox, oy - gs); ctx.lineTo(ox, oy); ctx.lineTo(ox + gs, oy); ctx.stroke();
  ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(20,20,19,.15)';
  ctx.beginPath(); for (let k = 0; k <= 80; k++) { const x = k / 80; ctx.lineTo(ox + x * gs, oy - ease(x) * gs); } ctx.stroke();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); for (let k = 0; k <= 80 * u; k++) { const x = k / 80; ctx.lineTo(ox + x * gs, oy - ease(x) * gs); } ctx.stroke();
  ctx.fillStyle = C.clay; ctx.beginPath(); ctx.arc(ox + u * gs, oy - ease(u) * gs, 30, 0, TAU); ctx.fill();
  // tracks
  const tx0 = 1020, tx1 = 1700;
  for (const [y, fn, col, r] of [[470, ease, C.clay, 80], [760, x => x, C.gray, 48]]) {
    ctx.strokeStyle = 'rgba(20,20,19,.18)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(tx0, y); ctx.lineTo(tx1, y); ctx.stroke();
    for (let g = 5; g >= 0; g--) {
      const tg = Math.max(0, lt - g * 0.035);
      const p2 = (tg / per) % 2; const u2 = p2 < 1 ? p2 : 2 - p2;
      ctx.globalAlpha = g ? .12 * (6 - g) / 6 : 1;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lerp(tx0, tx1, fn(u2)), y, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  font(ctx, MONO, 52, 700); ctx.fillStyle = C.ink;
  ctx.fillText('ease', tx0, 330); ctx.fillStyle = C.mid; ctx.fillText('linear', tx0, 880);
  ctx.lineCap = 'butt';
}

const SF = [[0, 1, 1, 1], [4, 12, 15, 15], [5, 2, 7, 7], [3, 4.5, 10, 10], [8, 1, 1, 8], [6, .8, 2, 2]];
function sfR(p, phi) {
  const [m, n1, n2, n3] = p;
  const a = Math.pow(Math.abs(Math.cos(m * phi / 4)), n2), c = Math.pow(Math.abs(Math.sin(m * phi / 4)), n3);
  return Math.pow(a + c, -1 / n1);
}
function superShape(ctx, t, off, R, rot) {
  const seg = 0.55;
  const k = Math.floor(t / seg) + off, f = E.inOutCubic((t / seg) % 1);
  const A = SF[k % SF.length], Bp = SF[(k + 1) % SF.length];
  const pts = [];
  let mA = 0, mB = 0;
  const n = 360;
  for (let i = 0; i < n; i++) { const ph = i / n * TAU; mA = Math.max(mA, sfR(A, ph)); mB = Math.max(mB, sfR(Bp, ph)); }
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const ph = i / n * TAU;
    const r = lerp(sfR(A, ph) / mA, sfR(Bp, ph) / mB, f) * R;
    ctx.lineTo(W / 2 + r * Math.cos(ph + rot), H / 2 + r * Math.sin(ph + rot));
  }
  ctx.closePath();
}
function vMorph(ctx, lt, t) {
  ctx.fillStyle = C.clay; ctx.fillRect(0, 0, W, H);
  const tt = Math.max(0, lt);
  ctx.fillStyle = C.paper; superShape(ctx, tt, 0, 400, tt * .7); ctx.fill();
  ctx.fillStyle = C.ink; superShape(ctx, tt + .27, 2, 160, -tt * 1.4); ctx.fill();
  ctx.fillStyle = C.paper;
  const a = tt * 2.2;
  ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * 520, H / 2 + Math.sin(a) * 440, 26, 0, TAU); ctx.fill();
}

// ---- particles (tile 3 and the whole drop)
function particlesPos(i, t, b, out) {
  const p = PART[i];
  const cx = W / 2, cy = H / 2;
  // galaxy
  const kp = beatPulse(b, 8, 24, 6);
  let r, ang;
  if (p.h4 < .2) {                       // bulge
    r = 10 + 170 * Math.pow(p.h1, 1.6);
    ang = p.h2 * TAU + t * (1.4 + 40 / (r + 30));
  } else {                               // three logarithmic arms
    r = 90 + 500 * Math.pow(p.h1, .85);
    const arm = Math.floor(p.h2 * 3) * TAU / 3;
    const spread = ((p.h3 - .5) + (hash(i * 8.83) - .5)) * (.28 + r / 1600);
    ang = arm + Math.log(r / 90) * 2.2 + spread + t * (.55 + 50 / (r + 100));
  }
  r *= 1 + .07 * kp;
  let gx = r * Math.cos(ang), gy = r * Math.sin(ang) * .52;
  const tilt = -.16;
  let x = cx + gx * Math.cos(tilt) - gy * Math.sin(tilt);
  let y = cy + gx * Math.sin(tilt) + gy * Math.cos(tilt);
  let size = 1, alpha = .45 + .55 * p.h6;
  if (b >= 16.9) {
    // gather into the word
    const T = TEXT_PTS[i % TEXT_PTS.length];
    const tcx = W / 2, tcy = 560;
    const kp2 = beatPulse(b, 18, 20, 6);
    let Tx = tcx + (T[0] - tcx) * (1 + .03 * kp2) + Math.sin(t * 3 + i) * 1.3;
    let Ty = tcy + (T[1] - tcy) * (1 + .03 * kp2) + Math.cos(t * 2.6 + i * 1.7) * 1.3;
    const d = p.h2 * .42;
    const pg = E.inOutCubic(prog(b, 17 + d, 17.55 + d));
    const sw = Math.sin(Math.PI * pg) * (p.h3 - .5) * 260;
    let X = lerp(x, Tx, pg), Y = lerp(y, Ty, pg);
    X += sw * .6; Y -= sw;
    if (b >= 20) {
      const dt = (b - 20) * B;
      let dx = Tx - tcx, dy = Ty - tcy; const dl = Math.hypot(dx, dy) + 1e-3; dx /= dl; dy /= dl;
      const sp = 500 + 1300 * p.h4;
      const k = 4.5, disp = (1 - Math.exp(-k * dt)) / k;
      const vx = dx * sp + (p.h5 - .5) * 700, vy = dy * sp + (p.h1 - .5) * 700;
      X = Tx + vx * disp; Y = Ty + vy * disp;
      // sphere
      const ps = E.inOutCubic(prog(b, 20.25 + .35 * p.h5, 21.05 + .35 * p.h5));
      const kp3 = beatPulse(b, 20, 24, 6);
      const yy = 1 - 2 * (i + .5) / N_PARTS, rr = Math.sqrt(1 - yy * yy), phi = i * 2.399963;
      const ux = Math.cos(phi) * rr, uz = Math.sin(phi) * rr;
      const R = 330 * (1 + .07 * kp3) + 34 * Math.sin(ux * 3 + t * 3) * Math.sin(yy * 3 - t * 2.2) * Math.sin(uz * 3 + t * 1.3);
      let sx = ux * R, sy = yy * R, sz = uz * R;
      // ring target
      const pr = E.inOutCubic(prog(b, 22 + .3 * p.h6, 22.8 + .3 * p.h6));
      const face = E.inOutCubic(prog(b, 23.0, 23.6));
      const blast = E.inExpo(prog(b, 23.45, 24.0));
      const ra = i / N_PARTS * TAU + t * 2.4;
      const RR = (410 + (p.h1 - .5) * 46) * (1 + 3.4 * blast);
      const rx = Math.cos(ra) * RR, ry = (p.h2 - .5) * 30 * (1 - face), rz = Math.sin(ra) * RR;
      // rotate sphere
      const ay = t * .8, ax = lerp(.4, 0, face) ;
      const bx = lerp(sx, rx, pr), by = lerp(sy, ry, pr), bz = lerp(sz, rz, pr);
      let x1 = bx * Math.cos(ay) + bz * Math.sin(ay), z1 = -bx * Math.sin(ay) + bz * Math.cos(ay);
      if (pr > 0) { // ring spins in its own plane after it forms
        x1 = lerp(x1, bx, pr); z1 = lerp(z1, bz, pr);
      }
      const tiltR = lerp(ax, lerp(1.2, Math.PI / 2, face), pr);
      let y1 = by * Math.cos(tiltR) - z1 * Math.sin(tiltR); const z2 = by * Math.sin(tiltR) + z1 * Math.cos(tiltR);
      const f = 1300, zc = 1300;
      const persp = f / (z2 + zc);
      const px = W / 2 + x1 * persp, py = H / 2 + y1 * persp;
      X = lerp(X, px, ps); Y = lerp(Y, py, ps);
      size = lerp(1, clamp(persp, .5, 2.2), ps);
      alpha = lerp(alpha, alpha * clamp(persp * 1.1 - .15, .15, 1), ps);
    }
    x = X; y = Y;
  }
  out.x = x; out.y = y; out.s = size; out.a = alpha;
  out.c = p.h5 < .2 ? 1 : p.h5 < .25 ? 2 : 0;
}
const _pp = { x: 0, y: 0, s: 1, a: 1, c: 0 };
const PCOL = [C.paper, C.clay, C.sky];
function drawParticles(ctx, t, b, scale) {
  const base = Math.max(3.2, 1.5 / scale);
  const buckets = [];
  for (let c = 0; c < 3; c++) for (let a = 0; a < 4; a++) buckets.push([]);
  for (let i = 0; i < N_PARTS; i++) {
    particlesPos(i, t, b, _pp);
    const ai = Math.min(3, Math.floor(_pp.a * 4));
    buckets[_pp.c * 4 + ai].push(_pp.x, _pp.y, base * _pp.s * (_pp.c === 1 ? 1.25 : 1));
  }
  for (let k = 0; k < buckets.length; k++) {
    const arr = buckets[k]; if (!arr.length) continue;
    ctx.fillStyle = PCOL[Math.floor(k / 4)]; ctx.globalAlpha = ((k % 4) + 1) / 4;
    ctx.beginPath();
    for (let j = 0; j < arr.length; j += 3) { const s = arr[j + 2]; ctx.rect(arr[j] - s / 2, arr[j + 1] - s / 2, s, s); }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function vParticles(ctx, lt, t, b) {
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  const cam = camera3(t, b);
  drawParticles(ctx, t, b, (GRID.tw / W) * cam.S);
}

function vDimension(ctx, lt, t) {
  ctx.fillStyle = C.sky; ctx.fillRect(0, 0, W, H);
  const R = 300, r = 120, nu = 32, nv = 14;
  const ay = t * .9, ax = .95 + .25 * Math.sin(t * .8);
  const P = (u, v) => {
    let x = (R + r * Math.cos(v)) * Math.cos(u), y = r * Math.sin(v), z = (R + r * Math.cos(v)) * Math.sin(u);
    let x1 = x * Math.cos(ay) + z * Math.sin(ay), z1 = -x * Math.sin(ay) + z * Math.cos(ay);
    let y1 = y * Math.cos(ax) - z1 * Math.sin(ax), z2 = y * Math.sin(ax) + z1 * Math.cos(ax);
    const s = 1300 / (z2 + 1300);
    return [W / 2 + x1 * s, H / 2 - 30 + y1 * s, z2];
  };
  // shadow
  ctx.fillStyle = 'rgba(20,20,19,.16)';
  ctx.beginPath(); ctx.ellipse(W / 2, 930, 440, 50, 0, 0, TAU); ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u0 = i / nu * TAU, u1 = (i + 1) / nu * TAU, v0 = j / nv * TAU, v1 = (j + 1) / nv * TAU;
    const a = P(u0, v0), bb = P(u1, v0), c = P(u0, v1);
    const depth = clamp(.5 - a[2] / 900);
    ctx.strokeStyle = depth > .62 && (i + j) % 7 === 0 ? C.paper : C.ink;
    ctx.globalAlpha = .15 + .85 * depth; ctx.lineWidth = 3 + 6 * depth;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(bb[0], bb[1]); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}

function textOnPath(ctx, str, y0, amp, freq, speed, t, dir) {
  const n = str.length;
  const widths = []; let total = 0;
  for (let i = 0; i < n; i++) { const w = ctx.measureText(str[i]).width; widths.push(w); total += w; }
  let s = ((dir * t * speed) % total + total) % total - total;
  while (s < W + 200) {
    for (let i = 0; i < n; i++) {
      const x = s + widths[i] / 2;
      if (x > -200 && x < W + 200) {
        const y = y0 + amp * Math.sin(x * freq + t * 1.6);
        const dy = amp * freq * Math.cos(x * freq + t * 1.6);
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan(dy));
        ctx.fillText(str[i], -widths[i] / 2, 0); ctx.restore();
      }
      s += widths[i];
    }
  }
}
function vType(ctx, lt, t) {
  ctx.fillStyle = C.oat; ctx.fillRect(0, 0, W, H);
  font(ctx, SERIF, 190, 400, 'italic'); ctx.fillStyle = C.ink;
  textOnPath(ctx, 'kinetic typography · ', 470, 150, .0048, 260, t, -1);
  font(ctx, SANS, 120, 900, 'normal', 4); ctx.fillStyle = C.clay;
  textOnPath(ctx, 'ON A CURVE — ', 820, 90, .0062, 320, t + 1, 1);
}

let liquidC = null, liquidX = null, liquidImg = null;
function vLiquid(ctx, lt, t) {
  const w = 384, h = 216;
  if (!liquidC) {
    liquidC = document.createElement('canvas'); liquidC.width = w; liquidC.height = h;
    liquidX = liquidC.getContext('2d'); liquidImg = liquidX.createImageData(w, h);
  }
  const balls = [];
  for (let k = 0; k < 7; k++) {
    const R = 40 + 60 * hash(k + .3), sp = (.5 + hash(k + 9) * .9) * (k % 2 ? 1 : -1), ph = hash(k * 3.1) * TAU;
    balls.push([w / 2 + Math.cos(t * sp + ph) * (30 + 110 * hash(k + 4)),
                h / 2 + Math.sin(t * sp * 1.3 + ph) * (20 + 55 * hash(k + 7)),
                (14 + 16 * hash(k + 2.2)) ** 2]);
  }
  const d = liquidImg.data;
  const bg = [0x1F, 0x1E, 0x1D], cl = [0xD9, 0x77, 0x57], hi = [0xF3, 0xB8, 0x9C];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let k = 0; k < 7; k++) { const dx = x - balls[k][0], dy = y - balls[k][1]; v += balls[k][2] / (dx * dx + dy * dy + 1); }
    const a = clamp((v - .92) / .16), hl = clamp((v - 2.2) / 2.5) * .6;
    const i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) d[i + c] = lerp(bg[c], lerp(cl[c], hi[c], hl), a);
    d[i + 3] = 255;
  }
  liquidX.putImageData(liquidImg, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(liquidC, 0, 0, W, H);
}

function vRhythm(ctx, lt, t, b) {
  ctx.fillStyle = C.olive; ctx.fillRect(0, 0, W, H);
  const sx = W / 2 + Math.cos(t * .9) * 500, sy = H / 2 + Math.sin(t * 1.3) * 250;
  const kp = beatPulse(b, 8, 24, 5);
  for (let gy = 0; gy < 12; gy++) for (let gx = 0; gx < 21; gx++) {
    const x = 160 + gx * 80, y = 100 + gy * 80;
    const dd = Math.hypot(x - sx, y - sy);
    const w = .5 + .5 * Math.sin(dd * .016 - t * 7);
    const r = 5 + 30 * w * (1 + .3 * kp);
    ctx.fillStyle = w > .86 ? C.clay : C.paper;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}

function vLoop(ctx, lt, t) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round'; ctx.lineWidth = 24;
  for (let i = 0; i < 10; i++) {
    const r = 70 + i * 44;
    const a0 = t * (1.1 + i * .21) * (i % 2 ? 1 : -1);
    const len = Math.PI * (.55 + .45 * Math.sin(t * 2.2 + i * .55));
    ctx.strokeStyle = i % 3 === 1 ? C.clay : C.ink;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, r, a0, a0 + len); ctx.stroke();
  }
  ctx.fillStyle = C.clay; ctx.beginPath(); ctx.arc(W / 2, H / 2, 30, 0, TAU); ctx.fill();
  ctx.lineCap = 'butt';
}
const VIGNETTES = [vEasing, vMorph, vParticles, vDimension, vType, vLiquid, vRhythm, vLoop];

// ================================================================== SCENE 4 — THE DROP
function scene4(ctx, t, b) {
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  // paper disc riding inside the blasting ring (exit)
  const blast = E.inExpo(prog(b, 23.45, 24.0));
  if (blast > 0) {
    ctx.fillStyle = C.paper; ctx.globalAlpha = clamp(blast * 6);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 400 * (1 + 3.4 * blast) - 12, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawParticles(ctx, t, b, 1);
  // impact flash on the drop
  const fl = Math.exp(-(b - 16) * 6);
  if (fl > .01) { ctx.fillStyle = `rgba(240,238,230,${fl * .35})`; ctx.fillRect(0, 0, W, H); }

  // captions
  const cap = (txt, a0, a1, y) => {
    const a = prog(b, a0, a0 + .6) * (1 - prog(b, a1 - .3, a1));
    if (a <= 0) return;
    font(ctx, MONO, 17, 400, 'normal', 6); ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(240,238,230,${.7 * a})`;
    ctx.fillText(scramble(txt, prog(b, a0, a0 + .9), t, 3), W / 2, y);
    ctx.textAlign = 'left';
  };
  cap(`${N_PARTS.toLocaleString('en-US')} PARTICLES · ONE EQUATION EACH`, 18.1, 20.0, 880);
  cap('A SPHERE IS JUST POINTS WITH AN OPINION', 20.9, 22.4, 960);
  cap('NO ENGINE · NO PLUGINS · JUST MATH', 22.5, 23.5, 960);
}

// ================================================================== SCENE 5 — CRAFT
const S5 = { base: 560, size: 230 };
const WORDS = [
  { txt: 'frame.', fam: SANS, w: 900, st: 'normal', col: C.ink, ls: -8, acc: 'crop' },
  { txt: 'curve.', fam: SERIF, w: 400, st: 'italic', col: C.clay, ls: 0, acc: 'swoosh' },
  { txt: 'note.', fam: MONO, w: 700, st: 'normal', col: C.ink, ls: -6, acc: 'wave', size: .86 },
  { txt: 'pixel.', fam: SANS, w: 900, st: 'normal', col: C.ink, ls: -6, acc: 'pixel' },
];
function s5Measure(ctx) {
  if (S5.ew) return;
  font(ctx, SERIF, S5.size); S5.ew = ctx.measureText('Every').width;
  for (const wd of WORDS) { font(ctx, wd.fam, S5.size * (wd.size || 1), wd.w, wd.st, wd.ls); wd.width = ctx.measureText(wd.txt).width; }
  WORDS[3].width = 250 / 250 * (PIXEL_PTS.reduce((m, p) => Math.max(m, p[0]), 0) + 14) * (S5.size / 250);
}
function drawWord(ctx, k, x, y, t, b) {
  const wd = WORDS[k];
  const sz = S5.size * (wd.size || 1);
  if (wd.acc === 'pixel') {
    const sc = S5.size / 250;
    for (let i = 0; i < PIXEL_PTS.length; i++) {
      const [px, py] = PIXEL_PTS[i];
      const dl = hash(i * 3.3) * .3 + (px / 1200) * .25;
      const p = E.outBack(prog(b, 27 + dl, 27 + dl + .3), 2.5);
      if (p <= 0) continue;
      const s = 12.5 * sc * p;
      ctx.fillStyle = hash(i * 1.7) < .1 ? C.clay : C.ink;
      ctx.fillRect(x + px * sc - s / 2, y + (py - 300) * sc - s / 2 - 12, s, s);
    }
    return;
  }
  font(ctx, wd.fam, sz, wd.w, wd.st, wd.ls);
  ctx.fillStyle = wd.col;
  ctx.fillText(wd.txt, x, y);
}
function drawAccent(ctx, k, x, y, t, b) {
  const wd = WORDS[k];
  const p = prog(b, 24 + k, 24 + k + .6);
  if (wd.acc === 'crop') {
    const e = E.outExpo(p);
    const pad = lerp(90, 22, e);
    const x0 = x - pad, y0 = y - 190 - pad, x1 = x + wd.width + pad, y1 = y + 30 + pad;
    const L = 40;
    ctx.strokeStyle = C.clay; ctx.lineWidth = 5; ctx.globalAlpha = e;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
    ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
    ctx.moveTo(x1, y1 - L); ctx.lineTo(x1, y1); ctx.lineTo(x1 - L, y1);
    ctx.moveTo(x0 + L, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - L);
    ctx.stroke(); ctx.globalAlpha = 1;
  } else if (wd.acc === 'swoosh') {
    const e = E.inOutCubic(prog(b, 25.05, 25.55));
    ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const len = 900;
    ctx.setLineDash([len * e, 2000]);
    ctx.beginPath(); ctx.moveTo(x - 10, y + 40);
    ctx.bezierCurveTo(x + wd.width * .3, y + 95, x + wd.width * .7, y - 10, x + wd.width + 30, y + 30);
    ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
  } else if (wd.acc === 'wave') {
    // equaliser bars that bounce off the real soundtrack envelope
    const n = 7;
    for (let i = 0; i < n; i++) {
      const wv = window.WAVEFORM ? window.WAVEFORM[Math.floor((t / DUR) * 599 + i * 3) % 600] : .5;
      const hgt = 18 + 110 * wv * (0.5 + 0.5 * Math.sin(t * 20 + i * 1.7)) * E.outExpo(p);
      ctx.fillStyle = i % 2 ? C.clay : C.ink;
      ctx.fillRect(x + wd.width + 30 + i * 22, y - hgt, 12, hgt);
    }
  }
}
function scene5(ctx, t, b) {
  s5Measure(ctx);
  const pc = E.inExpo(prog(b, 27.55, 28.0));
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  ctx.save();
  const R = lerp(1200, DOT_R, pc);
  ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, TAU);
  ctx.fillStyle = pc > .75 ? mixHex(C.paper, C.clay, prog(pc, .75, .98)) : C.paper;
  ctx.fill(); ctx.clip();
  ctx.translate(W / 2, H / 2); const zs = lerp(1, .02, pc); ctx.scale(zs, zs); ctx.translate(-W / 2, -H / 2);

  const k = clamp(Math.floor(b - 24), 0, 3);
  const rp = E.outExpo(prog(b, 24 + k, 24 + k + .42));
  const wPrev = k > 0 ? WORDS[k - 1].width : WORDS[0].width;
  const wCur = lerp(wPrev, WORDS[k].width, rp);
  const gap = 46;
  const x0 = W / 2 - (S5.ew + gap + wCur) / 2;
  const y = S5.base;

  // "Every"
  const ep = E.outExpo(prog(b, 24, 24.45));
  ctx.save(); ctx.beginPath(); ctx.rect(0, y - 250, W, 330); ctx.clip();
  font(ctx, SERIF, S5.size); ctx.fillStyle = C.ink;
  ctx.fillText('Every', x0, y + (1 - ep) * 300);
  // rolling word slot
  const wx = x0 + S5.ew + gap;
  if (k > 0) {
    const op = E.outExpo(prog(b, 24 + k, 24 + k + .35));
    ctx.save(); ctx.translate(0, -op * 300); drawWord(ctx, k - 1, wx, y, t, b); ctx.restore();
  }
  ctx.save(); ctx.translate(0, (1 - rp) * 300); drawWord(ctx, k, wx, y, t, b); ctx.restore();
  ctx.restore();
  drawAccent(ctx, k, wx, y, t, b);

  // stats line
  const sp = prog(b, 24.4, 25.6);
  font(ctx, MONO, 19, 400, 'normal', 4); ctx.fillStyle = C.mid; ctx.textAlign = 'center';
  ctx.fillText(scramble('900 FRAMES  ·  0 KEYFRAMES  ·  0 SAMPLES  ·  1 HTML FILE', sp, t, 11), W / 2, y + 150);
  ctx.textAlign = 'left';

  // the real soundtrack, drawn from build/waveform.js
  const wf = window.WAVEFORM || new Array(600).fill(.3);
  const nb = 150, bx0 = 200, bx1 = W - 200, by = 900, bw = (bx1 - bx0) / nb;
  const play = t / DUR;
  const noteHi = prog(b, 26, 26.2) * (1 - prog(b, 26.8, 27.1));
  for (let i = 0; i < nb; i++) {
    let v = 0; for (let j = 0; j < 4; j++) v = Math.max(v, wf[i * 4 + j]);
    const g = E.outExpo(prog(b, 24.1 + i / nb * .6, 24.1 + i / nb * .6 + .4));
    const hgt = 4 + 90 * v * g;
    const played = i / nb < play;
    ctx.fillStyle = played ? (noteHi > 0 ? mixHex(C.ink, C.clay, noteHi) : C.ink) : 'rgba(20,20,19,.2)';
    ctx.fillRect(bx0 + i * bw + 1.5, by - hgt / 2, bw - 3, hgt);
  }
  const phx = lerp(bx0, bx1, play);
  ctx.fillStyle = C.clay; ctx.fillRect(phx - 1.5, by - 70, 3, 140);
  font(ctx, MONO, 14, 400, 'normal', 3); ctx.fillStyle = C.mid;
  ctx.fillText('SOUNDTRACK — SYNTHESIZED FROM CODE · 128 BPM', bx0, by - 86);
  ctx.textAlign = 'right';
  ctx.fillText(`0:${t.toFixed(2).padStart(5, '0')} / 0:15.00`, bx1, by - 86);
  ctx.textAlign = 'left';
  ctx.restore();
}

// ================================================================== SCENE 6 — SIGNATURE
const S6 = { size: 300, base: 590 };
function scene6(ctx, t, b) {
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  if (!S6.w) { font(ctx, SERIF, S6.size); S6.w = ctx.measureText('Claude').width;
    S6.xs = []; for (let k = 0; k <= 6; k++) S6.xs.push(ctx.measureText('Claude'.slice(0, k)).width); }
  const gap = 16;
  const left = W / 2 - (S6.w + gap + DOT_R * 2) / 2;
  const fx = left + S6.w + gap + DOT_R, fy = S6.base - DOT_R;
  const sx = left - DOT_R - 24;
  const fade = 1 - prog(b, 31.2, 31.8);

  // impact rings + sparks
  for (let k = 0; k < 2; k++) {
    const e = prog(b, 28 + k * .12, 29.4 + k * .12);
    if (e <= 0 || e >= 1) continue;
    ctx.strokeStyle = k ? C.paper : C.clay; ctx.globalAlpha = (1 - e) ** 2 * (k ? .35 : .9);
    ctx.lineWidth = 3 + 10 * (1 - e);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, DOT_R + 900 * E.outExpo(e), 0, TAU); ctx.stroke();
  }
  const spk = prog(b, 28, 28.8);
  if (spk > 0 && spk < 1) {
    ctx.strokeStyle = C.clay; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.globalAlpha = 1 - spk;
    ctx.beginPath();
    for (let k = 0; k < 18; k++) {
      const a = k / 18 * TAU + .1, r0 = 60 + 380 * E.outExpo(spk), r1 = r0 + 90 * (1 - spk) * (k % 2 ? .6 : 1);
      ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0);
      ctx.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1);
    }
    ctx.stroke(); ctx.lineCap = 'butt';
  }
  ctx.globalAlpha = 1;

  // dot path: hop to the left edge, then sweep right revealing the name
  const pa = E.inOutCubic(prog(b, 28.3, 28.85));
  const pb = E.inOutQuart(prog(b, 28.95, 29.98));
  let dx = lerp(W / 2, sx, pa), dy = lerp(H / 2, fy, pa) - Math.sin(Math.PI * pa) * 170;
  dx = lerp(dx, fx, pb);
  const revealX = pb > 0 ? dx - DOT_R * .2 : -1;

  // name, revealed behind the dot
  ctx.save(); ctx.globalAlpha = fade;
  ctx.beginPath(); ctx.rect(0, 0, Math.max(0, revealX), H); ctx.clip();
  font(ctx, SERIF, S6.size); ctx.fillStyle = C.paper;
  for (let k = 0; k < 6; k++) {
    const cxk = left + (S6.xs[k] + S6.xs[k + 1]) / 2;
    const passT = 28.95 + 1.03 * clamp((cxk - sx) / (fx - sx)) ;
    const rp = E.outBack(prog(b, passT - .12, passT + .5), 2);
    ctx.save();
    ctx.translate(left + S6.xs[k], S6.base + (1 - rp) * 60);
    ctx.fillText('Claude'[k], 0, 0); ctx.restore();
  }
  ctx.restore();

  // dot
  let s = 1 + .5 * Math.exp(-(b - 28) * 8) * (b >= 28);
  const land = t - 30 * B;
  const sq = land > 0 ? .35 * Math.exp(-land * 14) * Math.cos(land * 40) : 0;
  const blink = b > 31 ? 1 + .35 * Math.exp(-(b - 31) * 6) : 1;
  const end = 1 - E.inExpo(prog(b, 31.55, 32));
  const moving = pb > 0 && pb < 1 ? Math.min(.45, Math.abs(E.inOutQuart(prog(b + .02, 28.95, 29.98)) - pb) * 9) : 0;
  ctx.save(); ctx.translate(dx, dy + DOT_R * sq);
  ctx.scale(s * blink * end * (1 + sq * .8 + moving), s * blink * end * (1 - sq) / (1 + moving * .5));
  ctx.fillStyle = C.clay; ctx.beginPath(); ctx.arc(0, 0, DOT_R, 0, TAU); ctx.fill();
  ctx.restore();

  // sub lines
  const hl = E.outExpo(prog(b, 30.0, 30.8));
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(240,238,230,.22)';
  ctx.fillRect(W / 2 - 520 * hl, S6.base + 62, 1040 * hl, 1);
  font(ctx, MONO, 17, 400, 'normal', 8); ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(240,238,230,.75)';
  ctx.fillText(scramble('MOTION DESIGN  ·  DIRECTION  ·  CODE  ·  SOUND', prog(b, 30.05, 30.9), t, 21), W / 2, S6.base + 118);
  const ip = E.outExpo(prog(b, 30.5, 31.1));
  font(ctx, SERIF, 38, 400, 'italic'); ctx.fillStyle = C.oat;
  ctx.save(); ctx.beginPath(); ctx.rect(0, S6.base + 140, W, 70); ctx.clip();
  ctx.fillText('Available for your next launch.', W / 2, S6.base + 190 + (1 - ip) * 60);
  ctx.restore();
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}

// ================================================================== HUD
function hud(ctx, t, b) {
  const a = prog(b, .6, 1.4) * (1 - prog(b, 29.6, 30.2));
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.globalAlpha = a * .85;
  ctx.fillStyle = '#ffffff';
  const m = 54;
  font(ctx, MONO, 14, 400, 'normal', 3);
  ctx.fillText('CLAUDE — MOTION REEL ’26', m, m + 10);
  let si = 0; for (let i = 0; i < SCENES.length; i++) if (b >= SCENES[i][0]) si = i;
  ctx.textAlign = 'right';
  ctx.fillText(`0${si + 1} / 06 — ${SCENES[si][1]}`, W - m, m + 10);
  const f = Math.floor(t * FPS + 1e-6);
  const tc = `TC 00:00:${String(Math.floor(f / FPS)).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
  ctx.textAlign = 'left'; ctx.fillText(tc, m, H - m);
  ctx.textAlign = 'right'; ctx.fillText('128 BPM', W - m - 110, H - m);
  const beatIn = Math.floor(b) % 4;
  for (let k = 0; k < 4; k++) {
    const on = k === beatIn;
    const x = W - m - 88 + k * 24;
    if (on) ctx.fillRect(x, H - m - 12, 14, 14);
    else { ctx.globalAlpha = a * .35; ctx.fillRect(x, H - m - 12, 14, 14); ctx.globalAlpha = a * .85; }
  }
  // progress hairline
  ctx.globalAlpha = a * .3; ctx.fillRect(m, H - m + 18, (W - 2 * m), 1);
  ctx.globalAlpha = a * .85; ctx.fillRect(m, H - m + 17, (W - 2 * m) * (t / DUR), 3);
  ctx.restore();
}

// ================================================================== compositor
function render(ctx, t) {
  const b = t / B;
  ctx.save();
  if (b < 4) scene1(ctx, t, b);
  else if (b < 8) scene2(ctx, t, b);
  else if (b < 16) scene3(ctx, t, b);
  else if (b < 24) scene4(ctx, t, b);
  else if (b < 28) scene5(ctx, t, b);
  else scene6(ctx, t, b);
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
}

const canvas = document.getElementById('c');
const main = canvas.getContext('2d');
const scratch = document.createElement('canvas'); scratch.width = W; scratch.height = H;
const sctx = scratch.getContext('2d');
let VIG = null;

function finish(ctx, t, frame) {
  hud(ctx, t, t / B);
  // vignette
  if (!VIG) {
    VIG = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
    VIG.addColorStop(0, 'rgba(0,0,0,0)'); VIG.addColorStop(1, 'rgba(0,0,0,.28)');
  }
  ctx.fillStyle = VIG; ctx.fillRect(0, 0, W, H);
  // film grain
  ctx.save();
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .075;
  const g = GRAIN[frame % 4];
  const ox = -Math.floor(hash(frame * 1.3) * 256), oy = -Math.floor(hash(frame * 2.9) * 256);
  for (let y = oy; y < H; y += 256) for (let x = ox; x < W; x += 256) ctx.drawImage(g, x, y);
  ctx.restore();
  // fade out
  const fo = prog(t, DUR - .25, DUR);
  if (fo > 0) { ctx.fillStyle = `rgba(0,0,0,${fo})`; ctx.fillRect(0, 0, W, H); }
}

// motion blur: average SUB sub-frames across a 180° shutter
function drawFrame(frame, SUB = 6) {
  const t = frame / FPS;
  if (SUB <= 1) { render(main, t); finish(main, t, frame); return; }
  const shutter = .5 / FPS;
  const bt = t / B;
  // whip moments (zooms, blasts, collapses) get denser sampling so the blur stays silky
  if ([[3.45, 4.1], [7.5, 8.1], [15.2, 16.15], [23.4, 24.05], [27.5, 28.1]].some(([a, z]) => bt >= a && bt < z)) SUB = Math.max(SUB, 16);
  if (bt >= 4.0 && bt < 4.6) SUB = Math.max(SUB, 40);   // the seam split moves ~70px per frame
  for (let k = 0; k < SUB; k++) {
    const tk = Math.max(0, t + ((k + .5) / SUB - .5) * shutter);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    render(sctx, tk);
    main.globalAlpha = 1 / (k + 1);
    main.drawImage(scratch, 0, 0);
  }
  main.globalAlpha = 1;
  finish(main, t, frame);
}

async function boot() {
  const fams = [
    `400 10px ${SERIF}`, `italic 400 10px ${SERIF}`, `300 10px ${SANS}`, `500 10px ${SANS}`, `700 10px ${SANS}`,
    `900 10px ${SANS}`, `400 10px ${MONO}`, `700 10px ${MONO}`,
  ];
  await Promise.all(fams.map(f => document.fonts.load(f)));
  await document.fonts.ready;
  precompute(); makeGrain();
  window.drawFrame = drawFrame;
  window.REEL = { W, H, FPS, DUR, frames: DUR * FPS };
  const params = new URLSearchParams(location.search);
  if (params.has('render')) { document.body.classList.add('render'); window.READY = true; return; }
  if (params.has('t')) { drawFrame(Math.round(parseFloat(params.get('t')) * FPS), 4); return; }
  // live preview synced to the soundtrack
  drawFrame(0, 1);
  const btn = document.getElementById('play'), audio = document.getElementById('audio');
  btn.hidden = false;
  let playing = false;
  btn.onclick = () => { btn.hidden = true; audio.currentTime = 0; audio.play(); playing = true; };
  audio.onended = () => { playing = false; btn.hidden = false; };
  const loop = () => {
    if (playing) drawFrame(Math.min(DUR * FPS - 1, Math.floor(audio.currentTime * FPS)), 1);
    requestAnimationFrame(loop);
  };
  loop();
  window.READY = true;
}
boot();
})();
