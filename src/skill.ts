import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export class TmdSkill {
  static readonly skillName = "tmd";
  static readonly skillMarkdown = `# TMD (Timebase Mark Down)

## Role

TMD is a human-readable, text-based musical intermediate representation. Use it for numbered notation (jianpu), chord progressions, modular song sections, arrangement order, transposition, and reproducible export. Always parse and validate a score after editing, preserve existing musical intent, and report structural changes clearly.

## Score structure

Every score starts with \`::SCORE::\`. The title, tempo, key, and meter are optional but conventionally written as:

\`\`\`tmd
::SCORE::
** Song title **
!= 120
?= C
<4/4>
\`\`\`

Metadata uses \`~ "詞：..."\` for credits or named fields such as \`=~:__COMPOSER__= "..."\`. Paragraphs are tracks: \`name:instrument@|measure-offset|{ ... }\`. The final execution order is explicit: \`-> intro -> verse -> chorus ->#\`.

## Musical notation

- Notes are scale degrees \`1\` through \`7\`, relative to the score key.
- Sharp and flat use \`'\` and \`,\`; octaves use \`^\` and \`_\` (for example \`1'\`, \`5^\`, \`3_\`).
- \`0\` is a rest, \`-\` sustains/ties the prior sound, and \`XxTtSs\` patterns are percussion.
- Chords are bracketed: \`[C]\`, \`[Dm7]\`, \`[G7]\`, \`[Cmaj7]\`, \`[1m]\`, \`[5sus4]\`.
- A tuplet or rhythmic group is \`(1 2 3)%(--)\`; the number of dashes gives its total duration.
- A section begins with a note-length declaration such as \`<4*>\` or \`<8*>\`; use another declaration to start a new section.

## Directives and arrangement

Section directives occur at the current unit position: \`{!=140}\` sets tempo, \`{!+10}\` changes tempo relatively, \`{?=G}\` sets an absolute key, \`{?+2}\` transposes by semitones, and \`{<3/4>}\` changes meter. Arrangement entries \`->{?+2}\` and \`->{?=G}\` apply a modulation between named paragraphs. Negative offsets create pickup measures; positive offsets delay a track.

## Composition guidance

Build reusable motifs and sections before expanding a full arrangement. Keep melody, bass, harmony, and percussion in separate paragraphs. Match rhythmic density between parts, avoid parallel fifths/octaves in independent contrapuntal voices, and use complementary motion. For a canon, repeat a motif in a later paragraph with a deliberate offset and transposition. For a fugue, introduce subject, answer, countersubject, episode, and stretto as explicit sections.

## Tool workflow

1. Parse the complete source and inspect title, meter, key, paragraphs, directives, and order.
2. Make the smallest structural edit that satisfies the request.
3. Re-parse; verify unit counts, offsets, directive positions, and order.
4. Format/round-trip the AST when preserving source structure matters.
5. Export only after validation. Available outputs are MIDI, MusicXML 4.0, LilyPond, ABC, and portable 16-bit stereo WAV.

## Export expectations

MIDI is a Standard MIDI File Type 1 with separate instrument tracks. MusicXML is suitable for notation applications. LilyPond is source for engraving/PDF. ABC is useful for web rendering. WAV is a deterministic dependency-free preview renderer; it is not intended to replace a high-quality SoundFont or CoreAudio synthesizer.

## Safety checks

Do not discard unknown paragraphs or metadata. Do not silently change key, tempo, meter, offsets, or execution order. If input is malformed, report the offending location and ask for clarification rather than guessing.\n`;
  static defaultInstallPaths(): string[] { return [".codex", ".gemini", ".gemini/config", ".claude", ".agent", ".agents"].map(root => path.join(os.homedir(), root, "skills", "tmd")); }
  static installSkills(paths = this.defaultInstallPaths()): { path: string; installed: boolean; error?: string }[] { return paths.map(p => { try { fs.mkdirSync(p, { recursive: true }); fs.writeFileSync(path.join(p, "SKILL.md"), this.skillMarkdown); return { path: p, installed: true }; } catch (e) { return { path: p, installed: false, error: String(e) }; } }); }
}
