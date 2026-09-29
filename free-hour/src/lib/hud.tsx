// The running HUD: where we are in time (log scale), what carries fun, and how many share one experience.
// Both the time marker and the audience counter follow keyframes tied to the beats of each chapter.
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { CHAPTERS, F, palAt, prog, ease, lerp } from './theme';
import { fmt } from './kit';

type K = [number, number, string];            // [local frame, value, caption]
const AUD: Record<string, K[]> = {
  fire:   [[40, 30, 'around one fire']],
  city:   [[60, 2, 'at one board'], [214, 14000, 'in one theatre'], [386, 50000, 'in one arena']],
  page:   [[40, 1, 'reader at a time']],
  clock:  [[340, 100000, 'in one stadium']],
  signal: [[60, 12, 'around one gramophone'], [158, 1000, 'in one cinema'], [248, 1000000, 'on one radio broadcast'], [338, 50000000, 'watching one show'], [440, 600000000, 'watching at once']],
  screen: [[60, 2, 'at one console'], [170, 1, 'in one pair of headphones'], [366, 3000000000, 'players · each on their own']],
  ai:     [[40, 1, 'made for you alone']],
};
const YRS: Record<string, [number, number][]> = {
  fire: [[0, 40000]], city: [[0, 5000], [372, 1945]], page: [[0, 585]], clock: [[0, 175], [340, 135]],
  signal: [[0, 148], [158, 130], [248, 105], [338, 70], [440, 56]], screen: [[0, 53], [170, 46], [266, 34], [366, 18]], ai: [[0, 3]],
};
const X0 = 600, X1 = 1320;
const xOf = (ya: number) => interpolate(Math.log10(ya), [.3, 4.75], [X1, X0]);
const TICKS: [number, string][] = [[40000, '40,000'], [5000, '5,000'], [500, '500'], [100, '100'], [10, '10'], [2, 'NOW']];

// flatten keyframes onto the absolute timeline
const flat = <T,>(src: Record<string, T[]>, map: (k: T, from: number) => [number, T]) =>
  CHAPTERS.flatMap((c) => (src[c.id] ?? []).map((k) => map(k, c.from)));
const AK = flat(AUD, (k, from) => [from + k[0], k]);
const YK = flat(YRS, (k, from) => [from + k[0], k]);
function track<T>(keys: [number, T][], f: number, d: number): [T, T, number] {
  let i = -1; for (let j = 0; j < keys.length; j++) if (f >= keys[j][0]) i = j;
  if (i < 0) return [keys[0][1], keys[0][1], 1];
  const prev = keys[Math.max(0, i - 1)][1], cur = keys[i][1];
  return [prev, cur, i === 0 ? 1 : prog(f, keys[i][0], d, ease.inOut)];
}

export const HUD: React.FC = () => {
  const f = useCurrentFrame();
  const eras = CHAPTERS.filter((c) => YRS[c.id] !== undefined);
  const first = eras[0], last = eras[eras.length - 1];
  const vis = Math.min(prog(f, first.from + 40, 24), 1 - prog(f, last.from + last.dur - 20, 20, ease.in));
  if (vis <= 0) return null;
  const pal = palAt(f);
  let i = eras.findIndex((c) => f < c.from + c.dur); if (i < 0) i = eras.length - 1;
  const cur = eras[i];
  const [y0, y1, yk] = track(YK, f, 40);
  const mx = lerp(xOf(y0[1]), xOf(y1[1]), yk);
  const [a0, a1, ak] = track(AK, f, 34);
  const aud = Math.exp(lerp(Math.log(a0[1]), Math.log(a1[1]), ak));
  const capA = ak < 1 ? prog(f, 0, 1) * Math.abs(ak * 2 - 1) : 1;
  const cap = ak < .5 ? a0[2] : a1[2];
  const sw = prog(f, cur.from, 18);
  const y = 1000;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: vis, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 120, top: y - 64, width: 1680, height: 1, background: pal.dim, opacity: .35 }} />
      <div style={{ position: 'absolute', left: 120, top: y - 46 }}>
        <div style={{ fontFamily: F.mono, fontSize: 15, letterSpacing: 3, color: pal.dim }}>CARRIER</div>
        <div style={{ fontFamily: F.sans, fontSize: 27, color: pal.ink, marginTop: 6, opacity: sw, transform: `translateY(${(1 - sw) * 8}px)` }}>{cur.carrier}</div>
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0 }}>
        <line x1={X0} y1={y - 8} x2={X1} y2={y - 8} stroke={pal.dim} strokeWidth={1.5} opacity={.6} />
        <line x1={X0} y1={y - 8} x2={mx} y2={y - 8} stroke={pal.acc} strokeWidth={2.5} />
        {TICKS.map(([ya, l]) => (
          <g key={l}><line x1={xOf(ya)} y1={y - 14} x2={xOf(ya)} y2={y - 2} stroke={pal.dim} strokeWidth={1} />
            <text x={xOf(ya)} y={y + 26} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={15} letterSpacing={1} fill={pal.dim}>{l}</text></g>
        ))}
        <circle cx={mx} cy={y - 8} r={11} fill={pal.acc} opacity={.25} />
        <circle cx={mx} cy={y - 8} r={6} fill={pal.acc} />
        <text x={X0} y={y - 30} fontFamily="JetBrains Mono" fontSize={15} letterSpacing={2.5} fill={pal.dim}>YEARS AGO · LOG SCALE</text>
      </svg>
      <div style={{ position: 'absolute', right: 120, top: y - 46, textAlign: 'right' }}>
        <div style={{ fontFamily: F.mono, fontSize: 15, letterSpacing: 3, color: pal.dim }}>ONE EXPERIENCE, SHARED BY</div>
        <div style={{ marginTop: 2, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 14 }}>
          <span style={{ fontFamily: F.sans, fontSize: 19, color: pal.dim, opacity: capA }}>{cap}</span>
          <span style={{ fontFamily: F.mono, fontSize: 34, color: pal.acc, fontVariantNumeric: 'tabular-nums' }}>{fmt(aud)}</span>
        </div>
      </div>
    </div>
  );
};
