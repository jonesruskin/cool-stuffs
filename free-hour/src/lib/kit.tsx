// Shared motion components: kinetic type, draw-on line art, glyphs of the six constants, counters,
// chapter headers, human figures, background and grain.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, random, staticFile, Img } from 'remotion';
import { F, ease, prog, env, Pal, palAt, lerp } from './theme';

// ---------------------------------------------------------------- kinetic type
// Words rise out of a mask one after another, then the line lifts away.
export const Line: React.FC<{
  text: string; at: number; out?: number; size?: number; font?: string; color?: string; italic?: boolean; weight?: number;
  x?: number; y?: number; align?: 'left' | 'center' | 'right'; stagger?: number; width?: number; ls?: number; em?: string[]; emColor?: string; lh?: number;
}> = ({ text, at, out = 1e9, size = 72, font = F.serif, color = '#fff', italic, weight = 400, x = 960, y = 540, align = 'center', stagger = 3, width = 1600, ls = 0, em = [], emColor, lh = 1.12 }) => {
  const f = useCurrentFrame();
  if (f < at - 1 || f > out + 20) return null;
  const words = text.split(' ');
  const exit = prog(f, out, 11, ease.in);
  const left = align === 'left' ? x : align === 'center' ? x - width / 2 : x - width;
  return (
    <div style={{ position: 'absolute', left, top: y - size * .62, width, textAlign: align, fontFamily: font, fontSize: size, fontWeight: weight,
      color, fontStyle: italic ? 'italic' : 'normal', letterSpacing: ls, lineHeight: lh, opacity: 1 - exit, transform: `translateY(${-exit * size * .35}px)` }}>
      {words.map((w, i) => {
        const p = prog(f, at + i * stagger, 16);
        const isEm = em.includes(w.replace(/[.,—:;?!]/g, ''));
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: size * .26, marginBottom: -size * .26, paddingTop: size * .06, marginTop: -size * .06 }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 110}%)`, opacity: Math.min(1, p * 3),
              color: isEm ? emColor ?? color : undefined, fontStyle: isEm && font === F.serif ? 'italic' : undefined }}>
              {w}{i < words.length - 1 ? ' ' : ''}
            </span>
          </span>
        );
      })}
    </div>
  );
};

// Caption line in the lower third (above the HUD)
export const Cap: React.FC<{ text: string; at: number; out: number; color: string; em?: string[]; emColor?: string; y?: number; size?: number; italic?: boolean }> =
  ({ y = 900, size = 44, ...r }) => <Line {...r} y={y} size={size} width={1640} stagger={2} />;

// Small mono caps label with a leading rule, drawn in.
export const Label: React.FC<{ text: string; at: number; out?: number; x: number; y: number; color: string; size?: number; align?: 'left' | 'center' | 'right'; rule?: boolean }> =
  ({ text, at, out = 1e9, x, y, color, size = 20, align = 'left', rule = true }) => {
    size = Math.max(size, 18);
    const f = useCurrentFrame();
    const a = env(f, at, out, 10, 10), p = prog(f, at, 24);
    const chars = Math.round(text.length * p);
    return (
      <div style={{ position: 'absolute', left: align === 'left' ? x : align === 'center' ? x - 600 : x - 1200, top: y - size * .6, width: align === 'left' ? 1200 : align === 'center' ? 1200 : 1200,
        textAlign: align, fontFamily: F.mono, fontSize: size, letterSpacing: size * .18, color, opacity: a, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end', gap: 14 }}>
        {rule && align !== 'right' && <span style={{ display: 'inline-block', width: 36 * p, height: 1.5, background: color }} />}
        <span>{text.slice(0, chars).toUpperCase()}{p < 1 && <span>▍</span>}</span>
      </div>
    );
  };

// ---------------------------------------------------------------- line art
// Stroked SVG paths that draw themselves on (pathLength normalised to 1).
export const Draw: React.FC<{ d: string | string[]; at: number; dur?: number; out?: number; color: string; width?: number; fill?: string; fillAt?: number; stagger?: number;
  cap?: 'round' | 'butt'; opacity?: number; dash?: string }> =
  ({ d, at, dur = 30, out = 1e9, color, width = 3, fill = 'none', fillAt, stagger = 4, cap = 'round', opacity = 1, dash }) => {
    const f = useCurrentFrame();
    const ds = Array.isArray(d) ? d : [d];
    const o = opacity * (1 - prog(f, out, 12, ease.in));
    if (f < at || o <= 0) return null;
    return (
      <g opacity={o}>
        {ds.map((p, i) => {
          const k = prog(f, at + i * stagger, dur, ease.inOut);
          const fk = fillAt !== undefined ? prog(f, fillAt + i * stagger, 14) : 0;
          return <path key={i} d={p} pathLength={1} stroke={color} strokeWidth={width} fill={fill === 'none' ? 'none' : fill} fillOpacity={fk}
            strokeLinecap={cap} strokeLinejoin="round" strokeDasharray={dash ?? '1 1'} strokeDashoffset={dash ? 0 : 1 - k} />;
        })}
      </g>
    );
  };

// ---------------------------------------------------------------- the six constants
export const CONSTANTS = [
  { id: 'story',    name: 'Story',    why: 'to live other lives' },
  { id: 'game',     name: 'Game',     why: 'to test ourselves against rules' },
  { id: 'rhythm',   name: 'Rhythm',   why: 'to move and make sound' },
  { id: 'together', name: 'Together', why: 'to belong' },
  { id: 'thrill',   name: 'Thrill',   why: 'to feel danger, safely' },
  { id: 'making',   name: 'Making',   why: 'to shape the world by hand' },
] as const;
export type ConstId = typeof CONSTANTS[number]['id'];
// monoline glyphs in a 100×100 box
export const GLYPH: Record<ConstId, string[]> = {
  story: ['M10 30 C24 23 38 23 50 31 C62 23 76 23 90 30 L90 78 C76 71 62 71 50 79 C38 71 24 71 10 78 Z', 'M50 31 L50 79', 'M20 42 L40 40', 'M20 52 L40 50', 'M60 40 L80 42', 'M60 50 L80 52'],
  game: ['M24 18 L76 18 Q82 18 82 24 L82 76 Q82 82 76 82 L24 82 Q18 82 18 76 L18 24 Q18 18 24 18 Z', 'M34 34 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0', 'M50 50 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0', 'M66 66 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0'],
  rhythm: ['M14 50 L14 50', 'M24 38 L24 62', 'M34 24 L34 76', 'M44 40 L44 60', 'M54 16 L54 84', 'M64 32 L64 68', 'M74 44 L74 56', 'M84 30 L84 70'],
  together: ['M38 42 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', 'M62 42 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', 'M50 63 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0'],
  thrill: ['M58 8 L28 54 L48 54 L40 92 L74 40 L54 40 L62 8 Z'],
  making: ['M22 78 L30 58 L68 20 Q74 14 80 20 Q86 26 80 32 L42 70 Z', 'M30 58 L42 70', 'M62 26 L74 38', 'M14 88 L50 88'],
};
export const Glyph: React.FC<{ id: ConstId; x: number; y: number; size?: number; at: number; out?: number; color: string; width?: number; dur?: number; glow?: string }> =
  ({ id, x, y, size = 80, at, out, color, width = 3, dur = 26, glow }) => (
    <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: glow ? `drop-shadow(0 0 10px ${glow})` : undefined }}>
      <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})`}>
        <Draw d={GLYPH[id]} at={at} out={out} dur={dur} stagger={3} color={color} width={width * 100 / size} />
      </g>
    </svg>
  );

