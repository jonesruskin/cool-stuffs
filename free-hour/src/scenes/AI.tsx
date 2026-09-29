// 08 The Audience of One — 2022 →. Fun that is generated for you; the audience curve collapses to 1.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import { PAL, prog, ease, lerp, env, F } from '../lib/theme';
import { ChapterHead, Cap, Tag, Person, fmt, CONSTANTS, GLYPH } from '../lib/kit';
import { Flame } from '../lib/fire';

const P = PAL.ai;
const FIRE = PAL.fire;
const stage = (f: number, a: number, b: number) => env(f, a, b, 14, 14);

// drifting field of "neurons"
const PTS = Array.from({ length: 150 }, (_, i) => ({ x: random(`px${i}`) * 1920, y: 120 + random(`py${i}`) * 760, s: .3 + random(`ps${i}`) * .7, ph: random(`pp${i}`) * 6.28 }));
const Field: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const pos = PTS.map((p) => ({ x: p.x + Math.sin(f / 60 + p.ph) * 30 * p.s, y: p.y + Math.cos(f / 70 + p.ph) * 22 * p.s }));
  return (
    <g opacity={o}>
      {pos.map((a, i) => pos.slice(i + 1, i + 8).map((b, j) => { const d = Math.hypot(a.x - b.x, a.y - b.y); return d < 150 && <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={P.acc} strokeWidth={.8} opacity={(1 - d / 150) * .35} />; }))}
      {pos.map((a, i) => <circle key={i} cx={a.x} cy={a.y} r={1.5 + PTS[i].s * 2} fill={i % 5 ? P.acc : P.acc2} opacity={.55} />)}
    </g>
  );
};

const STORY = 'Once, by a fire, a stranger began a story written only for you';
const StoryCard: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const n = Math.floor(Math.max(0, f - 76) * 1.2);
  const chip = prog(f, 128, 12);
  return (
    <div style={{ position: 'absolute', left: 560, top: 300, width: 800, opacity: o, background: 'rgba(21,17,41,.85)', border: `1px solid ${P.acc}55`, borderRadius: 24, padding: '40px 48px',
      boxShadow: `0 0 80px ${P.acc}33` }}>
      <div style={{ fontFamily: F.mono, fontSize: 14, letterSpacing: 4, color: P.acc2 }}>GENERATING · FOR YOU</div>
      <div style={{ fontFamily: F.serif, fontSize: 46, lineHeight: 1.2, color: P.ink, marginTop: 16, minHeight: 112 }}>
        {STORY.slice(0, n)}<span style={{ color: P.acc, opacity: Math.floor(f / 8) % 2 ? 1 : .2 }}>|</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 24, opacity: chip, transform: `translateY(${(1 - chip) * 10}px)` }}>
        {['Follow the stranger', 'Stay by the fire'].map((t, k) => (
          <div key={t} style={{ fontFamily: F.sans, fontSize: 22, color: k ? '#0b0914' : P.ink, background: k ? P.acc2 : 'transparent', border: `1px solid ${P.acc2}`, borderRadius: 999, padding: '10px 22px' }}>→ {t}</div>
        ))}
      </div>
    </div>
  );
};
const Music: React.FC<{ f: number; o: number }> = ({ f, o }) => (
  <g opacity={o}>
    {Array.from({ length: 72 }, (_, i) => {
      const x = 420 + i * 15, form = prog(f, 150 + Math.abs(i - 36) * .6, 20, ease.out);
      const h = (40 + 170 * Math.abs(Math.sin(i * .37 + f * .12) * Math.sin(i * .11 - f * .05))) * form;
      const sy = lerp(PTS[i].y, 520, form), sx = lerp(PTS[i].x, x, form);
      return <rect key={i} x={sx} y={sy - h / 2} width={8} height={Math.max(4, h)} rx={4} fill={i % 7 ? P.acc : P.acc2} />;
    })}
    <text x={960} y={720} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={18} letterSpacing={4} fill={P.dim} opacity={prog(f, 168, 12)}>A SONG THAT DID NOT EXIST A MOMENT AGO</text>
  </g>
);
const World: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const tiles: React.ReactNode[] = [];
  for (let q = -6; q <= 6; q++) for (let r = -6; r <= 6; r++) {
    const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); if (d > 6) continue;
    const p = prog(f, 236 + d * 6, 14, ease.out);
    if (p <= 0) continue;
    const x = 960 + (q + r * .5) * 88, y = 540 + r * 50 - (1 - p) * 40;
    const hue = [P.acc, P.acc2, '#8b7cff', '#c4b5fd'][Math.floor(random(`t${q}${r}`) * 4)];
    tiles.push(<path key={`${q},${r}`} d={`M${x} ${y - 25} L${x + 44} ${y} L${x} ${y + 25} L${x - 44} ${y} Z`} fill={hue} opacity={p * (.25 + .5 * random(`o${q}${r}`))} stroke={P.bg} strokeWidth={2} />);
  }
  return <g opacity={o}>{tiles}<Person x={960} y={540} s={1.3} color={P.ink} pose="stand" /></g>;
};

