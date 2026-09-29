// The 30-second edit. Shot timing comes from shots.json (a bar = 36 frames at 160 BPM / 24 fps),
// so picture, score and the GPU generation queue all share one source of truth.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, random } from 'remotion';
import S from '../shots.json';
import A from './assets.json';
import { SCENES } from './scenes';
import { SpeedLines, Flash, TechniqueCard, Subtitle, Location, Title, BlackLightning, Grain, Vignette, Charge, impactFilter } from './fx';

export type ShotT = (typeof S.shots)[number] & { hit?: number; hits?: number[]; sub?: string[] };
const BAR = S.barFrames;
const PAPER = ['s08', 's12'];
export const TIMELINE = (() => {
  let f = 0;
  return (S.shots as ShotT[]).map((s) => {
    const from = f, dur = Math.round(s.bars * BAR); f += dur;
    // hits are given in bars relative to the shot start
    const hits = [...(s.hit !== undefined ? [s.hit] : []), ...(s.hits ?? [])].map((b) => Math.round(b * BAR));
    return { ...s, from, dur, hitFrames: hits };
  });
})();
export const TOTAL = TIMELINE.reduce((a, s) => a + s.dur, 0);

const ShotWithFx: React.FC<{ s: (typeof TIMELINE)[number] }> = ({ s }) => {
  const f = useCurrentFrame();
  const fx = s.fx as string[];
  const big = fx.includes('impact') || fx.includes('inkflash');
  // impact frames: a short, hand-timed run of stylised frames after each big hit
  const pattern = fx.includes('inkflash') ? [1, 1, 2, 2, 1, 3, 3, 2, 4, 4, 2, 0, 2, 0] : fx.includes('impact') ? [1, 1, 2, 2, 4] : [];
  let imp = 0;
  for (const h of s.hitFrames) { const k = f - h; if (k >= 0 && k < pattern.length) imp = pattern[k]; }
  // camera shake: decays from each hit (or from the shot start)
  let amp = 0;
  if (fx.includes('shake')) {
    for (const h of (s.hitFrames.length ? s.hitFrames : [0])) { const k = f - h; if (k >= 0) amp = Math.max(amp, (big ? 34 : 14) * Math.exp(-k / 6)); }
  }
  const tx = (random(`x${s.id}${f}`) - .5) * 2 * amp, ty = (random(`y${s.id}${f}`) - .5) * 2 * amp;
  const card = fx.find((x) => x.startsWith('card:'));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${1 + amp / 900})` }}>
        <AbsoluteFill style={{ filter: impactFilter(imp) }}>{SCENES[s.id] ? React.createElement(SCENES[s.id], { dur: s.dur }) : null}</AbsoluteFill>
        {imp === 2 && <AbsoluteFill style={{ background: '#c8101e', mixBlendMode: 'multiply' }} />}
        {fx.includes('charge') && <Charge dur={s.dur} />}
        {fx.includes('speedlines') && <SpeedLines seed={s.id} strength={imp ? 1 : .6} dark={imp === 3 || PAPER.includes(s.id)} />}
        {big && s.hitFrames.some((h) => f >= h && f < h + 5) && <SpeedLines seed={s.id + 'i'} strength={1} dark={imp === 3} />}
        {fx.includes('inkflash') && f < 22 && <BlackLightning seed={s.id} />}
      </AbsoluteFill>
      {(fx.includes('flash') || big) && s.hitFrames.map((h) => <Flash key={h} at={h} />)}
      {card && <TechniqueCard spec={card} dur={s.dur} />}
      {fx.includes('inkflash') && <TechniqueCard spec="card:墨閃:INK FLASH:center" dur={s.dur} delay={3} />}
      {fx.includes('location') && <Location dur={s.dur} />}
      {fx.includes('title') && <Title dur={s.dur} />}
      {s.sub && <Subtitle jp={s.sub[0]} en={s.sub[1]} dur={s.dur} />}
    </AbsoluteFill>
  );
};

export const Film: React.FC = () => (
  <AbsoluteFill style={{ background: '#050507' }}>
    {TIMELINE.map((s) => (
      <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={`${s.id} ${s.label}`}>
        <ShotWithFx s={s} />
      </Sequence>
    ))}
    <Vignette />
    <Grain />
    {(A as { score?: boolean }).score && <Audio src={staticFile('score30.wav')} />}
  </AbsoluteFill>
);
