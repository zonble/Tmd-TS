import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  TmdParser,
  TMDMeasureChecker,
  TMDPlaybackRenderer,
} from '../src/index.js';

describe('Canon in D score verification', () => {
  it('has zero measure errors and does not contain artificial chord strumming', () => {
    const filePath = path.resolve(__dirname, '../docs/draft/canon_in_d.tmd');
    const content = fs.readFileSync(filePath, 'utf-8');

    // 1. Measure consistency check must produce 0 issues
    const issues = TMDMeasureChecker.check(content);
    expect(issues).toEqual([]);

    // 2. Parser succeeds
    const sheet = TmdParser.parse(content);
    expect(sheet).not.toBeNull();
    expect(sheet.name).toBe('Canon in D');

    // 3. No CHORD track muddying the baroque contrapuntal texture
    const instruments = Array.from(new Set(sheet.paragraphs.map(p => p.instrument)));
    expect(instruments).not.toContain('CHORD');
    expect(instruments).toContain('Cello');
    expect(instruments).toContain('Violin1');
    expect(instruments).toContain('Violin2');
    expect(instruments).toContain('Violin3');

    // 4. Playback rendering for each voice
    const celloPlayback = TMDPlaybackRenderer.render(sheet, 'Cello');
    const v1Playback = TMDPlaybackRenderer.render(sheet, 'Violin1');
    const v2Playback = TMDPlaybackRenderer.render(sheet, 'Violin2');
    const v3Playback = TMDPlaybackRenderer.render(sheet, 'Violin3');

    // 5. Check canonical offsets: Violin1 at beat 8, Violin2 at beat 16, Violin3 at beat 24
    const v1FirstEvent = v1Playback.events[0];
    const v2FirstEvent = v2Playback.events[0];
    const v3FirstEvent = v3Playback.events[0];

    expect(v1FirstEvent.position).toBe(8);
    expect(v2FirstEvent.position).toBe(16);
    expect(v3FirstEvent.position).toBe(24);

    // 6. Strict Canon Property:
    // Violin2 starting at beat 16 must strictly match Violin1 starting at beat 8 for its duration.
    // Violin3 starting at beat 24 must strictly match Violin1 starting at beat 8 for its duration.
    const v1Notes = v1Playback.events.filter(e => e.content.type === 'note');
    const v2Notes = v2Playback.events.filter(e => e.content.type === 'note');
    const v3Notes = v3Playback.events.filter(e => e.content.type === 'note');

    // At least 24 measures in the score
    expect(v1Notes.length).toBeGreaterThanOrEqual(32);

    // Compare each note in Violin2 against corresponding note in Violin1 offset by +8 beats
    for (const n2 of v2Notes) {
      if (n2.position >= 16 && n2.position < v1Notes[v1Notes.length - 1].position + 8) {
        // find matching note in v1 at position (n2.position - 8)
        const n1 = v1Notes.find(e => Math.abs(e.position - (n2.position - 8)) < 1e-4);
        if (n1 && n1.content.type === 'note' && n2.content.type === 'note') {
          expect(n2.content.note.degree).toBe(n1.content.note.degree);
          expect(n2.content.note.octave).toBe(n1.content.note.octave);
          expect(n2.duration).toBeCloseTo(n1.duration, 4);
        }
      }
    }

    // Compare each note in Violin3 against corresponding note in Violin1 offset by +16 beats
    for (const n3 of v3Notes) {
      if (n3.position >= 24 && n3.position < v1Notes[v1Notes.length - 1].position + 16) {
        const n1 = v1Notes.find(e => Math.abs(e.position - (n3.position - 16)) < 1e-4);
        if (n1 && n1.content.type === 'note' && n3.content.type === 'note') {
          expect(n3.content.note.degree).toBe(n1.content.note.degree);
          expect(n3.content.note.octave).toBe(n1.content.note.octave);
          expect(n3.duration).toBeCloseTo(n1.duration, 4);
        }
      }
    }
  });
});