// the audience of one experience, era by era (log scale)
const SERIES: [string, number][] = [['Fire', 30], ['City', 50000], ['Page', 1], ['Clock', 100000], ['Signal', 6e8], ['Screen', 3e9], ['AI', 1]];
const Chart: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const X = (i: number) => 360 + i * 200, Y = (v: number) => 760 - (Math.log10(v) / 9.6) * 480;
  const draw = prog(f, 312, 70, ease.inOut);
  const plunge = prog(f, 388, 22, ease.in);
  const pts = SERIES.slice(0, 6).map(([, v], i) => `${X(i)},${Y(v)}`).join(' ');
  return (
    <g opacity={o}>
      {[1, 1e3, 1e6, 1e9].map((v) => <g key={v}><line x1={320} x2={1600} y1={Y(v)} y2={Y(v)} stroke={P.dim} strokeWidth={1} opacity={.3} strokeDasharray="4 8" />
        <text x={300} y={Y(v) + 6} textAnchor="end" fontFamily="JetBrains Mono" fontSize={17} fill={P.dim}>{v === 1 ? '1' : v === 1e3 ? '1K' : v === 1e6 ? '1M' : '1B'}</text></g>)}
      <polyline points={pts} fill="none" stroke={P.ink} strokeWidth={3} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
      {SERIES.slice(0, 6).map(([n, v], i) => { const a = prog(f, 312 + i * 11, 10);
        return <g key={n} opacity={a}><circle cx={X(i)} cy={Y(v)} r={7} fill={P.ink} />
          <text x={X(i)} y={808} textAnchor="middle" fontFamily="Instrument Serif" fontSize={30} fill={P.ink}>{n}</text>
          <text x={X(i) + 16} y={Y(v) + (i === 1 || i === 5 ? -16 : 26)} textAnchor="start" fontFamily="JetBrains Mono" fontSize={18} fill={P.ink} opacity={.8}>{v >= 1e9 ? '3B' : v >= 1e6 ? '600M' : fmt(v)}</text></g>; })}
      {plunge > 0 && <>
        <line x1={X(5)} y1={Y(3e9)} x2={lerp(X(5), X(6), plunge)} y2={lerp(Y(3e9), Y(1), plunge)} stroke={P.acc} strokeWidth={4} style={{ filter: `drop-shadow(0 0 10px ${P.acc})` }} />
        <circle cx={X(6)} cy={Y(1)} r={10 * plunge} fill={P.acc} />
        <text x={X(6)} y={808} textAnchor="middle" fontFamily="Instrument Serif" fontSize={30} fill={P.acc} opacity={plunge}>AI</text>
        <text x={X(6) + 26} y={Y(1) + 10} fontFamily="Instrument Serif" fontSize={64} fill={P.acc} opacity={prog(f, 404, 14)}>1</text>
      </>}
      <text x={120} y={230} fontFamily="JetBrains Mono" fontSize={18} letterSpacing={4} fill={P.dim}>ONE EXPERIENCE, SHARED BY · LOG SCALE</text>
    </g>
  );
};

