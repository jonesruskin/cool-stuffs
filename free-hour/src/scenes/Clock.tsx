// 05 The Clock — 1850. Work gets measured; free time gets won, then sold.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { PAL, prog, ease, lerp, env, F } from '../lib/theme';
import { ChapterHead, Cap, Tag, Draw, Label } from '../lib/kit';

const P = PAL.clock;
const CY = 500, R = 230;

const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
};

export const Clock: React.FC = () => {
  const f = useCurrentFrame();
  const CX = lerp(640, 960, prog(f, 200, 50, ease.inOut));
  const clockA = prog(f, 66, 20) * (1 - prog(f, 330, 24, ease.in));
  const donut = prog(f, 196, 70, ease.inOut);
  const barsA = env(f, 80, 200, 12, 16);
  const leisure = prog(f, 338, 30);
  const spin = f < 196 ? (f - 56) * 14 : (196 - 56) * 14;
  const bars: [string, number, string][] = [['1850s', 65, '60–70'], ['1900', 55, '~55'], ['1940', 40, '40']];
  const seg: [string, string, number][] = [['WORK', P.dim, 0], ['REST', P.acc2, 1], ['WHAT WE WILL', P.acc, 2]];
  const wheel = f / 1.8;
  const coaster = 'M140 820 C220 820 240 560 330 560 C420 560 430 760 520 760 C600 760 610 620 690 620 C760 620 780 820 860 820';
  return (
    <AbsoluteFill>
      <ChapterHead n={5} kicker="1850" title="The Clock" pal={P} dur={504} />
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <g opacity={clockA}>
          {/* clock face → 24-hour ring */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={P.ink} strokeWidth={2} opacity={1 - donut} />
          {Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2, l = i % 5 ? 10 : 24;
            return <line key={i} x1={CX + Math.cos(a) * (R - l)} y1={CY + Math.sin(a) * (R - l)} x2={CX + Math.cos(a) * R} y2={CY + Math.sin(a) * R}
              stroke={P.ink} strokeWidth={i % 5 ? 1 : 2.5} opacity={(1 - donut) * prog(f, 56 + i * .5, 8)} />; })}
          <g opacity={1 - donut}>
            <line x1={CX} y1={CY} x2={CX + Math.cos((spin / 12 - 90) * Math.PI / 180) * 120} y2={CY + Math.sin((spin / 12 - 90) * Math.PI / 180) * 120} stroke={P.ink} strokeWidth={6} strokeLinecap="round" />
            <line x1={CX} y1={CY} x2={CX + Math.cos((spin - 90) * Math.PI / 180) * 190} y2={CY + Math.sin((spin - 90) * Math.PI / 180) * 190} stroke={P.acc} strokeWidth={3} strokeLinecap="round" />
            <circle cx={CX} cy={CY} r={8} fill={P.acc} />
          </g>
          {seg.map(([name, col, k]) => {
            const a0 = -Math.PI / 2 + k * (Math.PI * 2 / 3) + .02, a1 = a0 + (Math.PI * 2 / 3) * prog(f, 214 + k * 16, 30, ease.inOut) - .04;
            const mid = -Math.PI / 2 + (k + .5) * (Math.PI * 2 / 3);
            return (
              <g key={name} opacity={donut}>
                {a1 > a0 && <path d={arc(CX, CY, R, a0, a1)} stroke={col} strokeWidth={k === 2 ? 46 : 34} fill="none" />}
                <text x={CX + Math.cos(mid) * (R + 64)} y={CY + Math.sin(mid) * (R + 64) + 6} textAnchor={Math.cos(mid) > .3 ? 'start' : Math.cos(mid) < -.3 ? 'end' : 'middle'} fontFamily="JetBrains Mono" fontSize={18} letterSpacing={4}
                  fill={col === P.dim ? P.ink : col} opacity={prog(f, 236 + k * 16, 14)}>{name}</text>
              </g>
            );
          })}
          <text x={CX} y={CY + 14} textAnchor="middle" fontFamily="Instrument Serif" fontSize={64} fill={P.ink} opacity={donut}>24h</text>
        </g>
        {/* work-week bars */}
        <g opacity={barsA}>
          {bars.map(([yr, v, lab], i) => {
            const h = v * 5.4 * prog(f, 92 + i * 14, 30, ease.out), x = 1140 + i * 190;
            return (
              <g key={yr}>
                <rect x={x} y={760 - h} width={110} height={h} fill={i === 0 ? P.acc : P.acc2} opacity={i === 0 ? 1 : .75} />
                <text x={x + 55} y={760 - h - 18} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={30} fill={P.ink}>{lab}</text>
                <text x={x + 55} y={798} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={18} letterSpacing={2} fill={P.dim}>{yr}</text>
              </g>
            );
          })}
          <line x1={1110} y1={760} x2={1740} y2={760} stroke={P.dim} strokeWidth={1.5} />
          <text x={1110} y={318} fontFamily="JetBrains Mono" fontSize={16} letterSpacing={4} fill={P.dim}>HOURS OF WORK PER WEEK</text>
        </g>
        {/* the leisure industry */}
        <g opacity={leisure}>
          <Draw d={coaster} at={346} dur={40} color={P.ink} width={3} />
          <Draw d={Array.from({ length: 14 }, (_, i) => { const x = 170 + i * 50; return `M${x} 830 L${x} ${830 - 40 - (i % 3) * 60}`; })} at={352} dur={20} stagger={2} color={P.dim} width={1.5} />
          {/* coaster car travelling the track */}
          {(() => { const t = ((f - 360) / 70) % 1; if (f < 380) return null;
            const pts = [[140, 820], [330, 560], [520, 760], [690, 620], [860, 820]];
            const seg2 = Math.min(3, Math.floor(t * 4)), u = t * 4 - seg2;
            const [x0, y0] = pts[seg2], [x1, y1] = pts[seg2 + 1];
            return <rect x={lerp(x0, x1, u) - 18} y={lerp(y0, y1, u) - 12 - Math.sin(u * Math.PI) * 30} width={36} height={16} rx={4} fill={P.acc} />; })()}
          {/* Ferris wheel */}
          <g transform={`translate(1250 560) scale(.9)`} opacity={prog(f, 360, 20)}>
            <circle r={230} fill="none" stroke={P.ink} strokeWidth={2.5} />
            <circle r={200} fill="none" stroke={P.dim} strokeWidth={1} />
            {Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2 + wheel * Math.PI / 180;
              return <g key={i}><line x1={0} y1={0} x2={Math.cos(a) * 230} y2={Math.sin(a) * 230} stroke={P.dim} strokeWidth={1} />
                <rect x={Math.cos(a) * 230 - 13} y={Math.sin(a) * 230} width={26} height={20} rx={4} fill={i % 4 ? P.acc2 : P.acc} /></g>; })}
            <path d="M-120 290 L0 0 L120 290" stroke={P.ink} strokeWidth={3} fill="none" />
            <circle r={12} fill={P.ink} />
          </g>
        </g>
      </svg>
      <Label text="1884 · Coney Island coaster" at={392} x={150} y={836} color={P.dim} rule={false} size={15} />
      <Label text="1893 · the Ferris wheel" at={404} x={1250} y={836} color={P.dim} align="center" rule={false} size={15} />
      <Tag id="together" text="the pub, the park, the terraces" x={1800} y={250} at={372} pal={P} align="right" />
      <Tag id="rhythm" text="music halls" x={1800} y={330} at={388} pal={P} align="right" />
      <Tag id="game" text="football leagues · 1888" x={1800} y={490} at={420} pal={P} align="right" />
      <Tag id="thrill" text="roller coasters, fairgrounds" x={1800} y={410} at={404} pal={P} align="right" />
      <Cap text="Factories ran on the clock: 60 hours a week, or more." at={66} out={198} color={P.ink} em={['clock:']} emColor={P.acc} />
      <Cap text="“Eight hours for work, eight for rest, eight for what we will.”" at={212} out={336} color={P.ink} italic em={['will.”']} emColor={P.acc} />
      <Label text="labour movement slogan · 1880s" at={240} out={330} x={960} y={852} color={P.dim} align="center" rule={false} size={14} />
      <Cap text="The weekend was won — and free time became something you could buy." at={350} out={500} color={P.ink} em={['buy.']} emColor={P.acc} size={40} />
    </AbsoluteFill>
  );
};
