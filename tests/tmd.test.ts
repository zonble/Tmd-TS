import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';
import {
  TmdParser,
  formatSheet,
  formatSummary,
  TMDPlaybackRenderer,
  TMDABCGenerator,
  TMDLilyPondGenerator,
  TMDMusicXMLGenerator,
  TMDMIDIGenerator,
  TMDWAVRenderer,
  FilePathNormalizer,
  TextEncodingDetector,
  TmdSkill,
  TMD_VERSION,
} from '../src/index.js';
import { Lexer } from '../src/core/parser.js';

const sampleTMD = `
::SCORE::
/* Comment block */
** Sample Song **
!= 120
?= C
<4/4>

verse:Piano@|0|{
    <4*>
    1 2 3 1
    1 2 3 1
    3 4 5 -
    3 4 5 -
}

verse:Guitar@|0|{
    <4*>
    [C] . . .
    [C] . . .
    [C] . [G] .
    [C] . [G] .
}

chorus:Piano@|0|{
    <4*>
    5 6 5 4
    3 1 2 -
}

chorus:Guitar@|0|{
    <4*>
    [G] . [F] .
    [C] . [G] .
}

-> verse -> chorus ->#
`;

describe('TmdParser and Format', () => {
  it('parses header correctly', () => {
    const sheet = TmdParser.parse(sampleTMD);
    expect(sheet.name).toBe('Sample Song');
    expect(sheet.speed).toBe(120);
    expect(sheet.keySignature.toString()).toBe('C');
    expect(sheet.beat.count).toBe(4);
    expect(sheet.beat.noteValue).toBe(4);
    expect(sheet.paragraphs.length).toBe(4);
    expect(sheet.paragraphs[0].line).toBe(9);
    expect(sheet.paragraphs[1].line).toBe(17);
    expect(sheet.paragraphs[2].line).toBe(25);
    expect(sheet.paragraphs[3].line).toBe(31);
    expect(sheet.orders).toEqual([
      { type: 'name', name: 'verse' },
      { type: 'name', name: 'chorus' }
    ]);
  });

  it('formats sheet back to string without loss of structure', () => {
    const sheet = TmdParser.parse(sampleTMD);
    const formatted = formatSheet(sheet);
    expect(formatted).toContain('::SCORE::');
    expect(formatted).toContain('** Sample Song **');
    expect(formatted).toContain('-> verse -> chorus ->#');
    const reParsed = TmdParser.parse(formatted);
    expect(reParsed.name).toBe(sheet.name);
    expect(reParsed.paragraphs.length).toBe(sheet.paragraphs.length);
  });

  it('generates summary', () => {
    const sheet = TmdParser.parse(sampleTMD);
    const summary = formatSummary(sheet);
    expect(summary).toContain('Name:         Sample Song');
    expect(summary).toContain('KeySignature: C');
    expect(summary).toContain('Paragraphs:   4');
  });
});

describe('TMDPlaybackRenderer', () => {
  it('renders playback events with timeline offsets', () => {
    const sheet = TmdParser.parse(sampleTMD);
    const timeline = TMDPlaybackRenderer.render(sheet, 'Piano');
    expect(timeline.events.length).toBeGreaterThan(0);
    expect(timeline.duration).toBeGreaterThan(0);
  });
});

describe('Exporters', () => {
  it('generates valid ABC notation', () => {
    const sheet = TmdParser.parse(sampleTMD);
    const abc = TMDABCGenerator.generateABC(sheet);
    expect(abc).toContain('X:1');
    expect(abc).toContain('T:Sample Song');
    expect(abc).toContain('M:4/4');
    expect(abc).toContain('K:C');
    expect(abc).toContain('V:V1');
  });

  it('generates valid LilyPond score', () => {
    const sheet = TmdParser.parse(sampleTMD);
    const ly = TMDLilyPondGenerator.generateLilyPond(sheet);
    expect(ly).toContain('\\version "2.24.0"');
    expect(ly).toContain('title = "Sample Song"');
    expect(ly).toContain('\\time 4/4');
  });

  it('generates valid MusicXML', () => {
    const sheet = TmdParser.parse(sampleTMD);
    const xml = TMDMusicXMLGenerator.generateMusicXML(sheet);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<score-partwise version="4.0">');
    expect(xml).toContain('<work-title>Sample Song</work-title>');
    expect(xml).toContain('</score-partwise>');
  });

  it('generates valid Standard MIDI binary data', () => {
    const sheet = TmdParser.parse(sampleTMD);
    const midiBytes = TMDMIDIGenerator.generateMIDI(sheet);
    expect(midiBytes.length).toBeGreaterThan(0);
    // MIDI magic header 'MThd'
    expect(midiBytes[0]).toBe(0x4d);
    expect(midiBytes[1]).toBe(0x54);
    expect(midiBytes[2]).toBe(0x68);
    expect(midiBytes[3]).toBe(0x64);
  });
});

