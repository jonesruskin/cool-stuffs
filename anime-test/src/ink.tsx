// Ink-style drawing primitives: boiling-edge silhouettes, night city, moon, rain, paper, ink splats,
// brush strokes, threads, flame. Everything animates "on twos" (a new drawing every 2 frames).
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, random, interpolate } from 'remotion';

export const C = { paper: '#ece6d8', ink: '#08080a', red: '#c8161d', hot: '#ff2a3a', blue: '#2f5bff', cyan: '#7fb2ff', night: '#070912' };
export const twos = (f: number) => Math.floor(f / 2);
const pad = (n: number) => String(n).padStart(4, '0');

// ---------------------------------------------------------------- characters
// A silhouette plate with a hand-drawn "boil" on its edges and an energy rim.
export const Figure: React.FC<{ id: string; glow?: string; glow2?: string; white?: boolean; boil?: number; frameOffset?: number; style?: React.CSSProperties }> =
  ({ id, glow, glow2, white, boil = 5, frameOffset = 0, style }) => {
    const f = useCurrentFrame() + frameOffset;
    const fid = `boil-${id}`;
    const seed = twos(f) % 9;
    const glowCss = glow ? ` drop-shadow(0 0 2px ${glow}) drop-shadow(0 0 10px ${glow})${glow2 ? ` drop-shadow(0 0 34px ${glow2})` : ''}` : '';
    return (
      <AbsoluteFill style={style}>
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <filter id={fid} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves={2} seed={seed} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={boil} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <Img src={staticFile(`plates/${id}/${pad(Math.max(0, f))}.png`)}
          style={{ width: '100%', height: '100%', filter: `url(#${fid})${white ? ' invert(1)' : ''}${glowCss}` }} />
      </AbsoluteFill>
    );
  };

// ---------------------------------------------------------------- environments
export const Paper: React.FC<{ tone?: string; dark?: boolean }> = ({ tone = C.paper, dark }) => (
  <AbsoluteFill style={{ background: tone }}>
    <svg width={1920} height={1080}>
      <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves={3} seed={3} /><feColorMatrix type="saturate" values="0" />
        <feComponentTransfer><feFuncA type="linear" slope={dark ? .12 : .25} /></feComponentTransfer></filter>
      <rect width="100%" height="100%" filter="url(#paper)" />
      <radialGradient id="pv" cx=".5" cy=".5" r=".75"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#3a2a18" stopOpacity={dark ? 0 : .35} /></radialGradient>
      <rect width="100%" height="100%" fill="url(#pv)" />
    </svg>
  </AbsoluteFill>
);

export const Rain: React.FC<{ n?: number; color?: string; speed?: number; len?: number; slant?: number; opacity?: number; seed?: string }> =
  ({ n = 220, color = '#aebfff', speed = 70, len = 60, slant = -.18, opacity = .35, seed = 'r' }) => {
    const f = useCurrentFrame();
    return (
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        {Array.from({ length: n }, (_, i) => {
          const sp = speed * (.7 + random(`${seed}s${i}`) * .6), L = len * (.6 + random(`${seed}l${i}`) * .8);
          const y = ((random(`${seed}y${i}`) * 1300 + f * sp) % 1300) - 140;
          const x = random(`${seed}x${i}`) * 2100 - 90 - y * slant;
          return <line key={i} x1={x} y1={y} x2={x + L * slant} y2={y + L} stroke={color} strokeWidth={1 + random(`${seed}w${i}`) * 1.4} strokeOpacity={opacity * (.4 + random(`${seed}o${i}`) * .6)} />;
        })}
      </svg>
    );
  };

