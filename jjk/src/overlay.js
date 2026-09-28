// 2D layer composited over the 3D frame: subtitles, kanji title cards, technique call-outs,
// hand-drawn black lightning, ink wipes. Shots queue commands; draw() paints them in order.
import { rng } from './world.js';

const MINCHO = '"Shippori Mincho B1", "Noto Serif JP", serif';
const BRUSH = '"Yuji Syuku", "Shippori Mincho B1", serif';
const GOTHIC = '"Noto Sans JP", sans-serif';
const HEAVY = '"Dela Gothic One", "Noto Sans JP", sans-serif';
const LATIN = '"Oswald", "Noto Sans JP", sans-serif';

export class Overlay {
  constructor(canvas, w, h, source = null) {
    this.src = source; this.c = canvas; canvas.width = w; canvas.height = h; this.x = canvas.getContext('2d'); this.w = w; this.h = h; this.q = [];
  }
  clear() { this.q.length = 0; }
  add(fn) { this.q.push(fn); }
  draw() {
    const x = this.x; x.clearRect(0, 0, this.w, this.h);
    if (this.src) x.drawImage(this.src, 0, 0, this.w, this.h);
    for (const fn of this.q) { x.save(); fn(x, this.w, this.h); x.restore(); }
  }

  // ---- subtitles: Japanese line (small) above the English line, anime-fansub style
  sub(jp, en, a = 1) {
    this.add((x, W, H) => {
      x.globalAlpha = a; x.textAlign = 'center'; x.lineJoin = 'round';
      if (en) {
        x.font = `600 46px ${LATIN}`; x.letterSpacing = '1px';
        x.lineWidth = 9; x.strokeStyle = 'rgba(0,0,0,.92)'; x.strokeText(en, W / 2, H - 70);
        x.fillStyle = '#fbfbf6'; x.fillText(en, W / 2, H - 70);
      }
      if (jp) {
        x.font = `700 30px ${GOTHIC}`; x.letterSpacing = '2px';
        x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,.9)'; x.strokeText(jp, W / 2, H - 132);
        x.fillStyle = '#f2efe6'; x.fillText(jp, W / 2, H - 132);
      }
    });
  }
  // ---- location / time card (thin vertical mincho + small latin)
  location(jp, en, a = 1) {
    this.add((x, W, H) => {
      x.globalAlpha = a; x.fillStyle = '#efece4';
      x.font = `800 44px ${MINCHO}`; x.textAlign = 'center';
      [...jp].forEach((ch, i) => x.fillText(ch, W - 150, 170 + i * 52));
      x.font = `500 20px ${LATIN}`; x.letterSpacing = '6px'; x.textAlign = 'right';
      x.fillText(en, W - 196, 170 + [...jp].length * 52);
    });
  }
  // ---- technique call-out: huge kanji tearing across the frame, red slab behind, latin gloss under
  technique(jp, en, p, { color = '#f4f1ea', slab = '#b3121f', side = 'left', label = '術式' } = {}) {
    this.add((x, W, H) => {
      const e = Math.min(1, p * 5), out = p > .85 ? 1 - (p - .85) / .15 : 1;
      x.globalAlpha = out;
      const n = [...jp].length, size = 170;
      const x0 = side === 'left' ? 140 : W - 140 - size;
      // slab
      x.fillStyle = slab;
      const sh = (n * size + 60) * e;
      x.beginPath(); x.moveTo(x0 - 30, 110); x.lineTo(x0 + size + 20, 90); x.lineTo(x0 + size + 30, 110 + sh); x.lineTo(x0 - 20, 130 + sh); x.closePath(); x.fill();
      // label
      x.font = `800 40px ${MINCHO}`; x.fillStyle = '#0a0a0a'; x.textAlign = 'center';
      [...label].forEach((ch, i) => x.fillText(ch, x0 + size / 2, 80 - (label.length - 1 - i) * 0));
      x.fillStyle = '#f4f1ea'; x.font = `800 34px ${MINCHO}`;
      x.fillText(label, x0 + size / 2, 72);
      // kanji, each one slamming in
      [...jp].forEach((ch, i) => {
        const k = Math.max(0, Math.min(1, (p * 5 - i * .35)));
        if (k <= 0) return;
        const s = 1 + (1 - k) * .6;
        x.save(); x.translate(x0 + size / 2, 110 + size * (i + .82)); x.scale(s, s);
        x.font = `800 ${size}px ${MINCHO}`;
        x.lineWidth = 14; x.strokeStyle = '#050505'; x.strokeText(ch, 0, 0);
        x.fillStyle = color; x.fillText(ch, 0, 0);
        x.restore();
      });
      // english gloss
      x.font = `600 30px ${LATIN}`; x.letterSpacing = '8px'; x.textAlign = side === 'left' ? 'left' : 'right';
      x.lineWidth = 6; x.strokeStyle = '#000'; x.fillStyle = '#f4f1ea';
      const gx = side === 'left' ? x0 + size + 60 : x0 - 60;
      x.strokeText(en, gx, H - 170); x.fillText(en, gx, H - 170);
    });
  }
  // ---- centred title card (Domain Expansion, the film title)
  title(jp, en, a = 1, { size = 190, font = MINCHO, color = '#f4f1ea', bg = null, y = .5, enSize = 34, spacing = 18, stroke = true } = {}) {
    this.add((x, W, H) => {
      x.globalAlpha = a;
      if (bg) { x.fillStyle = bg; x.fillRect(0, 0, W, H); }
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `800 ${size}px ${font}`; x.letterSpacing = spacing + 'px';
      if (stroke) { x.lineWidth = size * .09; x.strokeStyle = '#040404'; x.strokeText(jp, W / 2, H * y); }
      x.fillStyle = color; x.fillText(jp, W / 2, H * y);
      if (en) { x.font = `600 ${enSize}px ${LATIN}`; x.letterSpacing = '12px'; x.fillText(en, W / 2, H * y + size * .72); }
    });
  }
  // ---- black lightning (the Ink Flash): jagged bolts from a point, black core with red fringe
  lightning(cx, cy, seed, { n = 7, len = 900, color = '#e0102a', core = '#000', width = 16, jitter = .5 } = {}) {
    this.add((x) => {
      const r = rng(seed);
      const bolt = (x0, y0, ang, L, w, depth) => {
        const pts = [[x0, y0]]; let px = x0, py = y0, a = ang;
        const segs = 14;
        for (let i = 0; i < segs; i++) { a += (r() - .5) * jitter * 2; const s = L / segs; px += Math.cos(a) * s; py += Math.sin(a) * s; pts.push([px, py]); }
        for (const [lw, st, glow] of [[w * 2.2, color, 28], [w, core, 0]]) {
          x.lineWidth = lw; x.strokeStyle = st; x.lineJoin = 'miter'; x.lineCap = 'round'; x.shadowColor = color; x.shadowBlur = glow;
          x.beginPath(); pts.forEach(([u, v], i) => { const k = 1 - i / segs; x.lineWidth = lw * (.3 + k); i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.stroke();
        }
        if (depth < 2) for (let k = 0; k < 2; k++) { const j = 3 + Math.floor(r() * 8); bolt(pts[j][0], pts[j][1], ang + (r() - .5) * 1.6, L * .45, w * .55, depth + 1); }
      };
      for (let i = 0; i < n; i++) bolt(cx, cy, (i / n) * Math.PI * 2 + r() * .6, len * (.6 + r() * .6), width, 0);
    });
  }
  // ---- ink splash wipe covering the frame from a point (p 0..1)
  inkWipe(cx, cy, p, seed = 1, color = '#030304') {
    this.add((x, W, H) => {
      const r = rng(seed); x.fillStyle = color;
      const R = Math.hypot(W, H) * p * 1.15;
      x.beginPath();
      const N = 90;
      for (let i = 0; i <= N; i++) {
        const a = i / N * Math.PI * 2; const k = .75 + r() * .5 + (i % 7 === 0 ? r() * .6 : 0);
        const rr = R * k; const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath(); x.fill();
      for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = R * (1 + r() * .35); x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, (4 + r() * 22) * p, 0, Math.PI * 2); x.fill(); }
    });
  }
  fill(color, a = 1) { this.add((x, W, H) => { x.globalAlpha = a; x.fillStyle = color; x.fillRect(0, 0, W, H); }); }
  // horizontal "cinematic" bars that slam in for dramatic beats
  bars(p, h = 120) { this.add((x, W, H) => { x.fillStyle = '#000'; x.fillRect(0, 0, W, h * p); x.fillRect(0, H - h * p, W, h * p); }); }
  // radial manga focus lines drawn with a brush feel (for stills / reaction shots)
  focusLines(cx, cy, seed, a = 1, { n = 160, r0 = 380, color = '#fff' } = {}) {
    this.add((x, W, H) => {
      const r = rng(seed); x.globalAlpha = a; x.fillStyle = color;
      for (let i = 0; i < n; i++) {
        const ang = r() * Math.PI * 2, w = .004 + r() * .012, rr = r0 * (.7 + r() * .7), R = 1600;
        x.beginPath(); x.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
        x.lineTo(cx + Math.cos(ang - w) * R, cy + Math.sin(ang - w) * R); x.lineTo(cx + Math.cos(ang + w) * R, cy + Math.sin(ang + w) * R); x.closePath(); x.fill();
      }
    });
  }
  text(str, px, py, { font = `800 60px ${MINCHO}`, color = '#fff', a = 1, align = 'center', stroke = 0, ls = 0 } = {}) {
    this.add((x) => { x.globalAlpha = a; x.font = font; x.textAlign = align; x.letterSpacing = ls + 'px'; if (stroke) { x.lineWidth = stroke; x.strokeStyle = '#000'; x.strokeText(str, px, py); } x.fillStyle = color; x.fillText(str, px, py); });
  }
}
export const FONTS = { MINCHO, BRUSH, GOTHIC, HEAVY, LATIN };
