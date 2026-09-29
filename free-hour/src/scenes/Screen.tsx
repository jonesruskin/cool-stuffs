// 07 The Screen — 1972 → today. Interactive, then personal, then made by everyone, then infinite.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import { PAL, prog, ease, lerp, env, F } from '../lib/theme';
import { ChapterHead, Cap, Tag, Draw, Line } from '../lib/kit';

const P = PAL.screen;
const stage = (f: number, a: number, b: number) => env(f, a, b, 14, 14);
const tri = (t: number) => 1 - Math.abs(((t % 2) + 2) % 2 - 1);   // 0..1..0 triangle wave

const Pong: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const X0 = 510, Y0 = 250, W = 900, H = 520;
  const bx = X0 + 40 + tri(f / 46) * (W - 80), by = Y0 + 30 + tri(f / 31 + .3) * (H - 60);
  const pl = Y0 + lerp(40, H - 130, tri(f / 31 + .3)) , pr = Y0 + lerp(60, H - 150, tri(f / 31 + .25));
  return (
    <g opacity={o}>
      <rect x={X0 - 20} y={Y0 - 20} width={W + 40} height={H + 40} rx={36} fill="#05030b" stroke={P.dim} strokeWidth={2} />
      {Array.from({ length: 13 }, (_, i) => <rect key={i} x={X0 + W / 2 - 4} y={Y0 + 10 + i * 40} width={8} height={22} fill={P.ink} opacity={.5} />)}
      <rect x={X0 + 20} y={pl} width={18} height={96} fill={P.ink} />
      <rect x={X0 + W - 38} y={pr} width={18} height={96} fill={P.ink} />
      <rect x={bx - 9} y={by - 9} width={18} height={18} fill={P.acc2} />
      <text x={X0 + W / 2 - 90} y={Y0 + 90} fontFamily="JetBrains Mono" fontSize={72} fill={P.ink} opacity={.8} textAnchor="middle">{Math.floor(f / 46) % 10}</text>
      <text x={X0 + W / 2 + 90} y={Y0 + 90} fontFamily="JetBrains Mono" fontSize={72} fill={P.ink} opacity={.8} textAnchor="middle">{Math.floor(f / 61) % 10}</text>
      {Array.from({ length: 52 }, (_, i) => <rect key={i} x={X0} y={Y0 + i * 10} width={W} height={2} fill="#000" opacity={.35} />)}
    </g>
  );
};
const Walkman: React.FC<{ f: number; o: number }> = ({ f, o }) => (
  <g opacity={o}>
    <path d="M760 330 C760 150 1160 150 1160 330" stroke={P.ink} strokeWidth={10} fill="none" strokeLinecap="round" />
    <rect x={730} y={300} width={60} height={110} rx={24} fill={P.acc} /><rect x={1130} y={300} width={60} height={110} rx={24} fill={P.acc} />
    <rect x={810} y={420} width={300} height={400} rx={22} fill="#120a24" stroke={P.ink} strokeWidth={2.5} />
    <rect x={840} y={460} width={240} height={150} rx={10} fill="#05030b" stroke={P.dim} strokeWidth={1.5} />
    {[900, 1020].map((x, k) => <g key={k} transform={`translate(${x} 535) rotate(${f * 9})`}>
      <circle r={36} fill="none" stroke={P.ink} strokeWidth={2} />{[0, 60, 120, 180, 240, 300].map((a) => <line key={a} x1={0} y1={0} x2={Math.cos(a * Math.PI / 180) * 30} y2={Math.sin(a * Math.PI / 180) * 30} stroke={P.ink} strokeWidth={2} />)}</g>)}
    {[0, 1, 2, 3].map((k) => <rect key={k} x={850 + k * 58} y={660} width={46} height={30} rx={6} fill={k === 1 ? P.acc2 : '#241845'} />)}
    {Array.from({ length: 4 }, (_, k) => { const t = ((f + k * 12) % 48) / 48; return <path key={k} d={`M${1200 + t * 120} ${300 - t * 40} q20 -20 0 -40`} stroke={P.acc2} strokeWidth={3} fill="none" opacity={1 - t} />; })}
  </g>
);
const NODES = Array.from({ length: 70 }, (_, i) => { const a = random(`na${i}`) * Math.PI * 2, r = Math.sqrt(random(`nr${i}`)) * 330; return { x: 960 + Math.cos(a) * r * 1.35, y: 530 + Math.sin(a) * r * .9 }; });
const EDGES = NODES.flatMap((a, i) => NODES.map((b, j) => [i, j, Math.hypot(a.x - b.x, a.y - b.y)] as const).filter(([, j, d]) => j > i && d < 150));
const Web: React.FC<{ f: number; o: number }> = ({ f, o }) => (
  <g opacity={o}>
    {EDGES.map(([i, j], k) => { const p = prog(f, 270 + k * .15, 12); const a = NODES[i], b = NODES[j];
      return <line key={k} x1={a.x} y1={a.y} x2={lerp(a.x, b.x, p)} y2={lerp(a.y, b.y, p)} stroke={P.acc2} strokeWidth={1} opacity={.45} />; })}
    {NODES.map((n, i) => { const p = prog(f, 268 + i * .6, 10);
      const up = prog(f, 300 + (i % 17) * 2.5, 16, ease.out);
      return <g key={i}><circle cx={n.x} cy={n.y} r={4 * p} fill={P.ink} />
        {i % 3 === 0 && up > 0 && <g transform={`translate(${n.x} ${n.y - up * 40}) scale(${up})`} opacity={1 - prog(f, 350, 12)}>
          <rect x={-22} y={-15} width={44} height={30} rx={6} fill={P.acc} /><path d="M-5 -8 L8 0 L-5 8 Z" fill="#fff" /></g>}</g>; })}
  </g>
);
const Feed: React.FC<{ f: number; o: number; blur: number }> = ({ f, o, blur }) => {
  const T = 'translate(96 -10) scale(.9)';
  const t = Math.max(0, f - 368), scroll = t * t * .06 + t * 4;
  return (
    <g opacity={o} transform={T}>
      <defs><clipPath id="phone"><rect x={790} y={180} width={340} height={660} rx={34} /></clipPath>
        <filter id="mb"><feGaussianBlur stdDeviation={`0 ${blur * 18}`} /></filter></defs>
      <rect x={776} y={166} width={368} height={688} rx={46} fill="#120a24" stroke={P.ink} strokeWidth={3} />
      <g clipPath="url(#phone)" filter={blur > .05 ? 'url(#mb)' : undefined}>
        <rect x={790} y={180} width={340} height={660} fill="#05030b" />
        {Array.from({ length: 60 }, (_, i) => {
          const y = 236 + i * 250 - (scroll % (250 * 40)); if (y < -300 || y > 900) return null;
          const hue = [P.acc, P.acc2, '#ffd166', '#8b7cff'][i % 4], kind = i % 4;
          return (
            <g key={i}>
              <circle cx={822} cy={y + 12} r={12} fill={hue} opacity={.8} /><rect x={842} y={y + 6} width={110} height={10} rx={5} fill={P.ink} opacity={.7} />
              <rect x={806} y={y + 32} width={308} height={160} rx={14} fill={hue} opacity={.22} />
              {kind === 0 && <><circle cx={1060} cy={y + 70} r={18} fill={hue} /><path d={`M806 ${y + 192} L900 ${y + 110} L960 ${y + 160} L1020 ${y + 120} L1114 ${y + 192} Z`} fill={hue} opacity={.7} /></>}
              {kind === 1 && <><circle cx={960} cy={y + 112} r={34} fill={hue} opacity={.9} /><path d={`M950 ${y + 96} L976 ${y + 112} L950 ${y + 128} Z`} fill="#05030b" /></>}
              {kind === 2 && Array.from({ length: 18 }, (_, k) => <rect key={k} x={824 + k * 16} y={y + 112 - (20 + 40 * Math.abs(Math.sin(k * .7 + i)))} width={9} height={2 * (20 + 40 * Math.abs(Math.sin(k * .7 + i)))} rx={4} fill={hue} />)}
              {kind === 3 && <><rect x={836} y={y + 60} width={120} height={104} rx={10} fill={hue} opacity={.8} /><rect x={970} y={y + 70} width={120} height={12} rx={6} fill={P.ink} opacity={.6} /><rect x={970} y={y + 94} width={90} height={10} rx={5} fill={P.dim} /></>}
              <path d={`M814 ${y + 214} c0 -8 10 -12 14 -4 c4 -8 14 -4 14 4 c0 8 -14 16 -14 16 s-14 -8 -14 -16 Z`} fill={P.acc} opacity={.9} />
              <rect x={850} y={y + 206} width={60} height={10} rx={5} fill={P.dim} opacity={.8} />
            </g>
          );
        })}
        <rect x={790} y={180} width={340} height={44} fill="#05030b" /><rect x={930} y={192} width={60} height={16} rx={8} fill="#120a24" />
        <text x={812} y={210} fontFamily="Inter" fontSize={15} fill={P.ink}>9:41</text>
        <rect x={790} y={784} width={340} height={56} fill="#0b0716" />
        {[0, 1, 2, 3, 4].map((k) => <circle key={k} cx={826 + k * 67} cy={812} r={9} fill={k === 0 ? P.ink : P.dim} opacity={.8} />)}
      </g>
    </g>
  );
};