// A glyph + label tag used to attribute an artefact to one of the constants.
export const Tag: React.FC<{ id: ConstId; text: string; x: number; y: number; at: number; out?: number; pal: Pal; align?: 'left' | 'right' }> =
  ({ id, text, x, y, at, out = 1e9, pal, align = 'left' }) => {
    const f = useCurrentFrame();
    const a = env(f, at, out, 10, 10);
    if (a <= 0) return null;
    const name = CONSTANTS.find((c) => c.id === id)!.name;
    return (
      <div style={{ position: 'absolute', left: align === 'left' ? x : x - 520, top: y - 22, width: 520, display: 'flex', flexDirection: align === 'left' ? 'row' : 'row-reverse',
        alignItems: 'center', gap: 14, opacity: a, transform: `translateY(${(1 - prog(f, at, 18)) * 10}px)` }}>
        <svg width={44} height={44} viewBox="0 0 100 100" style={{ overflow: 'visible', flex: 'none' }}>
          {GLYPH[id].map((d, i) => <path key={i} d={d} stroke={pal.acc} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1}
            strokeDasharray="1 1" strokeDashoffset={1 - prog(f, at + i * 2, 20, ease.inOut)} />)}
        </svg>
        <div style={{ textAlign: align }}>
          <div style={{ fontFamily: F.mono, fontSize: 16, letterSpacing: 3, color: pal.acc }}>{name.toUpperCase()}</div>
          <div style={{ fontFamily: F.sans, fontSize: 25, color: pal.ink, marginTop: 2 }}>{text}</div>
        </div>
      </div>
    );
  };