const SIGNS = ['居酒屋', '薬局', 'カラオケ', '焼肉', '喫茶', '質屋', 'ホテル', '寿司', '雀荘', '新宿', '二十四時間', '占い', 'BAR'];
// Layered night skyline with lit windows and neon kanji signs. `drift` pans the layers (parallax).
export const NightCity: React.FC<{ seed?: string; horizon?: number; drift?: number; zoom?: number; wet?: boolean; neon?: number }> =
  ({ seed = 'c', horizon = 760, drift = 0, zoom = 1, wet = true, neon = 1 }) => {
    const f = useCurrentFrame();
    const layers = [0, 1, 2].map((L) => {
      const n = 14 + L * 6, par = [.25, .55, 1][L];
      const blds = Array.from({ length: n }, (_, i) => {
        const w = 120 + random(`${seed}${L}w${i}`) * (220 - L * 40);
        const x = (i / n) * 2400 - 240 + random(`${seed}${L}x${i}`) * 60 + drift * par;
        const h = [520, 380, 250][L] + random(`${seed}${L}h${i}`) * [300, 260, 180][L];
        const col = ['#141a33', '#0c1022', '#06070d'][L];
        const wins: React.ReactNode[] = [];
        if (L < 2) for (let yy = horizon - h + 24; yy < horizon - 20; yy += 26) for (let xx = x + 12; xx < x + w - 14; xx += 22) {
          const r = random(`${seed}${L}${i}${xx}${yy}`);
          if (r > .72) wins.push(<rect key={`${xx}-${yy}`} x={xx} y={yy} width={10} height={14} fill={r > .95 ? '#ffb86b' : r > .86 ? '#6d86c9' : '#2a3563'} opacity={L ? .9 : .5} />);
        }
        const sign = L === 2 && random(`${seed}sg${i}`) > .45;
        const txt = SIGNS[Math.floor(random(`${seed}st${i}`) * SIGNS.length)];
        const red = random(`${seed}sc${i}`) > .45;
        const flick = random(`${seed}fl${i}${twos(f)}`) > .04 ? 1 : .35;
        return (
          <g key={i}>
            <rect x={x} y={horizon - h} width={w} height={h + 400} fill={col} />
            {wins}
            {sign && (
              <g opacity={neon * flick}>
                <rect x={x + w / 2 - 34} y={horizon - h + 40} width={68} height={txt.length * 64 + 20} fill="#0b0508" stroke={red ? C.hot : C.cyan} strokeWidth={4} />
                {[...txt].map((ch, k) => (
                  <text key={k} x={x + w / 2} y={horizon - h + 100 + k * 64} textAnchor="middle" fontFamily="Noto Sans JP" fontWeight={700} fontSize={50}
                    fill={red ? '#ff6a72' : '#bfe0ff'} style={{ filter: `drop-shadow(0 0 8px ${red ? C.hot : C.cyan})` }}>{ch}</text>
                ))}
              </g>
            )}
          </g>
        );
      });
      return <g key={L}>{blds}</g>;
    });
    return (
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: '50% 60%' }}>
        <AbsoluteFill style={{ background: `linear-gradient(180deg, #05060c 0%, #0d1128 55%, #2a1330 ${horizon / 10.8}%, #05060c 100%)` }} />
        <svg width={1920} height={1080} style={{ position: 'absolute' }}>
          {layers}
          {wet && (
            <g>
              <rect x={0} y={horizon} width={1920} height={1080 - horizon} fill="#04050a" />
              {/* neon streak reflections on the wet road */}
              {Array.from({ length: 26 }, (_, i) => {
                const x = random(`${seed}rf${i}`) * 1920 + drift, red = random(`${seed}rc${i}`) > .5;
                return <rect key={i} x={x} y={horizon + 6} width={6 + random(`${seed}rw${i}`) * 14} height={260 + random(`${seed}rh${i}`) * 200}
                  fill={red ? C.hot : C.cyan} opacity={.10 + .12 * random(`${seed}ro${i}${twos(f)}`)} style={{ filter: 'blur(6px)' }} />;
              })}
            </g>
          )}
        </svg>
      </AbsoluteFill>
    );
  };

export const Moon: React.FC<{ x: number; y: number; r: number; halo?: string }> = ({ x, y, r, halo = C.red }) => (
  <svg width={1920} height={1080} style={{ position: 'absolute' }}>
    <defs>
      <radialGradient id="mh"><stop offset=".55" stopColor={halo} stopOpacity=".35" /><stop offset="1" stopColor={halo} stopOpacity="0" /></radialGradient>
      <filter id="mt"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves={3} seed={7} /><feColorMatrix type="matrix" values="0 0 0 0 .55  0 0 0 0 .5  0 0 0 0 .44  0 0 0 .5 0" /><feComposite in2="SourceGraphic" operator="in" /></filter>
    </defs>
    <circle cx={x} cy={y} r={r * 1.5} fill="url(#mh)" />
    <circle cx={x} cy={y} r={r} fill="#efe8d6" />
    <circle cx={x} cy={y} r={r} fill="#fff" filter="url(#mt)" />
  </svg>
);

