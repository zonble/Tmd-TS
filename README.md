# Tmd-TS

TypeScript implementation of TMD (Timebase Mark Down), including the parser, normalized AST, formatter, playback timeline, MIDI, MusicXML, LilyPond, ABC, and WAV exporters.

## Development

Requires Node.js 20 or newer.

```sh
npm install
npm test
npm run build
```

## CLI

```sh
npx tmd score.tmd --parse-only
npx tmd score.tmd --midi-output score.mid
npx tmd score.tmd --musicxml-output score.musicxml
npx tmd score.tmd --lilypond-output score.ly
npx tmd score.tmd --abc-output score.abc
npx tmd score.tmd --wav-output score.wav
npx tmd --install-skills
```

The WAV renderer is a deterministic, dependency-free fallback synthesizer that works on Node.js platforms. `--play` uses `afplay` on macOS and `aplay` on Linux.

## Library

```ts
import { TmdParser, TMDMIDIGenerator } from "tmd-ts";

const sheet = TmdParser.parseFile("score.tmd");
const midi = TMDMIDIGenerator.generateMIDI(sheet);
```

Input helpers also support `file://` URLs, editor locations such as `score.tmd:12:4`, UTF-8, UTF-16, and common single-byte fallback decoding.

## CI/CD

GitHub Actions runs install, build, unit tests, a package smoke test, and uploads an npm artifact on `main`. Pushing a `vX.Y.Z` tag runs the release workflow and publishes to npm using the repository's `NPM_TOKEN` secret.

MIT License.
