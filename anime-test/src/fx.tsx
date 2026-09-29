// The anime finishing layer: impact frames, speed lines, black lightning, flashes, technique cards,
// subtitles, titles, grain. Effects animate on twos (a new drawing every 2 frames) like hand-drawn fx.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, random, Easing } from 'remotion';

const twos = (f: number) => Math.floor(f / 2);
const MINCHO = '"Shippori Mincho B1"', SANS = '"Noto Sans JP"', LATIN = 'Oswald';

// 1 negative · 2 red two-tone · 3 white void · 4 black void
export const impactFilter = (k: number) =>
  k === 1 ? 'invert(1) grayscale(1) contrast(3)' :
  k === 2 ? 'grayscale(1) contrast(5) brightness(1.3)' :
  k === 3 ? 'grayscale(1) contrast(9) brightness(1.7)' :
  k === 4 ? 'grayscale(1) contrast(9) brightness(.35)' : undefined;

export const SpeedLines: React.FC<{ seed: string; strength?: number; dark?: boolean }> = ({ seed, strength = 1, dark }) => {
  const f = twos(useCurrentFrame());
  const cx = 960, cy = 540, n = 110;
  const wedges = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (random(`${seed}a${i}${f}`) - .5) * .05;
    const r0 = 380 + random(`${seed}r${i}${f}`) * 380, w = .004 + random(`${seed}w${i}${f}`) * .012;
    const R = 1500;
    const p = (ang: number, r: number) => `${cx + Math.cos(ang) * r},${cy + Math.sin(ang) * r * .75}`;
    return <polygon key={i} points={`${p(a, r0)} ${p(a - w, R)} ${p(a + w, R)}`} />;
  });
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', opacity: .85 * strength }}>
      <g fill={dark ? '#000' : '#f4f1ea'}>{wedges}</g>
    </svg>
  );
};

export const BlackLightning: React.FC<{ seed: string }> = ({ seed }) => {
  const f = twos(useCurrentFrame());
  const bolts: React.ReactNode[] = [];
  const walk = (x: number, y: number, ang: number, len: number, depth: number, key: string) => {
    let pts = `${x},${y}`;
    for (let i = 0; i < 9; i++) {
      ang += (random(`${key}${i}${f}`) - .5) * 1.1;
      const step = len / 9; x += Math.cos(ang) * step; y += Math.sin(ang) * step; pts += ` ${x},${y}`;
      if (depth < 2 && random(`${key}b${i}${f}`) > .78) walk(x, y, ang + (random(`${key}c${i}`) - .5) * 1.6, len * .45, depth + 1, key + i);
    }
    const w = depth === 0 ? 20 : depth === 1 ? 10 : 5;
    bolts.push(<g key={key}>
      <polyline points={pts} fill="none" stroke="#e01020" strokeWidth={w * 2.2} strokeLinejoin="miter" opacity={.9} />
      <polyline points={pts} fill="none" stroke="#000" strokeWidth={w} strokeLinejoin="miter" />
    </g>);
  };
  for (let k = 0; k < 8; k++) walk(960, 520, (k / 8) * Math.PI * 2 + random(`${seed}k${k}${f}`), 900, 0, `${seed}${k}`);
  return <svg width={1920} height={1080} style={{ position: 'absolute', filter: 'drop-shadow(0 0 18px #ff2030)' }}>{bolts}</svg>;
};

export const Flash: React.FC<{ at: number; color?: string }> = ({ at, color = '#fff' }) => {
  const k = useCurrentFrame() - at;
  if (k < 0 || k > 5) return null;
  return <AbsoluteFill style={{ background: color, opacity: (1 - k / 6) ** 2 * .9, mixBlendMode: 'screen' }} />;
};

