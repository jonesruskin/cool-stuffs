// 09 Close — the whole thesis in one table, then back to a single ember.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { PAL, prog, ease, lerp, F, ChapterId } from '../lib/theme';
import { CONSTANTS, GLYPH, Line } from '../lib/kit';
import { Ember } from '../lib/fire';

const P = PAL.close;
const COLS: [string, ChapterId][] = [['Fire', 'fire'], ['City', 'city'], ['Page', 'page'], ['Clock', 'clock'], ['Signal', 'signal'], ['Screen', 'screen'], ['AI', 'ai']];
const CELLS: Record<string, string[]> = {
  story:    ['Tales by firelight', 'Theatre & epic', 'Books & broadsides', 'Penny dreadfuls', 'Cinema & radio', 'Streaming', 'Stories that answer you'],
  game:     ['Knucklebones', 'Senet & dice', 'Chess & cards', 'Football leagues', 'Monopoly & Scrabble', 'Video games', 'Worlds that adapt'],
  rhythm:   ['Bone flutes', 'Lyre & chorus', 'Troubadours', 'Music halls', 'Records & radio', 'Walkman → streams', 'Songs on demand'],
  together: ['The circle', 'Festivals & Games', 'Fairs & feast days', 'The pub & the park', 'TV night', 'Online communities', 'AI companions'],
  thrill:   ['Dance & ritual', 'Gladiators', 'Jousts', 'Roller coasters', 'Horror films', 'Esports & VR', 'Endless novelty'],
  making:   ['Cave paintings', 'Mosaics & pottery', 'Illuminated books', 'Hobby clubs', 'Home movies', 'Mods & uploads', 'Making with AI'],
};
const X0 = 390, CW = 204, Y0 = 300, RH = 100;

export const Close: React.FC = () => {
  const f = useCurrentFrame();
  const tableA = prog(f, 4, 20) * (1 - prog(f, 290, 26, ease.in));
  const collapse = prog(f, 410, 50, ease.inOut);
  const endA = prog(f, 488, 30);
  const fade = prog(f, 552, 24, ease.in);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, opacity: tableA, transform: `scale(${lerp(1, .96, prog(f, 290, 26, ease.in))})` }}>
        <div style={{ position: 'absolute', left: 120, top: 92 }}>
          <div style={{ fontFamily: F.mono, fontSize: 15, letterSpacing: 5, color: P.acc, marginBottom: 10 }}>09 — 40,000 YEARS, ONE TABLE</div>
          <div style={{ fontFamily: F.serif, fontSize: 64, color: P.ink, marginTop: 6 }}>Six needs. <span style={{ fontStyle: 'italic', color: P.acc2 }}>Seven carriers.</span></div>
        </div>
        {COLS.map(([name, id], c) => {
          const a = prog(f, 18 + c * 16, 16);
          return (
            <div key={name} style={{ position: 'absolute', left: X0 + c * CW, top: Y0 - 74, width: CW - 16, opacity: a }}>
              <div style={{ height: 3, background: PAL[id].acc, width: `${a * 100}%` }} />
              <div style={{ fontFamily: F.serif, fontSize: 38, color: P.ink, marginTop: 8 }}>{name}</div>
            </div>
          );
        })}
        {CONSTANTS.map((k, r) => {
          const ra = prog(f, 12 + r * 5, 16);
          const sweep = prog(f, 196 + r * 8, 30, ease.inOut);
          return (
            <React.Fragment key={k.id}>
              <div style={{ position: 'absolute', left: 120, top: Y0 + r * RH + 6, display: 'flex', alignItems: 'center', gap: 16, opacity: ra }}>
                <svg width={42} height={42} viewBox="0 0 100 100">{GLYPH[k.id].map((d, i) => <path key={i} d={d} stroke={P.acc} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}</svg>
                <div style={{ fontFamily: F.serif, fontSize: 42, color: P.ink }}>{k.name}</div>
              </div>
              <div style={{ position: 'absolute', left: 120, top: Y0 + r * RH + RH - 8, width: 1680 * ra, height: 1, background: P.dim, opacity: .25 }} />
              {/* the constancy sweep: each need runs unbroken across every era */}
              <div style={{ position: 'absolute', left: X0 - 10, top: Y0 + r * RH + 32, width: (CW * 7) * sweep, height: 2, background: P.acc, opacity: .35 * (1 - prog(f, 262, 24)) }} />
              {CELLS[k.id].map((t, c) => {
                const a = prog(f, 34 + c * 16 + r * 3, 14);
                const last = c === 6;
                return (
                  <div key={c} style={{ position: 'absolute', left: X0 + c * CW, top: Y0 + r * RH + 12, width: CW - 20, opacity: a, transform: `translateY(${(1 - a) * 8}px)`,
                    fontFamily: F.sans, fontSize: 23, lineHeight: 1.2, color: last ? PAL.ai.acc : P.ink }}>{t}</div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      <Line text="The carriers change." at={316} out={404} y={470} size={110} color={P.ink} />
      <Line text="The need never does." at={344} out={404} y={600} size={110} color={P.acc2} italic />
      <svg width={1920} height={1080} style={{ position: 'absolute', opacity: 1 - fade }}>
        <g opacity={prog(f, 404, 20)}><Ember x={960} y={lerp(540, 360, collapse)} color={P.acc} r={lerp(12, 8, collapse)} pulse={1.4} /></g>
      </svg>
      <Line text="What will you do with your free hour?" at={430} out={548} y={500} size={76} color={P.ink} em={['free', 'hour?']} emColor={P.acc2} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 650, textAlign: 'center', opacity: endA * (1 - fade) }}>
        <div style={{ width: 60, height: 1, background: P.dim, margin: '0 auto 26px', opacity: .6 }} />
        <div style={{ fontFamily: F.serif, fontSize: 48, color: P.ink }}>The <i style={{ color: P.acc2 }}>Free</i> Hour</div>
        <div style={{ fontFamily: F.mono, fontSize: 17, letterSpacing: 5, color: P.dim, marginTop: 12 }}>WRITTEN, DESIGNED, ANIMATED & SCORED IN CODE</div>
      </div>
      <AbsoluteFill style={{ background: '#000', opacity: fade }} />
    </AbsoluteFill>
  );
};