describe('Input utilities and platform features', () => {
  it('normalizes file URLs and editor locations', () => {
    expect(FilePathNormalizer.isFileURL('file:///tmp/a%20b.tmd')).toBe(true);
    expect(FilePathNormalizer.fileURLToPath('file:///tmp/a%20b.tmd')).toBe(normalize('/tmp/a b.tmd'));
    expect(FilePathNormalizer.parseLocation('song.tmd:42:7')).toEqual({ filePath: 'song.tmd', line: 42, column: 7 });
    expect(FilePathNormalizer.parseLocation('song.tmd#L42C7')).toEqual({ filePath: 'song.tmd', line: 42, column: 7 });
  });

  it('decodes UTF-8 and UTF-16 input', () => {
    const utf8 = TextEncodingDetector.detectAndDecode(new TextEncoder().encode('測試'));
    expect(utf8).toEqual({ content: '測試', encoding: 'UTF-8' });
    const utf16 = new Uint8Array([0xff, 0xfe, 0x2c, 0x6e, 0x66, 0x8a]);
    expect(TextEncodingDetector.detectAndDecode(utf16)?.content).toBe('測試');
    expect(TextEncodingDetector.detectAndDecode(new Uint8Array([0xb4, 0xfa, 0xb8, 0xd5]))?.content).toBe('測試');
  });

  it('parses data and files, and reports token ranges', () => {
    const input = '::SCORE::\n** File **\n->#';
    expect(TmdParser.parseData(new TextEncoder().encode(input)).name).toBe('File');
    const dir = mkdtempSync(join(tmpdir(), 'tmd-ts-'));
    const file = join(dir, 'score.tmd');
    writeFileSync(file, input);
    expect(TmdParser.parseFile(file).name).toBe('File');
    expect(new Lexer(input).tokenizeWithRanges()[0].range.start.line).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('renders a valid WAV and installs the skill to a custom directory', () => {
    const sheet = TmdParser.parse(sampleTMD);
    const wav = TMDWAVRenderer.renderWAV(sheet, 8000);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE');
    const dir = mkdtempSync(join(tmpdir(), 'tmd-skill-'));
    expect(TmdSkill.installSkills([dir])[0].installed).toBe(true);
    expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toContain('# TMD');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('TMD language edge cases', () => {
  it('parses directives, tuplets, percussion, program text, and arrangement modifiers', () => {
    const source = `::SCORE::\n** Edge **\n!= 100\n?= F'\n<6/8>\n~ "詞：測試"\npart:Drum@|-1|{\n<8*>\n{!=140} XxTS (1' 2, 3^)%(--) {!+10} {?+2} [Dm7-5] -\n}\nscript:Program@1{\n"""echo hi\n"""\n}\n-> part -> {?+2} -> {?=G} ->#`;
    const sheet = TmdParser.parse(source);
    expect(sheet.keySignature.toString()).toBe("F'");
    expect(sheet.beat).toEqual({ count: 6, noteValue: 8 });
    expect(sheet.metadata.lyrics).toBe('詞：測試');
    expect(sheet.paragraphs[0].start).toBe(-1);
    expect(sheet.paragraphs[0].sections[0].directives.length).toBe(3);
    expect(sheet.paragraphs[0].sections[0].unitGroups.some(group => group.units[0].type === 'percussion')).toBe(true);
    expect(sheet.paragraphs[1].showProgram).toContain('echo hi');
    expect(sheet.orders).toEqual([{ type: 'name', name: 'part' }, { type: 'relative', value: '+2' }, { type: 'absolute', value: 'G' }]);
  });

  it('rejects malformed input with a useful error', () => {
    expect(() => TmdParser.parse('not a score')).toThrow(/Missing ::SCORE::/);
    expect(() => TmdParser.parse('::SCORE::\npart')).toThrow();
  });

  it('tracks tempo/key/time changes in playback state', () => {
    const sheet = TmdParser.parse(`::SCORE::\n** Changes **\n!=100\n?=C\n<4/4>\npart:Piano@|0|{\n<4*>\n1 {!+20} 2 {?+2} 3 {<3/4>} 4\n}\n-> part ->#`);
    const timeline = TMDPlaybackRenderer.render(sheet, 'Piano');
    expect(timeline.events).toHaveLength(4);
    expect(timeline.events[1].state.tempo).toBe(120);
    expect(timeline.events[2].state.keyOffset).toBe(2);
    expect(timeline.events[3].state.timeSignature).toEqual({ count: 3, noteValue: 4 });
    expect(timeline.duration).toBeGreaterThan(0);
  });
});
