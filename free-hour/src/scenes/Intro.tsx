// 00 Cold open and 01 First principles: the six constants of fun.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { F, PAL, prog, ease, env, lerp } from '../lib/theme';
import { Line, Glyph, CONSTANTS } from '../lib/kit';
import { Flame, Ember } from '../lib/fire';

const P = PAL.open;

export const Open: React.FC = () => {
  const f = useCurrentFrame();
  const bloom = prog(f, 286, 40, ease.out);
  const emberA = prog(f, 6, 30);
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <g opacity={emberA * (1 - bloom)}><Ember x={960} y={400} color={P.acc} r={7} /></g>
        {bloom > 0 && <g opacity={bloom}><Flame x={960} y={450} s={lerp(.05, .62, bloom)} outer={P.acc} mid={P.acc2} seed="open" glow={.8} /></g>}
      </svg>
      <Line text="Every person who ever lived" at={40} out={212} y={560} size={70} color={P.ink} />
      <Line text="spent most of their days on the work of staying alive." at={92} out={212} y={650} size={46} color={P.dim} italic />
      <Line text="And when the work was done —" at={222} out={288} y={600} size={70} color={P.ink} em={['done']} emColor={P.acc} />
      <Title f={f} start={300} />
    </AbsoluteFill>
  );
};

const Title: React.FC<{ f: number; start: number; exit?: number }> = ({ f, start, exit = 1e9 }) => {
  const p = prog(f, start, 30), x = prog(f, exit, 24, ease.in);
  if (p <= 0 || x >= 1) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', opacity: 1 - x, transform: `translateY(${-x * 60}px) scale(${1 - x * .1})` }}>
      <div style={{ overflow: 'hidden', paddingBottom: 20 }}>
        <div style={{ fontFamily: F.serif, fontSize: 176, color: P.ink, lineHeight: 1, transform: `translateY(${(1 - p) * 100}%)`, letterSpacing: -2 }}>
          The <span style={{ fontStyle: 'italic', color: P.acc2 }}>Free</span> Hour
        </div>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: 8, color: P.dim, marginTop: 18, opacity: prog(f, start + 14, 24) }}>
        A SHORT HISTORY OF FUN · 40,000 YEARS IN THREE MINUTES
      </div>
    </div>
  );
};

const CX = 960, CY = 500, R = 292;
const NODE = CONSTANTS.map((c, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 3; return { ...c, x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R, k }; });

export const Axioms: React.FC = () => {
  const f = useCurrentFrame();
  const P2 = PAL.axioms;
  const shrink = prog(f, 0, 40, ease.inOut);
  const gather = prog(f, 528, 44, ease.inOut);          // the six collapse into the ember that becomes the fire
  const hexA = 1 - prog(f, 548, 22, ease.in);
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        {/* the flame from the title sinks back to an ember, which sits at the centre of the six */}
        {shrink < 1 && <g opacity={1 - shrink}><Flame x={960} y={450} s={lerp(.62, .05, shrink)} outer={P2.acc} mid={P2.acc2} seed="ax" glow={.8} /></g>}
        <g opacity={shrink}><Ember x={CX} y={lerp(lerp(400, 300, prog(f, 10, 40, ease.inOut)), CY, prog(f, 238, 40, ease.inOut))} color={P2.acc} r={lerp(7, 9, gather)} pulse={1 + gather} /></g>
        {/* hexagon edges */}
        <g opacity={hexA}>
          {NODE.map((n, k) => {
            const m = NODE[(k + 1) % 6]; const p = prog(f, 262 + k * 34, 30, ease.inOut);
            const g = gather; const ax = lerp(n.x, CX, g), ay = lerp(n.y, CY, g), bx = lerp(m.x, CX, g), by = lerp(m.y, CY, g);
            return <line key={k} x1={ax} y1={ay} x2={lerp(ax, bx, p)} y2={lerp(ay, by, p)} stroke={P2.dim} strokeWidth={1.5} strokeDasharray="4 7" opacity={.8} />;
          })}
          {NODE.map((n, k) => { const p = prog(f, 250 + k * 34, 24) * (1 - prog(f, 436, 14)); return <line key={'s' + k} x1={CX} y1={CY} x2={lerp(CX, lerp(n.x, CX, gather), p)} y2={lerp(CY, lerp(n.y, CY, gather), p)} stroke={P2.acc} strokeWidth={1} opacity={.25} />; })}
        </g>
      </svg>
      <Line text="Strip away the technology." at={30} out={146} y={470} size={86} color={P2.ink} />
      <Line text="What is fun, really?" at={62} out={146} y={580} size={86} color={P2.acc} italic />
      <Line text="Play is anything we do" at={156} out={242} y={470} size={80} color={P2.ink} />
      <Line text="for no reason but itself." at={176} out={242} y={570} size={80} color={P2.ink} em={['itself']} emColor={P2.acc} />
      {/* the six */}
      {NODE.map((n) => {
        const at = 250 + n.k * 34;
        const x = lerp(n.x, CX, gather), y = lerp(n.y, CY, gather);
        const below = n.y > CY + 10, above = n.y < CY - 200;
        const lx = n.k === 1 || n.k === 2 ? x + 80 : n.k === 4 || n.k === 5 ? x - 80 : x;
        const align = n.k === 1 || n.k === 2 ? 'left' : n.k === 4 || n.k === 5 ? 'right' : 'center';
        const ly = above ? y - 162 : below && (n.k === 3) ? y + 76 : y - 26;
        const a = env(f, at, 540, 16, 20);
        return (
          <React.Fragment key={n.id}>
            <Glyph id={n.id} x={x} y={y} size={lerp(92, 20, gather)} at={at} out={548} color={P2.ink} width={3} />
            <div style={{ position: 'absolute', left: align === 'left' ? lx : align === 'right' ? lx - 380 : lx - 190, top: ly, width: 380, textAlign: align as 'left', opacity: a,
              transform: `translateY(${(1 - prog(f, at + 6, 20)) * 14}px)` }}>
              <div style={{ fontFamily: F.serif, fontSize: 46, color: P2.ink, lineHeight: 1 }}>{n.name}</div>
              <div style={{ fontFamily: F.sans, fontSize: 22, color: P2.dim, marginTop: 6 }}>{n.why}</div>
            </div>
          </React.Fragment>
        );
      })}
      <Line text="These six never change." at={446} out={520} y={CY + 60} size={42} color={P2.ink} width={560} />
      <Line text="Only the carrier does." at={474} out={520} y={CY + 118} size={42} color={P2.acc} italic width={560} />
      <Line text="Who gets to play. How much time they have. How many share it." at={528} out={572} y={950} size={30} font={F.sans} color={P2.dim} stagger={1} />
    </AbsoluteFill>
  );
};
// the title lingers into the first chapter for continuity
export const TitleExit: React.FC = () => { const f = useCurrentFrame(); return <Title f={f + 330} start={300} exit={330} />; };
void interpolate;
