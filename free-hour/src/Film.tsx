// The edit: one Sequence per chapter (timing from timeline.json), a shared background, HUD, grain and score.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, getStaticFiles } from 'remotion';
import { CHAPTERS, ChapterId, PAL, F } from './lib/theme';
import { Background, Grain } from './lib/kit';
import { HUD } from './lib/hud';
import { Open, Axioms, TitleExit } from './scenes/Intro';
import { SCENES } from './scenes';

const Placeholder: React.FC<{ id: ChapterId }> = ({ id }) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: F.serif, fontSize: 120, color: PAL[id].ink }}>{id}</AbsoluteFill>
);
const MAP: Partial<Record<ChapterId, React.FC>> = { open: Open, axioms: Axioms, ...SCENES };

export const Film: React.FC = () => {
  const hasScore = getStaticFiles().some((f) => f.name === 'score.wav');
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Background />
      {CHAPTERS.map((c) => {
        const C = MAP[c.id];
        return (
          <Sequence key={c.id} from={c.from} durationInFrames={c.dur} name={`${c.index} ${c.id}`}>
            {C ? <C /> : <Placeholder id={c.id} />}
          </Sequence>
        );
      })}
      <Sequence from={CHAPTERS[1].from} durationInFrames={40}><TitleExit /></Sequence>
      <HUD />
      <Grain />
      {hasScore && <Audio src={staticFile('score.wav')} />}
    </AbsoluteFill>
  );
};