// ---------------------------------------------------------------- numbers
export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const Counter: React.FC<{ from: number; to: number; at: number; dur?: number; log?: boolean; style?: React.CSSProperties; suffix?: string }> =
  ({ from, to, at, dur = 40, log = true, style, suffix = '' }) => {
    const f = useCurrentFrame(); const p = prog(f, at, dur, ease.inOut);
    const v = log && from > 0 && to > 0 ? Math.exp(lerp(Math.log(from), Math.log(to), p)) : lerp(from, to, p);
    return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{fmt(v)}{suffix}</span>;
  };

// ---------------------------------------------------------------- chapter header
// A chapter opens with a large title, then settles into a small label at top-left.
export const ChapterHead: React.FC<{ n: number; kicker: string; title: string; pal: Pal; dur: number }> = ({ n, kicker, title, pal, dur }) => {
  const f = useCurrentFrame();
  const settle = prog(f, 46, 24, ease.inOut);
  const out = prog(f, dur - 14, 14, ease.in);
  const inP = prog(f, 0, 26);
  const size = lerp(170, 54, settle);
  const x = lerp(160, 120, settle), y = lerp(430, 92, settle);
  const big = kicker.replace(/ years ago|\+/g, '').replace(' – today', '').replace(' →', '');
  return (
    <>
    <div style={{ position: 'absolute', right: 110, top: 250, fontFamily: F.serif, fontSize: 330, lineHeight: 1, color: 'transparent', WebkitTextStroke: `1.5px ${pal.dim}`,
      opacity: .35 * inP * (1 - settle), transform: `translateX(${(1 - inP) * 60 + settle * 80}px)`, whiteSpace: 'nowrap' }}>{big}</div>
    <div style={{ position: 'absolute', left: x, top: y, opacity: 1 - out }}>
      <div style={{ fontFamily: F.mono, fontSize: lerp(22, 16, settle), letterSpacing: 5, color: pal.acc, opacity: inP, display: 'flex', gap: 18, alignItems: 'center', marginBottom: lerp(18, 10, settle) }}>
        <span>{String(n).padStart(2, '0')}</span><span style={{ width: 40 * inP, height: 1.5, background: pal.acc, display: 'inline-block' }} /><span>{kicker.toUpperCase()}</span>
      </div>
      <div style={{ overflow: 'hidden', paddingBottom: size * .14 }}>
        <div style={{ fontFamily: F.serif, fontSize: size, lineHeight: 1.05, color: pal.ink, transform: `translateY(${(1 - inP) * 105}%)`, whiteSpace: 'nowrap' }}>{title}</div>
      </div>
    </div>
    </>
  );
};

// ---------------------------------------------------------------- people
// A minimal person: head + shoulders, drawn as one silhouette. pose: sit | stand | lean
export const Person: React.FC<{ x: number; y: number; s?: number; color: string; pose?: 'sit' | 'stand' | 'lean' | 'couch'; opacity?: number; facing?: number; rim?: string }> =
  ({ x, y, s = 1, color, pose = 'sit', opacity = 1, facing = 1, rim }) => {
    const body = pose === 'stand' ? 'M-14 0 C-14 -30 14 -30 14 0 L12 46 L-12 46 Z'
      : pose === 'lean' ? 'M-13 0 C-16 -26 12 -34 16 -6 L12 26 L-14 26 Z'
      : pose === 'couch' ? 'M-15 0 C-15 -26 15 -26 15 0 L15 22 L-15 22 Z'
      : 'M-15 0 C-15 -28 15 -28 15 0 L15 24 L-15 24 Z';
    const headY = pose === 'lean' ? -34 : -33;
    return (
      <g transform={`translate(${x} ${y}) scale(${s * facing} ${s})`} opacity={opacity}>
        {rim && <g transform="translate(0 -1.6) scale(1.07)" opacity={.55}><circle cx={pose === 'lean' ? 6 : 0} cy={headY} r={11} fill={rim} /><path d={body} fill={rim} /></g>}
        <circle cx={pose === 'lean' ? 6 : 0} cy={headY} r={11} fill={color} />
        <path d={body} fill={color} />
      </g>
    );
  };

// ---------------------------------------------------------------- background
export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const p = palAt(f);
  const drift = Math.sin(f / 240) * 6;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${50 + drift}% 42%, ${p.bg2} 0%, ${p.bg} 62%)` }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)' }} />
    </AbsoluteFill>
  );
};
// Film grain from a pre-rendered noise tile, offset every frame (cheap, no per-frame filters).
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = .07 }) => {
  const f = useCurrentFrame();
  const ox = Math.floor(random(`gx${f}`) * 256), oy = Math.floor(random(`gy${f}`) * 256);
  return <AbsoluteFill style={{ backgroundImage: `url(${staticFile('grain.png')})`, backgroundPosition: `${ox}px ${oy}px`, opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }} />;
};
export { Img };
