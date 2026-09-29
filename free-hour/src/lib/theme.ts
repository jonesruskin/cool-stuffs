// Design system: timing, palette per era, type, easing.
import { Easing, interpolate, interpolateColors } from 'remotion';
import TL from '../../timeline.json';

export const FPS = TL.fps;
export const BAR = TL.barFrames;          // 100 BPM → one bar = 2.4 s = 72 frames
export const BEAT = BAR / 4;              // 18 frames

export type ChapterId = 'open' | 'axioms' | 'fire' | 'city' | 'page' | 'clock' | 'signal' | 'screen' | 'ai' | 'close';
export const CHAPTERS = (() => {
  let f = 0;
  return TL.chapters.map((c, i) => { const from = f; const dur = c.bars * BAR; f += dur; return { ...c, id: c.id as ChapterId, index: i, from, dur }; });
})();
export const TOTAL = CHAPTERS.reduce((a, c) => a + c.dur, 0);
export const chapter = (id: ChapterId) => CHAPTERS.find((c) => c.id === id)!;

export type Pal = { bg: string; bg2: string; ink: string; dim: string; acc: string; acc2: string };
export const PAL: Record<ChapterId, Pal> = {
  open:   { bg: '#0b0a09', bg2: '#15110d', ink: '#efe8db', dim: '#7d766b', acc: '#ff7a3d', acc2: '#ffc46b' },
  axioms: { bg: '#0d0c0b', bg2: '#17140f', ink: '#efe8db', dim: '#7d766b', acc: '#ff7a3d', acc2: '#ffc46b' },
  fire:   { bg: '#110a06', bg2: '#24130a', ink: '#f4e7d5', dim: '#8a7560', acc: '#ff8a3d', acc2: '#ffc86b' },
  city:   { bg: '#130d0a', bg2: '#2a1810', ink: '#f2e4d1', dim: '#8d7866', acc: '#e0673c', acc2: '#e9b86a' },
  page:   { bg: '#0f0f10', bg2: '#1c1a17', ink: '#ede6d5', dim: '#827b6e', acc: '#d1a64b', acc2: '#9b3232' },
  clock:  { bg: '#0c0f12', bg2: '#18202a', ink: '#e7e9e6', dim: '#76818a', acc: '#d0583f', acc2: '#9db2c0' },
  signal: { bg: '#061014', bg2: '#0c2129', ink: '#dff4ef', dim: '#6d8d8a', acc: '#6fe3c7', acc2: '#ffd166' },
  screen: { bg: '#0a0716', bg2: '#1b1036', ink: '#f3eefe', dim: '#8a80a8', acc: '#ff4fa3', acc2: '#3fd0ff' },
  ai:     { bg: '#07060d', bg2: '#151129', ink: '#f4f1ff', dim: '#8983a8', acc: '#a78bfa', acc2: '#5eead4' },
  close:  { bg: '#0b0a09', bg2: '#17120d', ink: '#efe8db', dim: '#7d766b', acc: '#ff7a3d', acc2: '#ffc46b' },
};

// Palette at an absolute frame: each chapter's colours cross-fade into the next over the last half bar.
export const palAt = (frame: number): Pal => {
  let i = CHAPTERS.findIndex((c) => frame < c.from + c.dur); if (i < 0) i = CHAPTERS.length - 1;
  const c = CHAPTERS[i], n = CHAPTERS[Math.min(i + 1, CHAPTERS.length - 1)];
  const t = interpolate(frame, [c.from + c.dur - BAR / 2, c.from + c.dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const a = PAL[c.id], b = PAL[n.id];
  const k = (key: keyof Pal) => interpolateColors(t, [0, 1], [a[key], b[key]]);
  return { bg: k('bg'), bg2: k('bg2'), ink: k('ink'), dim: k('dim'), acc: k('acc'), acc2: k('acc2') };
};

export const F = {
  serif: '"Instrument Serif", Georgia, serif',
  sans: 'Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", monospace',
};

export const ease = {
  out: Easing.bezier(.16, 1, .3, 1),        // expo-ish out: premium settle
  inOut: Easing.bezier(.65, 0, .35, 1),
  in: Easing.bezier(.7, 0, .84, 0),
  soft: Easing.bezier(.33, 1, .68, 1),
};
// 0→1 over [a, a+d] with easing
export const prog = (f: number, a: number, d: number, e = ease.out) =>
  interpolate(f, [a, a + Math.max(1, d)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });
// in at a, out at b (fade envelope)
export const env = (f: number, a: number, b: number, fi = 14, fo = 12) =>
  Math.min(prog(f, a, fi), 1 - prog(f, b - fo, fo, ease.in));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
