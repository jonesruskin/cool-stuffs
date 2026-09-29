// Per-shot compositions for the ink-style 30s test.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, random, Easing } from 'remotion';
import { C, Figure, Paper, Rain, NightCity, Moon, Splat, Brush, Threads, Flame, Particles, twos } from './ink';
import T01 from '../public/plates/s01.json';
import T02 from '../public/plates/s02.json';
import T05 from '../public/plates/s05.json';
import T06 from '../public/plates/s06.json';
import T07 from '../public/plates/s07.json';
import T08 from '../public/plates/s08.json';
import T09 from '../public/plates/s09.json';
import T10 from '../public/plates/s10.json';
import T11 from '../public/plates/s11.json';
import T12 from '../public/plates/s12.json';
import T13 from '../public/plates/s13.json';
import T14 from '../public/plates/s14.json';

type Pt = [number, number, number];
type Track = Record<string, Record<string, Pt>>[];
const tr = (T: unknown, f: number, who: string, bone: string): [number, number] => {
  const t = T as Track; const p = t[Math.min(t.length - 1, Math.max(0, f))]?.[who]?.[bone];
  return p ? [p[0], p[1]] : [960, 540];
};
const E = { out: Easing.out(Easing.cubic), io: Easing.inOut(Easing.cubic) };

