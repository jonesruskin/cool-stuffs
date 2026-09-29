import { Composition } from 'remotion';
import { Film } from './Film';
import { FPS, TOTAL } from './lib/theme';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/jetbrains-mono/400.css';

export const Root = () => <Composition id="FreeHour" component={Film} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />;
