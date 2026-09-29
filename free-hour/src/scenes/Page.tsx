// 04 The Page — 1440. Games travel; then the press turns stories into objects you enjoy alone.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import { PAL, prog, ease, lerp, env } from '../lib/theme';
import { ChapterHead, Cap, Tag, Draw, Person, Label } from '../lib/kit';

const P = PAL.page;
const KNIGHT = [
  'M30 262 L190 262', 'M44 262 L56 226 L164 226 L176 262',
  'M72 226 C62 180 82 148 98 126 C72 126 46 116 40 94 C36 78 50 62 72 52 L98 18 L110 46 C146 42 176 74 178 124 C180 164 166 196 156 226',
  'M126 52 C148 72 158 96 160 126', 'M84 70 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0',
];
const SUITS = ['♠', '♥', '♣', '♦', '♠'];

export const Page: React.FC = () => {
  const f = useCurrentFrame();
  const aOut = prog(f, 178, 20, ease.in);
  // press: the type block drops at 214, lifts by 240
  const drop = prog(f, 182, 32, ease.in), lift = prog(f, 222, 22, ease.inOut);
  const blockY = lerp(-560, 300, drop) - lift * 860;
  const hit = f >= 214;
  const pageShake = hit ? Math.sin((f - 214) * 2.2) * Math.exp(-(f - 214) / 5) * 8 : 0;
  const tile = prog(f, 262, 30, ease.inOut);           // the page shrinks into one of many copies
  const reader = prog(f, 336, 36, ease.inOut);
  const pageA = prog(f, 186, 12) * (1 - prog(f, 318, 18, ease.in));
  const cols = 11, rows = 5;
  return (
    <AbsoluteFill>
      <ChapterHead n={4} kicker="1440" title="The Page" pal={P} dur={432} />
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        {/* chess + cards */}
        <g opacity={1 - aOut}>
          <g transform="translate(470 290) scale(1.35)"><Draw d={KNIGHT} at={64} dur={40} stagger={5} color={P.ink} width={2.4} /></g>
          <g transform="translate(1320 640)">
            {SUITS.map((s, i) => {
              const k = prog(f, 84 + i * 4, 30, ease.out), ang = lerp(0, (i - 2) * 16, k);
              return (
                <g key={i} transform={`rotate(${ang}) translate(-70 -250)`} opacity={prog(f, 80 + i * 3, 10)}>
                  <rect width={140} height={200} rx={12} fill="#efe6d2" stroke={P.bg} strokeWidth={2} />
                  <text x={20} y={40} fontFamily="Instrument Serif" fontSize={30} fill={i % 2 ? P.acc2 : '#1a1614'}>{['A', 'K', 'Q', 'J', '10'][i]}</text>
                  <text x={70} y={124} textAnchor="middle" fontFamily="Instrument Serif" fontSize={70} fill={i % 2 ? P.acc2 : '#1a1614'}>{s}</text>
                </g>
              );
            })}
          </g>
        </g>
        {/* the page, the press, the copies */}
        <g opacity={pageA}>
          {Array.from({ length: cols * rows }, (_, i) => {
            const c = i % cols, r = Math.floor(i / cols);
            const center = c === 5 && r === 2;
            const x = lerp(760, 370 + c * 110, tile), y = lerp(300, 250 + r * 118, tile), w = lerp(400, 80, tile), h = lerp(520, 102, tile);
            const d = Math.hypot(c - 5, r - 2.5);
            const a = center ? 1 : prog(f, 270 + d * 5, 12);
            if (!center && tile <= 0) return null;
            return (
              <g key={i} opacity={a} transform={center ? `translate(${pageShake} 0)` : undefined}>
                <rect x={x} y={y} width={w} height={h} fill="#ece3cf" />
                {hit && Array.from({ length: 14 }, (_, k) => (
                  <rect key={k} x={x + w * .12 + (k === 0 ? w * .16 : 0)} y={y + h * (.14 + k * .052)} height={Math.max(1, h * .014)}
                    width={w * (k === 13 ? .4 : .76 - (k === 0 ? .16 : 0) - (random(`l${k}`) * .08))} fill="#2a2420" opacity={.75} />
                ))}
                {hit && <text x={x + w * .1} y={y + h * .235} fontFamily="Instrument Serif" fontSize={h * .14} fill={P.acc2}>O</text>}
              </g>
            );
          })}
          {/* the type block */}
          {f < 250 && (
            <g transform={`translate(760 ${blockY})`}>
              <rect width={400} height={520} fill="#3b342c" stroke={P.acc} strokeWidth={2} />
              {Array.from({ length: 14 * 12 }, (_, k) => <rect key={k} x={26 + (k % 12) * 29} y={30 + Math.floor(k / 12) * 34} width={22} height={24} rx={2} fill="#5a5045" />)}
              <rect x={-60} y={-40} width={520} height={40} fill="#2a241f" />
            </g>
          )}
          {hit && f < 228 && <circle cx={960} cy={560} r={(f - 214) * 60} fill="none" stroke={P.acc} strokeWidth={3} opacity={1 - (f - 214) / 14} />}
        </g>
        {/* the reader */}
        <g opacity={reader}>
          <defs><radialGradient id="lamp" cx=".5" cy="0"><stop offset="0" stopColor={P.acc} stopOpacity=".55" /><stop offset="1" stopColor={P.acc} stopOpacity="0" /></radialGradient></defs>
          <path d="M880 150 L1040 150 L1260 820 L660 820 Z" fill="url(#lamp)" />
          <path d="M920 110 L1000 110 L1030 152 L890 152 Z" fill={P.acc} />
          <Person x={960} y={690} s={3.4} color="#0a0908" pose="lean" />
          <rect x={1000} y={640} width={90} height={60} rx={4} fill="#ece3cf" transform="rotate(-18 1045 670)" />
          <rect x={700} y={820} width={520} height={10} fill="#2a241f" />
        </g>
      </svg>
      <Label text="India → Persia → Europe" at={100} out={184} x={612} y={690} color={P.dim} align="center" rule={false} size={15} />
      <Label text="China → Europe, 1370s" at={112} out={184} x={1320} y={690} color={P.dim} align="center" rule={false} size={15} />
      <Tag id="game" text="chess · playing cards" x={120} y={260} at={80} out={186} pal={P} />
      <Tag id="together" text="feast days, fairs, carnival" x={120} y={340} at={98} out={186} pal={P} />
      <Tag id="story" text="books, broadsides, novels" x={120} y={260} at={340} pal={P} />
      <Tag id="making" text="illuminated manuscripts" x={120} y={340} at={358} pal={P} />
      <Cap text="Chess came from India. Playing cards, from China." at={70} out={188} color={P.ink} />
      <Cap text="Then the printing press turned stories into objects —" at={210} out={322} color={P.ink} em={['objects']} emColor={P.acc} />
      <Cap text="to be enjoyed alone, in silence." at={344} out={428} color={P.ink} italic em={['alone,']} emColor={P.acc} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 136, textAlign: 'center', opacity: env(f, 272, 330, 12, 12) }}>
        <div style={{ fontFamily: '"JetBrains Mono"', fontSize: 16, letterSpacing: 4, color: P.dim }}>ONE TEXT</div>
        <div style={{ fontFamily: '"JetBrains Mono"', fontSize: 34, color: P.acc, marginTop: 4 }}>× thousands of copies</div>
      </div>
    </AbsoluteFill>
  );
};
