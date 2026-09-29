import { Composition } from 'remotion';
import { Film, TOTAL } from './Film';
import S from '../shots.json';
import '@fontsource/shippori-mincho-b1/800.css';
import '@fontsource/noto-sans-jp/700.css';
import '@fontsource/oswald/600.css';

export const Root = () => (
  <Composition id="Test30" component={Film} durationInFrames={TOTAL} fps={S.fps} width={S.width} height={S.height} />
);
