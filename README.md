# Tmd-TS

A modern TypeScript/JavaScript implementation of the **TMD** (Timebase Mark Down) markup language parser, toolkit, and music notation exporter.

In memory of **Chen, Chih-Han / [aguai](https://github.com/aguai)** (阿怪, 1974–2019).

- **Original project**: [https://github.com/aguai/TMDLang](https://github.com/aguai/TMDLang)
- **TMD Samples & Editor Extensions**: [https://github.com/zonble/TmdSwift](https://github.com/zonble/TmdSwift)

## Samples & Editor Extensions

TMD score samples (`.tmd` files) and editor extensions (such as syntax highlighting for VS Code, TextMate, and other editors) can be obtained from the [**TmdSwift**](https://github.com/zonble/TmdSwift) repository:

- 🎼 **TMD Score Samples**: [https://github.com/zonble/TmdSwift](https://github.com/zonble/TmdSwift)
- 💻 **Editor Extensions & Syntax Highlighting**: [https://github.com/zonble/TmdSwift](https://github.com/zonble/TmdSwift)

## About TMD

TMD is a plain-text musical notation DSL designed by composer and music producer 阿怪 (aguai, known for classics such as A-Mei's 《三天三夜》). It allows musicians and arrangers to describe multi-track songs, numbered musical notation (jianpu), chord progressions, tuplets, and playback arrangements in a concise, human-readable text format.

In the age of generative AI, TMD can also serve as a music-native intermediate representation between a creator's intent and final music files:
- **More reliable musical generation**: AI can describe reusable motifs, chord progressions, arrangement changes, and key transpositions without regenerating every note, reducing structural and consistency errors.
- **Lower token usage**: Repetition, variation, and transposition can be expressed as structure instead of duplicated note data.
- **Preserved musical relationships**: The connection between a motif, its variations, and the overall song arrangement remains explicit.
- **Verifiable and reproducible output**: Structured text is easier to validate, edit, regenerate, and review than unstructured generated audio.
- **Interoperability**: TMD can be converted into MIDI, MusicXML, LilyPond, ABC notation, ChordPro, VOCALOID, or audio for downstream tools.

At its core, TMD reflects the practical workflow and mental model of modern popular music songwriting and arrangement:
- **Lead-sheet and Jianpu thinking**: Melodies are expressed in movable-do numbered scale degrees (`1`–`7`), octaves (`^`, `_`), and accidentals (`'`, `,`), making transpositions and melodic contours intuitive without the visual clutter of traditional staves.
- **Harmony-first architecture**: Chord symbols (both harmonic scale degrees like `[1]`, `[6m]` and standard chord names like `[Cmaj7]`) are treated as first-class citizens alongside melody lines.
- **Section-oriented modularity**: Songs are broken down into named song forms (`intro`, `verse`, `chorus`, `bridge`), with independent multi-instrument tracks entering at specified measure offsets (`@|+4|`).
- **Arrangement as linear execution flow**: Song playback and modulations (`{?+3}`, `{?-3}`) are declared as an explicit execution sequence (`-> intro -> A -> B -> C ->#`), mirroring how musicians and producers compose, rehearse, and structure arrangements in their minds.

**Tmd-TS** re-implements the original parser into a clean, modern TypeScript architecture featuring:
- A two-stage Lexer + TokenParser pipeline with expected token error reporting.
- Normalized musical AST structures (`Beat`, `Note`, `Unit`, `Section`, `Paragraph`, `Order`, `Sheet`).
- Formatter to serialize AST back to standard TMD syntax.
- **Multi-track MIDI (SMF Type 1)** exporter with full General MIDI instrument mapping.
- **REAPER Project (.rpp)** exporter for DAW arrangement, multi-track layout, color-coded tracks, stereo panning, section markers, and inline MIDI.
- **ChordPro (.cho)** lead sheet exporter for charts, lead sheets, and songbooks.
- **VOCALOID2 (.vsq)** and **VOCALOID3/4 (.vsqx)** project exporters for vocal synthesizers.
- **MusicXML 4.0** notation exporter for MuseScore, Sibelius, and web renderers.
- **LilyPond** engraver exporter for publication-grade score typesetting and PDF rendering.
- **ABC Notation** exporter for web sheet rendering (`abcjs`) and text-based score sharing.
- **Lightweight Fallback WAV Audio** synthesizer (pure software sine-wave synthesizer for pitch/rhythm audition without platform dependencies; see [Audio Limitations](#audio-rendering--wav-limitations)).
- A command-line interface (`tmd`) with built-in MCP server support.

## Co-Composing with AI Using TMD

Because TMD is a concise, text-based, and human-readable musical notation DSL, it serves as an ideal bridge between human musical ideas and generative AI / Large Language Models (LLMs). Instead of wrestling with opaque binary formats (MIDI) or unstructured audio waveforms, creators and AI agents can pair-program music interactively in TMD.

### 🚀 Equip Your AI Assistant in One Command

`Tmd-TS` comes with an official AI Agent skill (`SKILL.md`) covering TMD syntax, modular section chunking, human composition principles, motif development, and counterpoint rules. You can install it directly into your local AI environment (supporting Codex, Claude Code, Antigravity, and Gemini):

```bash
tmd --install-skills
```

Once installed, your AI agent will automatically understand how to compose, arrange, debug, and orchestrate music using TMD.

### What AI Can Help You Achieve

1. **Arranging Accompaniments from Melody**:
   Draft a vocal line or melody in TMD, then prompt the AI to generate supporting tracks (bass lines, rhythm guitar grooves, string pads, or drum patterns) with specific entry offsets (`@|+4|`).

2. **Motif Development & Continuation**:
   Define a short 2-bar or 4-bar melodic motif, and let the AI develop it into complete phrases through inversion, retrograde, rhythmic variations, or antecedent-consequent question-and-answer phrasing.

3. **Re-Harmonization & Chord Exploration**:
   Provide a melody and have the AI propose multiple chord progressions—from standard pop and rock progressions to modal jazz substitutions and Neo-Soul extensions (`[Cmaj7]`, `[Am7]`, `[Dm7-5]`).

4. **Macro Song Structuring & Modulations**:
   Compose core song blocks (`intro`, `verse`, `chorus`, `bridge`) and have the AI plan the overarching playback sequence (`-> intro -> A -> B -> {?+1} -> B ->#`), complete with key modulations and emotional dynamics.

5. **Textural Layering & Arrangement Build-Up**:
   Use measure entry offsets (`@|0|`, `@|+4|`, `@|-1|`) to guide the AI in orchestrating gradual instrumentation build-ups, pick-up measures (anticipation notes), and dynamic contrast across sections.

6. **Style & Metric Variations**:
   Prompt the AI to adapt a 4/4 ballad into a 3/4 waltz, re-groove straight rhythms into syncopated Funk/R&B patterns, or add tuplet ornaments `(1 2 3)%(--)`.

## Online Web Studio (GitHub Pages)

Experience TMD editing and playback directly in your browser without installing anything:

- **Interactive Editor**: Syntax highlighting for TMD metadata, numbered notation (`1`–`7`), octaves, chords (`[1]`, `[6m]`), and directives.
- **Multi-Format Export**: One-click download for Standard MIDI (`.mid`), MusicXML 4.0 (`.musicxml`), LilyPond (`.ly`), ABC Notation (`.abc`), and WAV audio.
- **In-Browser Audio Player**: Floating playback bar matching `zago`'s WebAssembly edition, featuring Grand Piano (FluidR3 SoundFont), Chiptune TinySynth, and Web MIDI hardware output.
- **Preset Scores**: Instant loading for classic tunes such as 《三天三夜》, 《少年》, and contrapuntal canons.

Run the web studio locally:

```bash
npm run web:dev
```

## Requirements

- **Node.js**: `v20.0.0` or newer.

## Installation

### Global Installation (CLI)

Install globally via `npm` to use the `tmd` command anywhere:

```bash
npm install -g tmd-ts
```

Or run directly without permanent installation via `npx`:

```bash
npx tmd-ts <input-path> [options]
```

### Local Dependency (TypeScript / JavaScript Projects)

Add `tmd-ts` to your project:

```bash
npm install tmd-ts
```

### Build from Source

```bash
git clone https://github.com/zonble/Tmd-TS.git
cd Tmd-TS
npm install
npm run build
npm link    # Optional: creates global `tmd` symlink to local build
```

## CLI Usage (`tmd`)

```bash
# 1. Parse and print score summary
tmd score.tmd -p

# 2. Export to Standard MIDI file
tmd score.tmd -m score.mid

# 3. Export to REAPER Project (.rpp) with tracks, colors, panning, markers & inline MIDI
tmd score.tmd -r score.rpp

# 4. Export to MusicXML (open with MuseScore, Sibelius, Finale, etc.)
tmd score.tmd -x score.musicxml

# 5. Export to LilyPond (.ly) source file
tmd score.tmd -l score.ly

# 6. Render directly to PDF using local lilypond compiler
tmd score.tmd --pdf-output score.pdf

# 7. Export to ABC notation file (for abcjs or Markdown web rendering)
tmd score.tmd -a score.abc

# 8. Render to lightweight WAV audio preview (pure sine wave fallback)
tmd score.tmd -w preview.wav

# 9. Play preview through system audio player (afplay on macOS, aplay on Linux)
tmd score.tmd --play

# 10. Install TMD skill definition for AI agents (Codex, Antigravity, Claude, etc.)
tmd --install-skills
```

## TypeScript / JavaScript API Usage

```typescript
import {
  TmdParser,
  formatSummary,
  TMDMIDIGenerator,
  TMDReaperGenerator,
  TMDMusicXMLGenerator,
  TMDLilyPondGenerator,
  TMDABCGenerator,
  TMDWAVRenderer,
} from "tmd-ts";

// Parse TMD from a string or file path
const scoreText = `
::SCORE::
** My Song **
!= 120
?= C
<4/4>

intro:Piano@|0|{
<4*>
1 2 3 4
}

-> intro ->#
`;

const sheet = TmdParser.parse(scoreText);
if (!sheet) {
  throw new Error("Failed to parse TMD score");
}

// Inspect summary
console.log(formatSummary(sheet));

// Export to MIDI Uint8Array
const midiData = TMDMIDIGenerator.generateMIDI(sheet);

// Export to REAPER project (.rpp) string
const rppProject = TMDReaperGenerator.generateRPP(sheet);

// Export to MusicXML string
const musicXML = TMDMusicXMLGenerator.generateMusicXML(sheet);

// Export to LilyPond string
const lilyPond = TMDLilyPondGenerator.generateLilyPond(sheet);

// Export to ABC notation string
const abc = TMDABCGenerator.generateABC(sheet);

// Render to lightweight WAV Uint8Array preview (sine wave fallback)
const wavData = TMDWAVRenderer.renderWAV(sheet);
```

## Audio Rendering & WAV Limitations

Unlike [**TmdSwift**](https://github.com/zonble/TmdSwift) on macOS (which leverages the system-level CoreAudio / AudioToolbox engine with built-in Roland GS DLS SoundFonts to synthesize full General MIDI instrument arrangements), Node.js environments lack native access to OS-level soundbanks.

- **Fallback Synth Only**: `Tmd-TS` includes a minimal, pure TypeScript sine-wave synthesizer in `src/audio.ts` solely as a zero-dependency fallback for quick offline pitch and rhythm checks.
- **No SoundFont / Sampler Support**: It does not synthesize realistic acoustic instruments, drum kits, or load `.sf2` / `.dls` soundbanks.
- **Recommended Workflow for High-Quality Audio**:
  - Export to Standard MIDI (`tmd score.tmd -m score.mid`) and import the file into your favorite DAW (Logic Pro, GarageBand, Ableton Live, Reaper, Cubase, etc.) or software synth.
  - Or use **TmdSwift** on macOS for direct DLS / SoundFont offline rendering.

## Modules & Architecture

- **`core/`**: Lexer, Parser, AST data structures, playback timeline, and TMD source formatter.
- **`exporters/`**:
  - `midi.ts`: Binary SMF Type 1 multi-track MIDI file generator.
  - `musicxml.ts`: W3C MusicXML 4.0 Partwise generator.
  - `lilypond.ts`: LilyPond engraving source generator.
  - `abc.ts`: Standard ABC Notation (v2.1+) generator.
- **`audio.ts`**: Portable 16-bit stereo PCM WAV synthesizer (pure sine-wave fallback).
- **`skill.ts`**: AI agent skill definitions and automated installation utilities for AI assistants.
- **`utils/`**: Cross-platform file path normalizer and character encoding detector.
- **`cli.ts`**: Command-line interface executable (`tmd`).

## Development

```bash
npm install
npm test         # Run Vitest test suite
npm run build    # Compile TypeScript to dist/
```

## License

MIT License
