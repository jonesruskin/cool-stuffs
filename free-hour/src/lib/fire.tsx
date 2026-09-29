// A living flame drawn from layered, wobbling tongues, plus rising sparks and a warm floor glow.
import React from 'react';
import { useCurrentFrame, random } from 'remotion';

const tongue = (t: number, seed: number, w: number, h: number, lean: number) => {
  const s = (k: number, a: number) => Math.sin(t * (0.09 + seed * .013) * k + seed * 3.1 + a);
  const tipX = lean + s(1, 0) * w * .35, tipY = -h * (1 + s(1.7, 1) * .12);
  const lx = -w * (1 + s(1.3, 2) * .1), rx = w * (1 + s(1.1, 3) * .1);
  return `M ${lx} 0 C ${lx} ${-h * .45}, ${tipX - w * .35} ${-h * .62 + s(2.1, 4) * h * .06}, ${tipX} ${tipY}
          C ${tipX + w * .38} ${-h * .6 + s(1.9, 5) * h * .06}, ${rx} ${-h * .42}, ${rx} 0 C ${rx * .6} ${h * .18}, ${lx * .6} ${h * .18}, ${lx} 0 Z`;
};

export const Flame: React.FC<{ x: number; y: number; s?: number; outer: string; mid: string; core?: string; sparks?: number; seed?: string; glow?: number; logs?: boolean }> =
  ({ x, y, s = 1, outer, mid, core = '#fff4dc', sparks = 26, seed = 'f', glow = 1, logs = false }) => {
    const f = useCurrentFrame();
    const layers: [string, number, number, number][] = [[outer, 70, 230, .95], [mid, 50, 170, 1], [core, 28, 100, 1]];
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <defs>
          <radialGradient id={`glow${seed}`}><stop offset="0" stopColor={outer} stopOpacity={.5 * glow} /><stop offset="1" stopColor={outer} stopOpacity="0" /></radialGradient>
        </defs>
        <filter id={`heat${seed}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16" /></filter>
        <ellipse cx={0} cy={-60} rx={520} ry={420} fill={`url(#glow${seed})`} />
        <g filter={`url(#heat${seed})`} opacity={.85}>
          {[-1, 0, 1].map((k) => <path key={k} d={tongue(f, k + 2, 90 * (k ? .7 : 1), 260 * (k ? .75 : 1), k * 40)} fill={outer} transform={`translate(${k * 40} 0)`} />)}
        </g>
        {logs && <g>
          <rect x={-150} y={-14} width={300} height={30} rx={15} fill="#1d0f07" transform="rotate(9)" />
          <rect x={-150} y={-14} width={300} height={30} rx={15} fill="#26140a" transform="rotate(-9)" />
          <path d="M-130 -8 L130 -8" stroke={outer} strokeWidth={3} opacity={.5} transform="rotate(-9)" strokeLinecap="round" />
        </g>}
        {layers.map(([c, w, h, o], i) => (
          <g key={i} opacity={o}>
            {[-1, 0, 1].map((k) => <path key={k} d={tongue(f, i * 3 + k + 2, w * (k ? .62 : 1), h * (k ? .7 : 1), k * w * .55)} fill={c} transform={`translate(${k * w * .45} 0)`} />)}
          </g>
        ))}
        {Array.from({ length: sparks }, (_, i) => {
          const life = 50 + random(`${seed}l${i}`) * 50, t = ((f + random(`${seed}o${i}`) * life) % life) / life;
          const px = (random(`${seed}x${i}`) - .5) * 120 + Math.sin(t * 7 + i) * 30 * t, py = -80 - t * (300 + random(`${seed}h${i}`) * 260);
          return <circle key={i} cx={px} cy={py} r={2.4 * (1 - t) + .6} fill={i % 3 ? mid : core} opacity={(1 - t) * .9} />;
        })}
      </g>
    );
  };

// A small breathing ember (the film's recurring motif: one free hour).
export const Ember: React.FC<{ x: number; y: number; r?: number; color: string; hot?: string; pulse?: number }> = ({ x, y, r = 7, color, hot = '#fff1d6', pulse = 1 }) => {
  const f = useCurrentFrame();
  const b = 1 + Math.sin(f / 9) * .12 * pulse;
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs><radialGradient id="emb"><stop offset="0" stopColor={color} stopOpacity=".55" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient></defs>
      <circle r={r * 9 * b} fill="url(#emb)" />
      <circle r={r * b} fill={color} />
      <circle r={r * .45 * b} fill={hot} />
    </g>
  );
};
