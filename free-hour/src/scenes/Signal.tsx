// 06 The Signal — 1877 → 1969. Sound kept, pictures moving, then one broadcast into every home.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import { PAL, prog, ease, lerp, env } from '../lib/theme';
import { ChapterHead, Cap, Tag, Draw, Person, Counter, Label } from '../lib/kit';

const P = PAL.signal;
const stage = (f: number, a: number, b: number) => env(f, a, b, 14, 14);

const Phonograph: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const rot = f * 6;
  const wave = Array.from({ length: 120 }, (_, i) => { const x = 1190 + i * 5, amp = Math.min(1, i / 30) * 60 * prog(f, 90, 30);
    return `${i ? 'L' : 'M'}${x} ${260 + Math.sin(i * .35 - f * .5) * amp * (0.6 + 0.4 * Math.sin(i * .07))}`; }).join(' ');
  return (
    <g opacity={o}>
      <g transform={`translate(760 560) rotate(${rot})`}>
        <circle r={180} fill="#0a1416" stroke={P.dim} strokeWidth={1.5} />
        {Array.from({ length: 22 }, (_, i) => <circle key={i} r={52 + i * 5.8} fill="none" stroke={P.dim} strokeWidth={.7} opacity={.5} />)}
        <path d="M0 0 L180 -30 A182 182 0 0 1 178 30 Z" fill={P.acc} opacity={.08} />
        <circle r={46} fill={P.acc2} /><circle r={5} fill="#0a1416" />
      </g>
      {/* tone arm from the pivot to the record, horn rising from the pivot */}
      <Draw d={['M990 470 L870 560', 'M990 470 L990 420']} at={66} dur={18} color={P.ink} width={5} />
      <circle cx={990} cy={470} r={10} fill={P.ink} opacity={prog(f, 66, 10)} />
      <g opacity={prog(f, 72, 16)}>
        <path d="M982 420 C1000 360 1040 300 1090 250 L1150 310 C1090 340 1030 380 998 426 Z" fill={P.acc} opacity={.9} />
        <ellipse cx={1122} cy={278} rx={52} ry={88} transform="rotate(45 1122 278)" fill={P.acc2} opacity={.25} stroke={P.acc} strokeWidth={4} />
      </g>
      <path d={wave} stroke={P.acc} strokeWidth={3} fill="none" opacity={prog(f, 92, 10)} />
    </g>
  );
};
const Cinema: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const flick = .85 + random(`fl${Math.floor(f / 2)}`) * .15;
  const bx = 1120 + ((f * 7) % 380);
  return (
    <g opacity={o}>
      <defs><linearGradient id="beam" x1="0" x2="1"><stop offset="0" stopColor={P.acc2} stopOpacity=".6" /><stop offset="1" stopColor={P.acc2} stopOpacity=".05" /></linearGradient></defs>
      <path d="M600 520 L1100 300 L1100 740 Z" fill="url(#beam)" opacity={flick} />
      <rect x={1100} y={300} width={500} height={440} fill="#0d1d20" stroke={P.ink} strokeWidth={2} />
      <rect x={1100} y={300} width={500} height={440} fill={P.acc2} opacity={.12 * flick} />
      <Person x={bx} y={640} s={2} color={P.ink} pose="stand" opacity={flick} />
      <rect x={440} y={470} width={170} height={110} rx={10} fill="#0c1a1d" stroke={P.ink} strokeWidth={2} />
      {[480, 570].map((x, k) => <g key={k} transform={`translate(${x} 430) rotate(${f * 8})`}>
        <circle r={44} fill="none" stroke={P.ink} strokeWidth={2} />{[0, 120, 240].map((a) => <circle key={a} cx={Math.cos(a * Math.PI / 180) * 24} cy={Math.sin(a * Math.PI / 180) * 24} r={9} fill={P.ink} />)}</g>)}
    </g>
  );
};
const HOUSES = Array.from({ length: 12 }, (_, i) => ({ x: 250 + i * 130 + (i > 5 ? 120 : 0), y: 800 }));
const Radio: React.FC<{ f: number; o: number }> = ({ f, o }) => (
  <g opacity={o}>
    <Draw d={['M960 360 L880 780', 'M960 360 L1040 780', 'M905 650 L1015 650', 'M920 560 L1000 560', 'M935 460 L985 460', 'M880 780 L1015 650', 'M1040 780 L905 650']}
      at={250} dur={24} stagger={2} color={P.ink} width={2.5} />
    <circle cx={960} cy={352} r={10} fill={P.acc} />
    {Array.from({ length: 6 }, (_, k) => { const t = ((f - 262 + k * 14) % 84) / 84; if (f < 262) return null;
      return <circle key={k} cx={960} cy={352} r={20 + t * 900} fill="none" stroke={P.acc} strokeWidth={2} opacity={(1 - t) * .7} />; })}
    {HOUSES.map((h, i) => {
      const d = Math.hypot(h.x - 960, h.y - 352); const lit = prog(f, 262 + d / 11, 8);
      return <g key={i} transform={`translate(${h.x} ${h.y})`}>
        <path d="M-40 0 L-40 -50 L0 -84 L40 -50 L40 0 Z" fill="#0b1a1e" stroke={P.dim} strokeWidth={1.5} />
        <rect x={-14} y={-40} width={28} height={24} fill={P.acc2} opacity={lit} />
      </g>;
    })}
  </g>
);
const TV: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const sync = .75 + .25 * Math.sin(f * .9) * Math.sin(f * .37);
  return (
    <g opacity={o}>
      {Array.from({ length: 11 * 6 }, (_, i) => {
        const c = i % 11, r = Math.floor(i / 11), x = 600 + c * 100, y = 250 + r * 92;
        const on = prog(f, 340 + (c + r) * 1.4, 8) * (random(`w${i}`) > .18 ? 1 : .08);
        return <g key={i}><rect x={x} y={y} width={70} height={60} fill="#08171b" stroke={P.dim} strokeWidth={1} />
          <rect x={x} y={y} width={70} height={60} fill={P.acc} opacity={on * sync * .75} /></g>;
      })}
    </g>
  );
};