export const Charge: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const g = interpolate(f, [0, dur], [.2, 1]);
  const pulse = .7 + .3 * Math.sin(twos(f) * 1.3);
  return <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 55%, rgba(58,92,255,${.45 * g * pulse}) 0%, rgba(10,14,40,0) 45%)`, mixBlendMode: 'screen' }} />;
};

export const TechniqueCard: React.FC<{ spec: string; dur: number; delay?: number }> = ({ spec, dur, delay = 0 }) => {
  const [, kanji, en, side] = spec.split(':');
  const f = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  if (f < 0) return null;
  const inn = spring({ frame: f, fps, config: { damping: 14, stiffness: 180 } });
  const out = interpolate(f, [dur - delay - 6, dur - delay], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (side === 'center') {
    return (
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: out }}>
        <div style={{ fontFamily: MINCHO, fontWeight: 800, fontSize: 300 * (1.25 - .25 * inn), color: '#f2efe6', WebkitTextStroke: '10px #000', paintOrder: 'stroke' }}>{kanji}</div>
        <div style={{ fontFamily: LATIN, fontWeight: 600, fontSize: 40, letterSpacing: 22, color: '#e01020', marginTop: -10 }}>{en}</div>
      </AbsoluteFill>
    );
  }
  const x = side === 'right' ? interpolate(inn, [0, 1], [500, 0]) : interpolate(inn, [0, 1], [-500, 0]);
  const pos: React.CSSProperties = side === 'right' ? { right: 150 } : { left: 150 };
  return (
    <div style={{ position: 'absolute', top: 110, ...pos, transform: `translateX(${x}px)`, opacity: out, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: '#f2efe6', letterSpacing: 8, marginBottom: 10 }}>術式</div>
      <div style={{ background: '#a8101c', padding: '26px 20px', boxShadow: '0 0 60px rgba(0,0,0,.6)' }}>
        {[...kanji].map((c, i) => <div key={i} style={{ fontFamily: MINCHO, fontWeight: 800, fontSize: 170, lineHeight: 1.05, color: '#f2efe6' }}>{c}</div>)}
      </div>
      <div style={{ fontFamily: LATIN, fontWeight: 600, fontSize: 26, letterSpacing: 10, color: '#f2efe6', marginTop: 18 }}>{en}</div>
    </div>
  );
};

export const Subtitle: React.FC<{ jp: string; en: string; dur: number }> = ({ jp, en, dur }) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [3, 7, dur - 5, dur - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sh = '0 0 6px #000, 0 2px 4px #000, 0 0 2px #000';
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, textAlign: 'center', opacity: a }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: '#f2efe6', textShadow: sh }}>{jp}</div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: '#fff', textShadow: sh, marginTop: 6 }}>{en}</div>
    </div>
  );
};

export const Location: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [8, 20, dur - 14, dur - 4], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', right: 140, top: 110, opacity: a, display: 'flex', gap: 26, alignItems: 'flex-start' }}>
      <div style={{ fontFamily: LATIN, fontWeight: 600, fontSize: 22, letterSpacing: 8, color: '#dcd8ce', writingMode: 'vertical-rl', marginTop: 14 }}>SHINJUKU, TOKYO — 23:47</div>
      <div style={{ fontFamily: MINCHO, fontWeight: 800, fontSize: 64, color: '#f2efe6', writingMode: 'vertical-rl', letterSpacing: 10 }}>東京都新宿区</div>
    </div>
  );
};

export const Title: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const s = 1 + .25 * Math.pow(1 - Easing.out(Easing.exp)(Math.min(1, f / 8)), 2);
  const a = interpolate(f, [dur - 10, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#050404', alignItems: 'center', justifyContent: 'center', opacity: a }}>
      <div style={{ position: 'absolute', width: 1200, height: 300, background: '#a3101c', transform: `rotate(-3deg) scale(${s})` }} />
      <div style={{ fontFamily: MINCHO, fontWeight: 800, fontSize: 250 * s, color: '#f2efe6', letterSpacing: 40, position: 'relative' }}>墨ノ刻</div>
      <div style={{ position: 'absolute', top: 700, fontFamily: LATIN, fontWeight: 600, fontSize: 30, letterSpacing: 18, color: '#f2efe6' }}>HOUR OF INK</div>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)', pointerEvents: 'none' }} />;

export const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ mixBlendMode: 'overlay', opacity: .16, pointerEvents: 'none' }}>
      <svg width={1920} height={1080}>
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={f % 12} /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};
