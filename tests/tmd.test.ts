import { describe, it, expect } from 'vitest';
import {
  TmdParser,
  formatSheet,
  formatSummary,
  TMDPlaybackRenderer,
  TMDABCGenerator,
  TMDLilyPondGenerator,
  TMDMusicXMLGenerator,
  TMDMIDIGenerator,
} from '../src/index.js';

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
