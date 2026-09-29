// 02 The Fire — 40,000+ years ago. One fire, one circle, everyone a participant.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import { PAL, prog, ease, lerp, env } from '../lib/theme';
import { ChapterHead, Cap, Tag, Draw, Person } from '../lib/kit';
import { Flame } from '../lib/fire';

const P = PAL.fire;
// a cave-painting bison, drawn in a handful of strokes (400×260 box)
export const BISON = [
  'M40 120 C60 98 120 86 176 82 C214 44 282 44 312 92 C322 104 330 112 332 124 C338 140 330 160 318 170 C300 178 280 176 262 172',
  'M262 172 C220 182 150 184 104 176', 'M40 120 C32 140 40 160 58 170 L62 228', 'M104 176 L112 230', 'M262 172 L252 228', 'M300 176 L296 226',
  'M330 124 C350 118 372 126 380 142 C384 152 376 160 364 158 C352 156 340 150 330 148',
  'M348 120 C352 100 366 92 378 94', 'M338 118 C336 98 322 88 312 92', 'M40 120 C28 124 20 134 18 146',
  'M236 100 C250 120 256 140 258 160',
];

const RING = Array.from({ length: 20 }, (_, i) => {
  const a = (i / 20) * Math.PI * 2 + .16;
  return { i, a, x: 960 + Math.cos(a) * 430, y: 690 + Math.sin(a) * 100, front: Math.sin(a) > 0 };
});

export const Fire: React.FC = () => {
  const f = useCurrentFrame();
  const push = lerp(1, 1.06, prog(f, 0, 504, ease.inOut));
  const fireS = prog(f, 12, 46);
  const person = (r: typeof RING[number]) => {
    const p = prog(f, 78 + r.i * 3, 18);
    const depth = (Math.sin(r.a) + 1) / 2;                       // 0 = far side, 1 = near side
    const col = r.front ? '#120804' : `rgb(${lerp(120, 90, depth)}, ${lerp(62, 44, depth)}, ${lerp(30, 20, depth)})`;
    return <g key={r.i} opacity={p} transform={`translate(0 ${(1 - p) * 16})`}><Person x={r.x} y={r.y} s={lerp(.95, 1.35, depth)} color={col} pose="sit" rim={r.front ? P.acc : undefined} /></g>;
  };
  const smoke = Array.from({ length: 5 }, (_, i) => {
    const w = Math.sin(f / 22 + i) * 30;
    return `M ${950 + i * 6} 560 C ${920 + w} 490, ${1000 - w} 440, ${960 + w * .6} ${400 - i * 10}`;
  });
  return (
    <AbsoluteFill>
      <ChapterHead n={2} kicker="40,000+ years ago" title="The Fire" pal={P} dur={504} />
      <svg width={1920} height={1080} style={{ position: 'absolute', transform: `scale(${push})`, transformOrigin: '50% 70%' }}>
        {/* a painted hand on the cave wall, top right */}
        <g opacity={env(f, 150, 520, 30) * .85} transform="translate(1560 240) rotate(-14) scale(1.25)">
          <filter id="spray"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={1} seed={4} /><feDisplacementMap in="SourceGraphic" scale={9} /></filter>
          <g fill={P.acc} filter="url(#spray)" opacity={.6}>
            <ellipse cx={0} cy={24} rx={40} ry={46} />
            {[-38, -17, 4, 25].map((x, k) => <rect key={k} x={x - 8.5} y={-80 + Math.abs(k - 1.5) * 9} width={17} height={84} rx={8.5} />)}
            <rect x={32} y={-2} width={17} height={60} rx={8.5} transform="rotate(-40 40 26)" />
          </g>
        </g>
        {/* smoke rises and becomes a story */}
        <Draw d={smoke} at={100} dur={60} color={P.dim} width={1.5} opacity={.35} stagger={6} />
        <g transform="translate(700 150) scale(1.25)">
          <Draw d={BISON} at={132} dur={56} stagger={5} color={P.acc2} width={3.2} opacity={.9 * (.75 + .25 * Math.sin(f / 14))} />
        </g>
        {RING.filter((r) => !r.front).map(person)}
        <g opacity={fireS}><Flame x={960} y={696} s={lerp(.2, 1, fireS)} outer={P.acc} mid={P.acc2} seed="fire" logs /></g>
        {RING.filter((r) => r.front).map(person)}
      </svg>
      <Tag id="story" text="tales told by firelight" x={120} y={330} at={196} pal={P} />
      <Tag id="rhythm" text="flutes of bone, drums, voices" x={120} y={420} at={214} pal={P} />
      <Tag id="game" text="knucklebones & chance" x={120} y={510} at={232} pal={P} />
      <Tag id="making" text="paintings on stone" x={1800} y={420} at={250} pal={P} align="right" />
      <Tag id="thrill" text="dance, ritual, trance" x={1800} y={510} at={268} pal={P} align="right" />
      <Tag id="together" text="the circle itself" x={1800} y={600} at={286} pal={P} align="right" />
      <Cap text="Stories by firelight. Flutes of bone. Paint on stone." at={176} out={330} color={P.ink} />
      <Cap text="There was no audience. Everyone took part." at={342} out={496} color={P.ink} em={['Everyone', 'took', 'part']} emColor={P.acc2} />
    </AbsoluteFill>
  );
};
