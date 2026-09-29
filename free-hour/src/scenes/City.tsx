// 03 The City — 5,000 years ago. Rules on a board; then the crowd separates from the show.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import { PAL, prog, ease, lerp, env } from '../lib/theme';
import { ChapterHead, Cap, Tag, Draw, Person, Counter } from '../lib/kit';

const P = PAL.city;

// ---------------------------------------------------------------- Senet
const BX = 560, BY = 420, CELL = 80;
const cellXY = (n: number): [number, number] => {             // boustrophedon path through the 3×10 board
  const row = Math.floor(n / 10), col = row % 2 === 0 ? n % 10 : 9 - (n % 10);
  return [BX + col * CELL + CELL / 2, BY + row * CELL + CELL / 2];
};
const Senet: React.FC<{ f: number }> = ({ f }) => {
  const out = prog(f, 198, 22, ease.in);
  if (out >= 1) return null;
  const grid = [
    `M${BX} ${BY} h800 v240 h-800 Z`,
    ...Array.from({ length: 9 }, (_, i) => `M${BX + (i + 1) * CELL} ${BY} v240`),
    `M${BX} ${BY + 80} h800`, `M${BX} ${BY + 160} h800`,
  ];
  const marks = [[14, 'ankh'], [25, 'x'], [26, 'iii'], [27, 'ii'], [28, 'i']] as const;
  const pieces = Array.from({ length: 10 }, (_, i) => ({ i, start: i, cone: i % 2 === 0 }));
  return (
    <g opacity={1 - out} transform={`translate(0 ${-out * 30})`}>
      <Draw d={grid} at={70} dur={32} stagger={2} color={P.ink} width={2.2} />
      {marks.map(([n, m], k) => { const [x, y] = cellXY(n); const a = prog(f, 96 + k * 3, 14);
        return <text key={k} x={x} y={y + 12} textAnchor="middle" fontFamily="Instrument Serif" fontSize={34} fill={P.acc2} opacity={a * .8}>{m === 'ankh' ? '☥' : m === 'x' ? '✕' : m === 'iii' ? 'III' : m === 'ii' ? 'II' : 'I'}</text>; })}
      {pieces.map((p) => {
        // one piece per beat hops straight down to the next row (no two pieces ever share a square)
        const t = prog(f, 110 + p.i * 9, 12, ease.inOut);
        const [x0, y0] = cellXY(p.i), [x1, y1] = cellXY(19 - p.i);
        const x = lerp(x0, x1, t), y = lerp(y0, y1, t) - Math.sin(Math.PI * t) * 46;
        const a = prog(f, 100 + p.i * 2, 12);
        return p.cone
          ? <path key={p.i} d={`M${x - 20} ${y + 24} L${x} ${y - 26} L${x + 20} ${y + 24} Z`} fill={P.acc} opacity={a} />
          : <rect key={p.i} x={x - 17} y={y - 24} width={34} height={48} rx={8} fill={P.ink} opacity={a} />;
      })}
    </g>
  );
};

// ---------------------------------------------------------------- theatre → arena
const N = 1400;
const THEATRE = Array.from({ length: N }, (_, i) => {
  const row = Math.floor(i / (N / 16)), r = 170 + row * 25;
  const a = lerp(Math.PI * 1.1, Math.PI * 1.9 + .1, random(`ta${i}`)) ;
  return { x: 960 + Math.cos(a) * r * 1.12, y: 745 + Math.sin(a) * r, row };
});
const ARENA = Array.from({ length: N * 2 }, (_, i) => {
  const ring = i % 22, a = random(`aa${i}`) * Math.PI * 2;
  return { x: 960 + Math.cos(a) * (250 + ring * 11.5), y: 505 + Math.sin(a) * (145 + ring * 7.8) };
});