const RING = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2 + .2; return { i, x: 960 + Math.cos(a) * 330, y: 610 + Math.sin(a) * 80, front: Math.sin(a) > 0 }; }).filter((r) => Math.abs(r.x - 1180) > 60 || r.y < 640);
const Return: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const warm = prog(f, 540, 40, ease.inOut);
  const orbPulse = 1 + Math.sin(f / 10) * .05;
  const person = (r: typeof RING[number]) => { const p = prog(f, 560 + r.i * 3, 16); if (p <= 0) return null;
    return <g key={r.i} opacity={p}><Person x={r.x} y={r.y} s={1.1} color={r.front ? '#120804' : '#7a4222'} rim={r.front ? FIRE.acc : undefined} pose="sit" /></g>; };
  return (
    <g opacity={o}>
      <defs><radialGradient id="orb"><stop offset="0" stopColor="#fff" /><stop offset=".3" stopColor={P.acc} /><stop offset="1" stopColor={P.acc} stopOpacity="0" /></radialGradient></defs>
      {RING.filter((r) => !r.front).map(person)}
      <g opacity={1 - warm}>
        <circle cx={960} cy={500} r={150 * orbPulse} fill="url(#orb)" opacity={.9} />
        {CONSTANTS.map((c, k) => { const a = f / 40 + (k / 6) * Math.PI * 2, rx = 300, ry = 110; const x = 960 + Math.cos(a) * rx, y = 500 + Math.sin(a) * ry;
          return <g key={c.id} transform={`translate(${x - 22} ${y - 22}) scale(.44)`} opacity={.55 + .45 * Math.sin(a)}>{GLYPH[c.id].map((d, i) => <path key={i} d={d} stroke={P.acc2} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}</g>; })}
      </g>
      {warm > 0 && <g opacity={warm}><Flame x={960} y={600} s={.62} outer={FIRE.acc} mid={FIRE.acc2} seed="ret" logs /></g>}
      <Person x={lerp(960, 1180, warm)} y={lerp(790, 700, warm)} s={lerp(2, 1.25, warm)} color="#0a0503" rim={warm > .5 ? FIRE.acc : P.acc} pose="sit" />
      {RING.filter((r) => r.front).map(person)}
    </g>
  );
};

export const AI: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <ChapterHead n={8} kicker="2022 →" title="The Audience of One" pal={P} dur={648} />
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <Field f={f} o={stage(f, 20, 304) * .8} />
        <Music f={f} o={stage(f, 148, 230)} />
        <World f={f} o={stage(f, 230, 304)} />
        <Chart f={f} o={stage(f, 304, 456)} />
        <Return f={f} o={prog(f, 456, 20)} />
      </svg>
      <StoryCard f={f} o={stage(f, 72, 150)} />
      <Tag id="story" text="stories that answer you" x={120} y={260} at={80} out={300} pal={P} />
      <Tag id="rhythm" text="songs on demand" x={120} y={340} at={158} out={300} pal={P} />
      <Tag id="game" text="worlds that adapt to you" x={120} y={420} at={238} out={300} pal={P} />
      <Cap text="Now fun can be generated — a story written for you, as you read." at={74} out={148} color={P.ink} size={40} em={['generated']} emColor={P.acc2} />
      <Cap text="Music no one has heard before." at={156} out={228} color={P.ink} />
      <Cap text="Worlds that build themselves as you explore." at={236} out={300} color={P.ink} />
      <Cap text="For 40,000 years, the shared audience mostly grew." at={318} out={386} color={P.ink} />
      <Cap text="Now an experience can be made for exactly one." at={392} out={452} color={P.ink} em={['one.']} emColor={P.acc} />
      <Cap text="A machine can make endless stories." at={468} out={540} color={P.ink} />
      <Cap text="It can't sit by the fire with you." at={552} out={644} color={P.ink} em={['fire']} emColor={FIRE.acc} italic />
    </AbsoluteFill>
  );
};