// ---------------------------------------------------------------- drawn manga eye (ECU shots)
// Built like a key-animation drawing: tapered upper lash line, lid shadow across the iris, fibre
// striations, two highlights, crease line, lower lash ticks, and hair locks crossing the frame.
const Eye: React.FC<{ iris: string; irisDark: string; slit?: boolean; open: number; pupil: number; skin: string; shade: string; glow: string; hairCol: string; flip?: boolean }> =
  ({ iris, irisDark, slit, open, pupil, skin, shade, glow, hairCol, flip }) => {
    const f = useCurrentFrame();
    const cx = 960, cy = 560, R = 300;
    const topY = interpolate(open, [0, 1], [640, 250]);
    const up = `M 250 640 C 520 ${topY + 60}, 1200 ${topY - 20}, 1680 560`;
    const lo = `L 1680 560 C 1450 760, 760 790, 250 640`;
    const lashes = `M 250 640 C 520 ${topY + 60}, 1200 ${topY - 20}, 1680 560 L 1760 470 L 1700 520 L 1800 420 L 1690 500 C 1200 ${topY - 70}, 520 ${topY + 20}, 230 610 Z`;
    const locks = [0, 1, 2, 3].map((i) => {
      const x0 = [180, 520, 1480, 1760][i], sway = Math.sin(twos(f) * .35 + i * 1.7) * 18, w = [120, 70, 90, 150][i];
      return <path key={i} d={`M ${x0 - w} -60 C ${x0 - w + 40 + sway} 260, ${x0 - 30} 420, ${x0 + 30 + sway} ${[560, 420, 380, 640][i]} C ${x0 + 10} 380, ${x0 + w - 20 + sway} 220, ${x0 + w} -60 Z`}
        fill={hairCol} opacity={.96} />;
    });
    return (
      <AbsoluteFill style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 70%, ${skin} 0%, ${skin} 40%, ${shade} 115%)` }} />
        <svg width={1920} height={1080} style={{ position: 'absolute' }}>
          <defs>
            <clipPath id="eyeopen"><path d={`${up} ${lo} Z`} /></clipPath>
            <radialGradient id="ir" cx=".5" cy=".64" r=".62"><stop offset="0" stopColor={iris} /><stop offset=".55" stopColor={iris} /><stop offset=".85" stopColor={irisDark} /><stop offset="1" stopColor="#050203" /></radialGradient>
            <filter id="lid"><feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves={2} seed={twos(f) % 5} /><feDisplacementMap in="SourceGraphic" scale={6} /></filter>
          </defs>
          <path d={`M 360 470 C 700 ${topY - 150}, 1250 ${topY - 190}, 1580 420`} stroke="#3a2a28" strokeWidth={9} fill="none" opacity={.55} filter="url(#lid)" />
          <path d={`${up} ${lo} Z`} fill="#f6f3ec" />
          <g clipPath="url(#eyeopen)">
            <circle cx={cx} cy={cy} r={R} fill="url(#ir)" />
            {Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * Math.PI * 2; return <line key={i} x1={cx + Math.cos(a) * R * .38} y1={cy + Math.sin(a) * R * .38} x2={cx + Math.cos(a) * R * .9} y2={cy + Math.sin(a) * R * .9} stroke={irisDark} strokeWidth={4} opacity={.45} />; })}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#050203" strokeWidth={14} />
            {slit ? <path d={`M ${cx} ${cy - 210} C ${cx + 40 * pupil} ${cy - 60}, ${cx + 40 * pupil} ${cy + 60}, ${cx} ${cy + 210} C ${cx - 40 * pupil} ${cy + 60}, ${cx - 40 * pupil} ${cy - 60}, ${cx} ${cy - 210} Z`} fill="#050203" />
              : <circle cx={cx} cy={cy} r={105 * pupil} fill="#050203" />}
            <path d={`M ${cx - 190} ${cy + 150} A ${R * .8} ${R * .8} 0 0 0 ${cx + 190} ${cy + 150}`} stroke={glow} strokeWidth={22} fill="none" opacity={.55} />
            {/* shadow the upper lid casts across the eye */}
            <path d={`${up} L 1680 ${topY + 200} L 250 ${topY + 260} Z`} fill="#1a0c14" opacity={.55} />
            <ellipse cx={cx - 120} cy={cy - 110} rx={70} ry={58} fill="#fff" />
            <circle cx={cx + 150} cy={cy + 130} r={22} fill="#fff" opacity={.9} />
          </g>
          <g filter="url(#lid)">
            <path d={lashes} fill="#08080a" />
            <path d="M 420 700 L 390 740 M 560 735 L 540 775 M 720 760 L 710 795" stroke="#08080a" strokeWidth={7} strokeLinecap="round" opacity={.7} />
            <path d={`M 300 660 C 760 790, 1450 760, 1650 590`} stroke="#08080a" strokeWidth={6} fill="none" opacity={.6} />
          </g>
          {locks}
        </svg>
        <Rain n={50} len={160} speed={110} color="#ffffff" opacity={.45} seed="eye" />
      </AbsoluteFill>
    );
  };

// ---------------------------------------------------------------- scenes
const S01: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame(); const z = interpolate(f, [0, dur], [1, 1.08], { easing: E.io });
  return (<AbsoluteFill>
    <NightCity seed="s01" horizon={700} zoom={z} />
    <Figure id="s01" glow={C.blue} style={{ transform: `scale(${z})`, transformOrigin: '50% 60%' }} />
    <Rain n={260} opacity={.4} seed="s01" />
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.5), rgba(0,0,0,0) 30%)', opacity: interpolate(f, [0, 20], [1, 0], { extrapolateRight: 'clamp' }) }} />
  </AbsoluteFill>);
};
const S02: React.FC = () => {
    return (<AbsoluteFill style={{ background: 'linear-gradient(180deg,#0a0610 0%, #22070d 100%)' }}>
    <Moon x={1060} y={430} r={420} />
    <svg width={1920} height={1080} style={{ position: 'absolute' }}><path d="M 0 900 L 1920 820 L 1920 1080 L 0 1080 Z" fill={C.ink} /></svg>
    <Figure id="s02" glow={C.hot} glow2="rgba(200,22,29,.6)" style={{ transform: 'translateY(40px)' }} />
    <Rain n={160} opacity={.3} color="#ffd0d0" seed="s02" />
  </AbsoluteFill>);
};
const S03: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const open = interpolate(f, [0, 6, 22, 30], [.55, 1, 1, .72], { extrapolateRight: 'clamp' });
  const pupil = interpolate(f, [4, 12], [1.3, .6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <Eye iris="#ff3346" irisDark="#6a0712" slit open={open} pupil={pupil} skin="#e4dcd4" shade="#5a1a24" glow="#ff9a9a" hairCol="#eef0f4" />;
};
const S04: React.FC = () => {
  const f = useCurrentFrame();
  const open = interpolate(f, [0, 3, 5, 36], [.02, .02, 1, .92], { extrapolateRight: 'clamp' });
  return (<AbsoluteFill>
    <Eye iris="#ffb42a" irisDark="#7a4206" open={open} pupil={.8} skin="#e6d8c4" shade="#1a2450" glow={C.cyan} hairCol="#0b0b10" flip />
    {f > 5 && <Flame x={960} y={380} r={520} color={C.blue} core="#9ab8ff" seed="s04" intensity={interpolate(f, [5, 14], [0, .55], { extrapolateRight: 'clamp' })} />}
  </AbsoluteFill>);
};
const S05: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(180deg,#07050c,#1a0509)' }}>
    <Moon x={960} y={520} r={470} />
    <Figure id="s05" glow={C.hot} />
    <Rain n={120} opacity={.3} color="#ffd0d0" seed="s05" />
  </AbsoluteFill>
);
const S06: React.FC = () => {
  const f = useCurrentFrame(); const go = f > 8;
  return (<AbsoluteFill>
    <Paper tone={C.red} dark />
    <Brush d="M -100 820 C 500 700, 1300 760, 2020 640" width={260} seed={4} draw={interpolate(f, [0, 8], [0, 1], { extrapolateRight: 'clamp' })} />
    <Figure id="s06" glow={C.blue} glow2="rgba(47,91,255,.5)" />
    {go && <Particles x={960} y={1000} n={40} spread={900} rise={-4} color={C.paper} size={10} seed="s06" />}
  </AbsoluteFill>);
};
const S07: React.FC = () => {
  const f = useCurrentFrame(); const r = interpolate(f, [2, 16], [0, 1400], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.out });
  return (<AbsoluteFill>
    <svg width={1920} height={1080} style={{ position: 'absolute' }}>
      <path d="M 0 0 L 1150 0 L 770 1080 L 0 1080 Z" fill="#0d1a5a" /><path d="M 1150 0 L 1920 0 L 1920 1080 L 770 1080 Z" fill="#5a0610" />
      <circle cx={960} cy={430} r={r} fill="none" stroke={C.paper} strokeWidth={interpolate(f, [2, 16], [60, 4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
    </svg>
    <Figure id="s07" white glow="#ffffff" />
    <Splat x={960} y={430} r={180} at={1} seed="c7" color={C.paper} />
  </AbsoluteFill>);
};
const S08: React.FC = () => {
  const f = useCurrentFrame();
  const hits = [9, 18, 27, 36];
  return (<AbsoluteFill>
    <Paper />
    <Brush d="M -100 980 C 600 900, 1400 960, 2020 900" width={300} seed={8} opacity={.9} />
    {hits.map((h, i) => { const [x, y] = tr(T08, h, i % 2 ? 'ayame' : 'ren', i % 2 ? 'leftHand' : 'rightHand'); return <Splat key={h} x={(x + 960) / 2} y={y} r={120 + i * 20} at={h} seed={`e${i}`} />; })}
    <Figure id="s08" glow2="rgba(0,0,0,.25)" />
  </AbsoluteFill>);
};
const S09: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const L = tr(T09, f, 'ayame', 'leftHand'), R = tr(T09, f, 'ayame', 'rightHand');
  const grow = interpolate(f, [6, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.out });
  const ends = Array.from({ length: 34 }, (_, i) => { const a = (i / 34) * Math.PI * 2 + random(`t${i}`) * .15; return [960 + Math.cos(a) * 1500, 560 + Math.sin(a) * 1100] as [number, number]; });
  return (<AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, #3a0610 0%, #0a0205 70%)' }}>
    <Threads from={[L, R]} to={ends} grow={grow} width={3} />
    <Figure id="s09" glow={C.hot} glow2="rgba(255,42,58,.7)" />
    <Rain n={120} opacity={.25} color="#ffb0b0" seed="s09" />
  </AbsoluteFill>);
};
const S10: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const cut = 11, sep = interpolate(f, [cut, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.out });
  const car = (dy: number, top: boolean) => (
    <g transform={`translate(${1220 + (top ? 80 : 0) * sep}, ${700 + dy}) rotate(${top ? -8 * sep : 0})`} clipPath={top ? 'url(#ctop)' : 'url(#cbot)'}>
      <path d="M -300 120 L -280 40 L -160 30 L -90 -40 L 150 -40 L 230 30 L 330 50 L 340 120 Z" fill="#0b0c14" stroke={C.cyan} strokeWidth={4} />
      <path d="M -70 -28 L 130 -28 L 200 28 L -140 28 Z" fill="#23304f" />
      <circle cx={-170} cy={125} r={50} fill={C.ink} stroke={C.cyan} strokeWidth={3} /><circle cx={200} cy={125} r={50} fill={C.ink} stroke={C.cyan} strokeWidth={3} />
    </g>);
  return (<AbsoluteFill>
    <NightCity seed="s10" horizon={780} drift={interpolate(f, [0, dur], [0, 700])} neon={.8} />
    <svg width={1920} height={1080} style={{ position: 'absolute' }}>
      <defs><clipPath id="ctop"><path d="M -400 -200 L 400 -200 L 400 -10 L -400 60 Z" /></clipPath><clipPath id="cbot"><path d="M -400 60 L 400 -10 L 400 300 L -400 300 Z" /></clipPath></defs>
      {car(-60 * sep, true)}{car(0, false)}
      {f >= cut && f < cut + 8 && <line x1={800} y1={770} x2={1640} y2={690} stroke={C.hot} strokeWidth={8} style={{ filter: `drop-shadow(0 0 10px ${C.hot})` }} />}
    </svg>
    <Threads from={[[-50, 560], [-50, 470], [-50, 650]]} to={[[1980, 610], [1980, 430], [1980, 700]]} width={3} />
    <Figure id="s10" glow={C.blue} />
    <Splat x={1220} y={700} r={160} at={cut} seed="car" color={C.hot} />
    <Rain n={200} opacity={.35} seed="s10" slant={-.45} />
  </AbsoluteFill>);
};
const S11: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame(); const [x, y] = tr(T11, f, 'ren', 'rightHand');
  const g = interpolate(f, [0, dur], [.45, 1]);
  return (<AbsoluteFill style={{ background: '#05060d' }}>
    <Brush d="M 960 170 C 1330 170, 1420 520, 1320 760 C 1200 1000, 700 990, 590 760 C 480 520, 640 200, 1010 190" color="#dcd4c2" width={120} seed={11}
      draw={interpolate(f, [0, 14], [0, .97], { extrapolateRight: 'clamp', easing: E.out })} />
    <Flame x={x} y={y + 40} r={220 * g} color={C.blue} core="#c8d8ff" seed="s11" />
    <Figure id="s11" glow="#9ab8ff" glow2={C.blue} />
    <Flame x={x} y={y + 30} r={120 * g} color={C.blue} core="#e0e8ff" seed="s11b" intensity={.8} />
    <Particles x={x} y={y + 60} n={40} spread={260} rise={8} color="#000" size={12} seed="ink" />
    <Particles x={x} y={y + 40} n={20} spread={220} rise={11} color="#9ab8ff" size={4} seed="sp" />
  </AbsoluteFill>);
};
const S12: React.FC = () => {
  const f = useCurrentFrame();
  return (<AbsoluteFill>
    <Paper tone={f < 12 ? C.paper : '#e6dfcf'} />
    <Splat x={1000} y={520} r={520} at={2} seed="flash" color={C.ink} dur={4} />
    <Splat x={1000} y={520} r={300} at={3} seed="flash2" color={C.red} dur={4} />
    <Figure id="s12" white={f >= 3 && f < 12} glow={f >= 3 ? C.hot : undefined} />
  </AbsoluteFill>);
};
const S13: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame(); const hit = 7; const [sx, sy] = tr(T13, hit, 'ayame', 'hips');
  const k = Math.max(0, f - hit);
  const shards = Array.from({ length: 60 }, (_, i) => {
    const a = random(`g${i}`) * Math.PI * 2, v = 14 + random(`gv${i}`) * 40;
    const x = sx + Math.cos(a) * v * k + 20 * k, y = sy + Math.sin(a) * v * k + 1.2 * k * k;
    return f >= hit && <rect key={i} x={x} y={y} width={10 + random(`gs${i}`) * 34} height={6 + random(`gh${i}`) * 22} fill={random(`gc${i}`) > .5 ? '#ff6a72' : '#dfe8ff'} transform={`rotate(${k * 20 * (random(`gr${i}`) - .5)} ${x} ${y})`} opacity={Math.max(0, 1 - k / 34)} />;
  });
  const on = f < hit ? 1 : random(`fl${twos(f)}`) > .55 ? .85 : .1;
  const sign = (
    <svg width={1920} height={1080} style={{ position: 'absolute' }}>
      <g opacity={on} style={{ filter: `drop-shadow(0 0 22px ${C.hot})` }} transform={f >= hit ? `rotate(${Math.min(12, k * 1.5)} ${sx} ${sy - 150})` : undefined}>
        <rect x={sx - 95} y={sy - 150} width={190} height={300} fill="#120509" stroke={C.hot} strokeWidth={8} />
        {['居', '酒', '屋'].map((c, i) => <text key={c} x={sx} y={sy - 62 + i * 88} textAnchor="middle" fontFamily="Noto Sans JP" fontWeight={700} fontSize={76} fill="#ff8a90">{c}</text>)}
      </g>
      {f >= hit && <circle cx={sx} cy={sy} r={40 + k * 30} fill="none" stroke="#fff" strokeWidth={Math.max(0, 16 - k)} opacity={Math.max(0, 1 - k / 12)} />}
      {shards}
    </svg>);
  return (<AbsoluteFill>
    <NightCity seed="s13" horizon={1040} neon={.5} />
    {f < hit ? <>{sign}<Figure id="s13" glow={C.hot} /></> : <><Figure id="s13" glow={C.hot} style={{ opacity: Math.max(.25, 1 - k / 8) }} />{sign}</>}
    <Rain n={200} opacity={.35} seed="s13" />
  </AbsoluteFill>);
};
const S14: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame(); const [x, y] = tr(T14, f, 'ren', 'rightHand');
  const e = interpolate(f, [0, dur], [1, .15]);
  return (<AbsoluteFill>
    <NightCity seed="s14" horizon={820} neon={.9} />
    <AbsoluteFill style={{ background: 'rgba(5,6,12,.35)' }} />
    <Particles x={x} y={y - 20} n={26} spread={80} rise={5} color="rgba(220,226,240,.35)" size={26} seed="steam" />
    <Figure id="s14" glow={`rgba(47,91,255,${e})`} glow2={`rgba(47,91,255,${e * .6})`} />
    <Rain n={320} opacity={.45} seed="s14" />
  </AbsoluteFill>);
};

export const SCENES: Record<string, React.FC<{ dur: number }>> = { s01: S01, s02: S02, s03: S03, s04: S04, s05: S05, s06: S06, s07: S07, s08: S08, s09: S09, s10: S10, s11: S11, s12: S12, s13: S13, s14: S14 };
// silence unused-import lint for tracks only used for framing reference
void T01; void T05; void T06; void T07; void T10; void T12; void T13;