// A splash of ink: a core blot plus flung droplets, growing over `dur` frames from `at`.
export const Splat: React.FC<{ x: number; y: number; r: number; at: number; seed: string; color?: string; dur?: number }> =
  ({ x, y, r, at, seed, color = C.red, dur = 6 }) => {
    const k = useCurrentFrame() - at;
    if (k < 0) return null;
    const g = Math.min(1, (k + 1) / dur);
    return (
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <filter id={`sp${seed}`}><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves={2} seed={seed.length * 7} /><feDisplacementMap in="SourceGraphic" scale={r * .35} /></filter>
        <g filter={`url(#sp${seed})`} fill={color}>
          <circle cx={x} cy={y} r={r * .55 * g} />
          {Array.from({ length: 16 }, (_, i) => {
            const a = random(`${seed}a${i}`) * Math.PI * 2, d = r * (.6 + random(`${seed}d${i}`) * 1.4) * g;
            return <circle key={i} cx={x + Math.cos(a) * d} cy={y + Math.sin(a) * d} r={r * (.04 + random(`${seed}r${i}`) * .12)} />;
          })}
        </g>
      </svg>
    );
  };

// One big sumi brush stroke across the frame (for abstract action backgrounds).
export const Brush: React.FC<{ d: string; color?: string; width?: number; seed?: number; draw?: number; opacity?: number }> =
  ({ d, color = C.ink, width = 220, seed = 2, draw = 1, opacity = 1 }) => (
    <svg width={1920} height={1080} style={{ position: 'absolute' }}>
      <filter id={`br${seed}`}><feTurbulence type="fractalNoise" baseFrequency=".018 .09" numOctaves={3} seed={seed} /><feDisplacementMap in="SourceGraphic" scale={60} /></filter>
      <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" filter={`url(#br${seed})`} pathLength={1}
        strokeDasharray={1} strokeDashoffset={1 - draw} opacity={opacity} />
    </svg>
  );

export const Threads: React.FC<{ from: [number, number][]; to: [number, number][]; grow?: number; width?: number; color?: string }> =
  ({ from, to, grow = 1, width = 3, color = C.hot }) => (
    <svg width={1920} height={1080} style={{ position: 'absolute', filter: `drop-shadow(0 0 6px ${color})` }}>
      {to.map((t, i) => {
        const s = from[i % from.length];
        return <line key={i} x1={s[0]} y1={s[1]} x2={s[0] + (t[0] - s[0]) * grow} y2={s[1] + (t[1] - s[1]) * grow} stroke={color} strokeWidth={width} strokeLinecap="round" />;
      })}
    </svg>
  );

// Cursed-energy flame: turbulent tongues rising around a point.
export const Flame: React.FC<{ x: number; y: number; r: number; color: string; core?: string; seed?: string; intensity?: number }> =
  ({ x, y, r, color, core = '#dfe8ff', seed = 'f', intensity = 1 }) => {
    const f = twos(useCurrentFrame());
    return (
      <svg width={1920} height={1080} style={{ position: 'absolute', mixBlendMode: 'screen' }}>
        <filter id={`fl${seed}`} x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency=".022 .05" numOctaves={3} seed={f % 11} />
          <feDisplacementMap in="SourceGraphic" scale={r * .9} />
          <feGaussianBlur stdDeviation={2} />
        </filter>
        <radialGradient id={`fg${seed}`} cy=".6"><stop offset="0" stopColor={core} /><stop offset=".35" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient>
        <g filter={`url(#fl${seed})`} opacity={intensity}>
          <ellipse cx={x} cy={y - r * .35} rx={r * .8} ry={r * 1.3} fill={`url(#fg${seed})`} />
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse key={i} cx={x + (random(`${seed}${i}`) - .5) * r} cy={y - r * (.8 + random(`${seed}h${i}`) * .9)} rx={r * .16} ry={r * .5} fill={color} opacity={.8} />
          ))}
        </g>
      </svg>
    );
  };

export const Particles: React.FC<{ x: number; y: number; n?: number; spread?: number; rise?: number; color?: string; size?: number; seed?: string }> =
  ({ x, y, n = 30, spread = 200, rise = 6, color = C.ink, size = 8, seed = 'p' }) => {
    const f = useCurrentFrame();
    return (
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        {Array.from({ length: n }, (_, i) => {
          const life = 30 + random(`${seed}l${i}`) * 30, t = ((f + random(`${seed}o${i}`) * life) % life) / life;
          const px = x + (random(`${seed}x${i}`) - .5) * spread + Math.sin(t * 6 + i) * 10, py = y - t * rise * life;
          return <circle key={i} cx={px} cy={py} r={size * (1 - t) * (.5 + random(`${seed}s${i}`))} fill={color} opacity={1 - t} />;
        })}
      </svg>
    );
  };

export const fade = (f: number, dur: number, inF = 0, outF = 0) =>
  interpolate(f, [0, Math.max(1, inF), dur - Math.max(1, outF), dur], [inF ? 0 : 1, 1, 1, outF ? 0 : 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
