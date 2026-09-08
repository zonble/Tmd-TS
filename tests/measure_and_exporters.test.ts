import { describe, it, expect } from 'vitest';
import {
  TmdParser,
  TMDABCGenerator,
  TMDLilyPondGenerator,
  TMDMusicXMLGenerator,
  TMDMeasureRenderer,
  NotationDuration,
} from '../src/index.js';

describe('NotationDuration and Measure Decomposition', () => {
  it('decomposes quarter notes into standard notation duration atoms', () => {
    // 1.0 -> 4th note (baseDenominator: 4, isDotted: false)
    const quarter = NotationDuration.decompose(1.0);
    expect(quarter).toEqual([{ baseDenominator: 4, isDotted: false, quarterValue: 1.0 }]);

    // 1.5 -> dotted quarter (baseDenominator: 4, isDotted: true)
    const dottedQuarter = NotationDuration.decompose(1.5);
    expect(dottedQuarter).toEqual([{ baseDenominator: 4, isDotted: true, quarterValue: 1.5 }]);

    // 1.75 -> dotted quarter + sixteenth (1.5 + 0.25)
    const complex = NotationDuration.decompose(1.75);
    expect(complex).toEqual([
      { baseDenominator: 4, isDotted: true, quarterValue: 1.5 },
      { baseDenominator: 16, isDotted: false, quarterValue: 0.25 },
    ]);
  });

  it('renders strictly bounded measures with gaps padded with rests', () => {
    const tmd = `
::SCORE::
** Measure Invariant Test **
!= 120
?= C
<4/4>

A:Piano@|0|{
    <4*>
    1 2 3 -
    1 - - -
    1 2 3 4
}
-> A ->#
`;
    const sheet = TmdParser.parse(tmd)!;
    expect(sheet).not.toBeNull();

    const measures = TMDMeasureRenderer.renderMeasures(sheet, 'Piano');
    expect(measures.length).toBe(3);

    for (const m of measures) {
      expect(m.nominalDuration).toBe(4.0);
      const totalDur = m.events.reduce((acc, ev) => acc + ev.duration, 0);
      expect(Math.abs(totalDur - 4.0)).toBeLessThan(1e-4);
    }
  });

  it('splits cross-barline notes into measure events with tieStart and tieStop', () => {
    const tmd = `
::SCORE::
** Cross Barline Tie Test **
!= 120
?= C
<4/4>

A:Piano@|0|{
    <4*>
    - - - 1~
    ~1 - - -
}
-> A ->#
`;
    const sheet = TmdParser.parse(tmd)!;
    const measures = TMDMeasureRenderer.renderMeasures(sheet, 'Piano');
    expect(measures.length).toBe(2);

    // Measure 1: 3 beats rest, 1 beat note with tieStart = true
    const m1Last = measures[0].events[measures[0].events.length - 1];
    expect(m1Last.tieStart).toBe(true);
    expect(m1Last.tieStop).toBe(false);

    // Measure 2: 1 beat note with tieStop = true, then rest
    const m2First = measures[1].events[0];
    expect(m2First.tieStop).toBe(true);
  });
});

describe('MusicXML Exporter Invariants', () => {
  it('conserves measure durations and generates proper tie tags', () => {
    const tmd = `
::SCORE::
** MusicXML Measure Test **
!= 120
?= C
<4/4>

A:Piano@|0|{
    <4*>
    1 2 3 4~
    ~4 - - -
}
-> A ->#
`;
    const sheet = TmdParser.parse(tmd)!;
    const xml = TMDMusicXMLGenerator.generateMusicXML(sheet);

    expect(xml).toContain('<score-partwise');
    expect(xml).toContain('<measure number="1">');
    expect(xml).toContain('<measure number="2">');
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<tie type="stop"/>');
    expect(xml).toContain('<tied type="start"/>');
    expect(xml).toContain('<tied type="stop"/>');

    // Divisions = 16 -> 4 beats * 16 = 64 divisions per measure
    const measure1Match = xml.match(/<measure number="1">([\s\S]*?)<\/measure>/);
    expect(measure1Match).not.toBeNull();
    const durations = Array.from(measure1Match![1].matchAll(/<duration>(\d+)<\/duration>/g)).map((m) => parseInt(m[1], 10));
    const totalDivs = durations.reduce((a, b) => a + b, 0);
    expect(totalDivs).toBe(64);
  });
});

describe('LilyPond Exporter Invariants', () => {
  it('generates only valid power-of-2 duration tokens with bar checks', () => {
    const tmd = `
::SCORE::
** LilyPond Invariant Test **
!= 120
?= C
<4/4>

A:Piano@|0|{
    <4*>
    1 2 3 4
    5 6 7 1^
}
-> A ->#
`;
    const sheet = TmdParser.parse(tmd)!;
    const ly = TMDLilyPondGenerator.generateLilyPond(sheet);

    expect(ly).toContain('\\version "2.24.0"');
    const barCount = (ly.match(/\|/g) || []).length;
    expect(barCount).toBeGreaterThanOrEqual(2);

    // Matches note / rest durations e.g. c'4, r4, hh16
    const tokenRegex = /(?:[a-g][a-z',]*|>|r|hh|sn|toml)(\d+)(\.*)/g;
    const validDurations = new Set([1, 2, 4, 8, 16, 32, 64, 128]);
    let match;
    while ((match = tokenRegex.exec(ly)) !== null) {
      const dur = parseInt(match[1], 10);
      expect(validDurations.has(dur)).toBe(true);
    }
  });
});

describe('ABC Exporter Invariants', () => {
  it('generates barlines and conserved measure unit counts', () => {
    const tmd = `
::SCORE::
** ABC Invariant Test **
!= 120
?= C
<4/4>

A:Piano@|0|{
    <4*>
    1 2 3 4
    5 6 7 1^
}
-> A ->#
`;
    const sheet = TmdParser.parse(tmd)!;
    const abc = TMDABCGenerator.generateABC(sheet);

    expect(abc).toContain('M:4/4');
    expect(abc).toContain('L:1/16');

    // Split V1 section
    const v1Section = abc.split('[V:V1]')[1] || '';
    const measures = v1Section
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    expect(measures.length).toBeGreaterThanOrEqual(2);

    const noteRegex = /(?:[A-Ga-gz\^=_]+|"[^"]*"z)(\d*)/g;
    for (const mStr of measures) {
      let totalUnits = 0;
      let m;
      while ((m = noteRegex.exec(mStr)) !== null) {
        const num = m[1] ? parseInt(m[1], 10) : 1;
        totalUnits += num;
      }
      expect(totalUnits).toBe(16);
    }
  });

  it('correctly handles diatonic key signatures and accidentals', () => {
    const tmdG = `
::SCORE::
** Key G Test **
!= 120
?= G
<4/4>

A:Piano@|0|{
    <4*>
    1 7 7, 1
}
-> A ->#
`;
    const sheetG = TmdParser.parse(tmdG)!;
    const abcG = TMDABCGenerator.generateABC(sheetG);

    expect(abcG).toContain('K:G');
    // Degree 7 in G major is F# -> under K:G written as f4 (not ^f4)
    // Degree 7, in G major is F natural -> under K:G written as =f4
    expect(abcG).toMatch(/[Ff]4/);
    expect(abcG).not.toMatch(/\^[Ff]4/);
    expect(abcG).toMatch(/=[Ff]4/);
  });
});
