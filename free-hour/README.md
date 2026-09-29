# The Free Hour — a short history of fun

A 3-minute motion-graphics film about how people have enjoyed their free time, from the fire circle
40,000 years ago to the age of generative AI. It is written, designed, animated and scored entirely
in code with Remotion.

▶ `the-free-hour.mp4` (1920×1080, 30 fps, stereo, 3:00)

## The idea, from first principles

Strip away the technology and fun has always met the same **six needs**:
**Story · Game · Rhythm · Together · Thrill · Making**. What changes over history is only:

1. **the carrier**: fire → stage → page → clock → signal → screen → AI
2. **who gets to play, and how much free time they have**
3. **how many people share one experience**: about 30 around a fire, about 50,000 in the
   Colosseum, one reader with a book, an estimated 600 million for the 1969 Moon landing, then,
   with AI, **one** again

The film's through-line makes that visible. A running bar at the bottom tracks the era on a log
timeline, the current carrier and the audience of one experience. Every era tags its artefacts with
the six constant glyphs, and the finale sets all 42 of them in a single table.

## Structure (100 BPM · one bar = 2.4 s; every cut lands on the bar)

| Time | Chapter | Beats |
|---|---|---|
| 0:00 | Cold open | An ember · "Every person who ever lived…" · title |
| 0:12 | The six constants | What is play? · the hexagon of needs |
| 0:31 | The Fire | Fire circle · smoke becomes a cave bison · painted hand · "There was no audience" |
| 0:48 | The City | Senet · a Greek theatre fills to 14,000 · morphs into the Colosseum's 50,000 · the crowd splits from the show |
| 1:07 | The Page | Chess and cards travel · the press stamps a page into thousands of copies · the solitary reader |
| 1:22 | The Clock | 60+ hour weeks · "eight hours for what we will" · coasters, Ferris wheels, football |
| 1:38 | The Signal | Phonograph · cinema · radio lights up the houses · a city of synced TVs · the Moon, about 600M |
| 1:58 | The Screen | Pong · Walkman · the Web · the infinite feed · "Endless supply. Scarce attention." |
| 2:19 | The Audience of One | Generated stories, songs and worlds · the audience chart collapses to 1 · the orb becomes a fire |
| 2:41 | Close | Six needs × seven carriers · "The carriers change. The need never does." |

## The score

`music/score.py` builds the soundtrack from one motif, re-orchestrated by each era's carrier: a bone
flute with frame drum, then lyre plucks and chorus (with a crowd roar for the arena), then lute and
drone, then clockwork and a music-hall piano, then a crackly phonograph blooming into strings, then
chiptune and synth-pop, then generative FM bells. At the close everything plays it together and
resolves to D major. It uses orchestral samples from VSCO-2 CE (CC0) and synthesised voices, and is
mastered to about −14 LUFS.

## Build

```bash
npm install
python3 music/score.py                         # public/score.wav (needs VSCO-2 CE; see ../jjk/music/engine.py)
npx remotion studio                            # scrub the film in a browser
npx remotion render FreeHour out/free-hour.mp4 --crf=16
```

`src/lib/` holds the design system: palette per era, kinetic type, draw-on line art, glyphs, the
running bar and fire. `src/scenes/` holds one file per chapter. `timeline.json` drives both the
picture and the music.

Facts on screen were checked against Britannica, Our World in Data, Newzoo, CSIRO and museum
sources, and rounded conservatively (for example "up to 14,000", "about 50,000", "an estimated
600 million", "over 3 billion").