export const Screen: React.FC = () => {
  const f = useCurrentFrame();
  const blur = prog(f, 500, 60, ease.in);
  const swarm = prog(f, 505, 40);
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <Pong f={f} o={stage(f, 70, 170)} />
        <Walkman f={f} o={stage(f, 170, 266)} />
        <Web f={f} o={stage(f, 266, 366)} />
        <Feed f={f} o={stage(f, 366, 640)} blur={blur} />
        {/* the notification swarm: everything competing for the same hour */}
        {swarm > 0 && Array.from({ length: 70 }, (_, i) => {
          const a = random(`sw${i}`) * Math.PI * 2, r = 300 + random(`sr${i}`) * 520, sp = .01 + random(`ss${i}`) * .02;
          const x = 960 + Math.cos(a + f * sp) * r * 1.4, y = 520 + Math.max(-300, Math.min(300, Math.sin(a + f * sp) * r * .62));
          const p = prog(f, 505 + i * .7, 10);
          return <g key={i} opacity={p * (1 - prog(f, 628, 16, ease.in))}><rect x={x - 60} y={y - 18} width={120} height={36} rx={18} fill="#1d1238" stroke={[P.acc, P.acc2][i % 2]} strokeWidth={1.5} />
            <circle cx={x - 38} cy={y} r={8} fill={[P.acc, P.acc2][i % 2]} /><rect x={x - 22} y={y - 4} width={62} height={8} rx={4} fill={P.dim} /></g>;
        })}
      </svg>
      <Tag id="game" text="video games" x={120} y={260} at={70} out={506} pal={P} />
      <Tag id="rhythm" text="music in your pocket" x={120} y={340} at={180} out={506} pal={P} />
      <Tag id="making" text="everyone a creator" x={1800} y={260} at={280} out={506} pal={P} align="right" />
      <Tag id="story" text="streaming, feeds, forever" x={1800} y={340} at={380} out={506} pal={P} align="right" />
      <Cap text="1972: fun became interactive." at={68} out={166} color={P.ink} em={['interactive.']} emColor={P.acc2} />
      <Cap text="1979: then personal." at={180} out={262} color={P.ink} em={['personal.']} emColor={P.acc} />
      <Cap text="1991: the Web. 2005: anyone could broadcast." at={276} out={362} color={P.ink} em={['anyone']} emColor={P.acc2} />
      <Cap text="2007: then infinite." at={376} out={436} color={P.ink} em={['infinite.']} emColor={P.acc} />
      <Cap text="Today, over 3 billion people play video games." at={444} out={500} color={P.ink} em={['3', 'billion']} emColor={P.acc2} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(5,3,11,.92) 0%, rgba(5,3,11,.75) 35%, rgba(5,3,11,.35) 70%)', opacity: swarm }} />
      <ChapterHead n={7} kicker="1972 – today" title="The Screen" pal={P} dur={648} />
      <Line text="Endless supply." at={516} out={640} y={470} size={120} color={P.ink} />
      <Line text="Scarce attention." at={560} out={640} y={600} size={120} color={P.acc} italic />
    </AbsoluteFill>
  );
};