export const City: React.FC = () => {
  const f = useCurrentFrame();
  const morph = prog(f, 372, 50, ease.inOut);
  const split = prog(f, 470, 30, ease.inOut);
  const theatreA = prog(f, 206, 20) * (1 - prog(f, 540, 30, ease.in));
  return (
    <AbsoluteFill>
      <ChapterHead n={3} kicker="5,000 years ago" title="The City" pal={P} dur={576} />
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <Senet f={f} />
        <g opacity={theatreA}>
          {/* orchestra (stage) → arena floor */}
          <ellipse cx={960} cy={lerp(745, 505, morph)} rx={lerp(84, 225, morph)} ry={lerp(84, 124, morph)} fill={P.bg2}
            stroke={split > 0 ? P.acc : P.dim} strokeWidth={lerp(1.5, 3, split)} />
          {morph > .02 && <ellipse cx={960} cy={505} rx={512} ry={322} fill="none" stroke={P.dim} strokeWidth={1.5} opacity={morph * .6} />}
          {THEATRE.map((d, i) => {
            const on = prog(f, 214 + d.row * 5 + random(`td${i}`) * 8, 10);
            const t = ARENA[i];
            const x = lerp(d.x, t.x, morph), y = lerp(d.y, t.y, morph);
            return <circle key={i} cx={x} cy={y} r={3.4} fill={split > 0 ? P.dim : P.ink} opacity={on * lerp(.7, .45, split)} />;
          })}
          {ARENA.slice(N).map((t, i) => { const on = prog(f, 404 + (i % 22) * 2, 12);
            return on > 0 && <circle key={i} cx={t.x} cy={t.y} r={3.4} fill={split > 0 ? P.dim : P.ink} opacity={on * lerp(.7, .45, split)} />; })}
          {/* performers */}
          {[[-40, 0], [0, -18], [40, 4]].map(([dx, dy], k) => (
            <Person key={k} x={960 + dx * lerp(1, 2.4, morph) + (k === 1 ? Math.sin(f / 9) * 30 * morph : 0)} y={lerp(757, 527, morph) + dy} s={lerp(.8, 1.1, morph)} color={P.acc} pose="stand"
              opacity={prog(f, 226 + k * 6, 14) * (k === 1 ? 1 - morph * .0 : 1)} />
          ))}
        </g>
      </svg>
      {/* counters */}
      <div style={{ position: 'absolute', right: 150, top: 150, textAlign: 'right', opacity: env(f, 250, 548, 16, 20) }}>
        <div style={{ fontFamily: '"JetBrains Mono"', fontSize: 16, letterSpacing: 4, color: P.dim }}>{morph < .5 ? 'SEATS · THEATRE, GREECE' : 'SEATS · COLOSSEUM, ROME'}</div>
        <div style={{ fontFamily: '"JetBrains Mono"', fontSize: 64, color: P.acc2, marginTop: 6 }}>
          {f < 380 ? <Counter from={10} to={14000} at={214} dur={90} /> : <Counter from={14000} to={50000} at={386} dur={60} log={false} />}
        </div>
      </div>
      <Tag id="game" text="Senet · the Royal Game of Ur" x={120} y={260} at={104} out={214} pal={P} />
      <Tag id="story" text="tragedy, comedy, epic" x={120} y={260} at={246} pal={P} />
      <Tag id="together" text="festivals & the Olympic Games" x={120} y={340} at={266} pal={P} />
      <Tag id="thrill" text="gladiators & chariot races" x={120} y={420} at={420} pal={P} />
      <Cap text="Rules became objects: the first board games." at={104} out={206} color={P.ink} em={['board', 'games']} emColor={P.acc2} />
      <Cap text="Greek theatres seated up to 14,000." at={226} out={364} color={P.ink} />
      <Cap text="Rome's Colosseum held about 50,000." at={384} out={466} color={P.ink} />
      <Cap text="For the first time, the crowd split from the show." at={478} out={570} color={P.ink} em={['crowd', 'show']} emColor={P.acc} />
    </AbsoluteFill>
  );
};