export const Signal: React.FC = () => {
  const f = useCurrentFrame();
  const moon = prog(f, 428, 30);
  return (
    <AbsoluteFill>
      <ChapterHead n={6} kicker="1877 – 1969" title="The Signal" pal={P} dur={576} />
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <Phonograph f={f} o={stage(f, 60, 158)} />
        <Cinema f={f} o={stage(f, 158, 248)} />
        <Radio f={f} o={stage(f, 248, 338)} />
        <TV f={f} o={stage(f, 338, 430)} />
        <g opacity={moon}>
          <defs>
            <radialGradient id="tvglow" cx=".5" cy=".5"><stop offset="0" stopColor={P.acc} stopOpacity=".35" /><stop offset="1" stopColor={P.acc} stopOpacity="0" /></radialGradient>
            <clipPath id="tvs"><rect x={1020} y={250} width={600} height={420} rx={40} /></clipPath>
          </defs>
          <ellipse cx={1320} cy={520} rx={640} ry={420} fill="url(#tvglow)" />
          <rect x={990} y={220} width={660} height={480} rx={56} fill="#0b1c20" stroke={P.ink} strokeWidth={3} />
          <g clipPath="url(#tvs)">
            <rect x={1020} y={250} width={600} height={420} fill="#0f2226" />
            <path d="M1020 560 C1180 520 1440 520 1620 570 L1620 670 L1020 670 Z" fill={P.dim} opacity={.8} />
            {[[1110, 600, 26], [1480, 610, 18], [1300, 640, 12]].map(([x, y, r], k) => <ellipse key={k} cx={x} cy={y} rx={r * 1.6} ry={r * .5} fill="#0f2226" opacity={.6} />)}
            <g transform="translate(1290 470)" fill={P.ink}>
              <path d="M-40 60 L-26 20 L26 20 L40 60 M-30 60 L-44 90 M30 60 L44 90" stroke={P.ink} strokeWidth={4} fill="none" />
              <rect x={-30} y={-14} width={60} height={36} /><path d="M-18 -14 L0 -40 L18 -14 Z" />
            </g>
            <line x1={1380} y1={470} x2={1380} y2={560} stroke={P.ink} strokeWidth={3} /><rect x={1380} y={470} width={40} height={24} fill={P.acc2} />
            {Array.from({ length: 42 }, (_, i) => <rect key={i} x={1020} y={250 + i * 10} width={600} height={3} fill="#000" opacity={.28} />)}
            <rect x={1020} y={250} width={600} height={420} fill="#fff" opacity={.04 + .03 * Math.sin(f * .8)} />
          </g>
          {Array.from({ length: 11 }, (_, i) => <Person key={i} x={250 + i * 140} y={800} s={2.1} color="#020607" rim={P.acc} pose="couch" />)}
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 120, top: 300, opacity: env(f, 436, 572, 14, 12) }}>
        <div style={{ fontFamily: '"JetBrains Mono"', fontSize: 18, letterSpacing: 4, color: P.dim }}>MOON LANDING · 1969 · WATCHED LIVE (EST.)</div>
        <div style={{ fontFamily: '"JetBrains Mono"', fontSize: 88, color: P.acc, marginTop: 6 }}><Counter from={1000} to={600000000} at={440} dur={44} /></div>
      </div>
      <Label text="each window: a home tuned to the same broadcast" at={352} out={424} x={960} y={836} color={P.dim} align="center" rule={false} size={18} />
      <Label text="1877 · the phonograph" at={70} out={150} x={760} y={800} color={P.dim} align="center" rule={false} size={15} />
      <Tag id="rhythm" text="records, then radio" x={120} y={260} at={80} out={428} pal={P} />
      <Tag id="story" text="cinema & radio drama" x={120} y={340} at={170} out={428} pal={P} />
      <Tag id="together" text="the family round the set" x={120} y={420} at={350} out={428} pal={P} />
      <Cap text="1877: sound could be kept." at={74} out={154} color={P.ink} em={['kept.']} emColor={P.acc} />
      <Cap text="1895: pictures learned to move." at={166} out={244} color={P.ink} em={['move.']} emColor={P.acc2} />
      <Cap text="1920: the signal came into the home." at={256} out={334} color={P.ink} em={['home.']} emColor={P.acc} />
      <Cap text="1950s: millions watched the same thing, at the same moment." at={346} out={426} color={P.ink} size={40} />
      <Cap text="One broadcast. An estimated 600 million people at once —" at={440} out={504} color={P.ink} size={40} />
      <Cap text="the largest audience in history. And the most passive." at={508} out={574} color={P.ink} size={40} em={['passive.']} emColor={P.acc} />
    </AbsoluteFill>
  );
};
void lerp;
