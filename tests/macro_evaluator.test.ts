import { describe, it, expect } from 'vitest';
import {
  TmdParser,
  formatOrder,
  formatSheet,
  TMDPlaybackRenderer,
  TMDMeasureChecker,
  TMDMIDIGenerator,
  TMDWAVRenderer,
} from '../src/index.js';

describe('TMD Macro S-Expression & Abstract Paragraphs (TDD - Red Phase)', () => {
  describe('Lexer & Parser AST Integration', () => {
    it('parses abstract paragraphs declared without instrument bindings (Theme { ... })', () => {
      const input = `::SCORE::
** Abstract Prototype **
!= 120
?= C
<4/4>

Theme {
    <4*>
    1 2 3 4
}

-> Theme ->#
`;
      const sheet = TmdParser.parse(input);
      expect(sheet).not.toBeNull();
      expect(sheet.paragraphs.length).toBe(1);
      const p = sheet.paragraphs[0];
      expect(p.name).toBe('Theme');
      expect(p.instrument).toBe(''); // Empty instrument indicates abstract prototype
      expect(p.start).toBe(0);
      expect(p.sections.length).toBe(1);
      expect(p.sections[0].unitGroups.length).toBe(4);
    });

    it('parses S-expressions in playback orders (-> (canon Theme (V1 V2) 2) ->#)', () => {
      const input = `::SCORE::
** S-Expression Order **
!= 120
?= C
<4/4>

Theme:Piano@|0|{
    <4*>
    1 2 3 4
}

-> (canon Theme (Violin1 Violin2) 2) ->#
`;
      const sheet = TmdParser.parse(input);
      expect(sheet).not.toBeNull();
      expect(sheet.orders.length).toBe(1);
      const order = sheet.orders[0];
      expect(order.type).toBe('macro');
      if (order.type === 'macro') {
        expect(order.expr).toEqual([
          'canon',
          'Theme',
          ['Violin1', 'Violin2'],
          2,
        ]);
      }
    });

    it('formats S-expression macro orders back to string', () => {
      const input = `::SCORE::
** Format Macro Test **
!= 120
?= C
<4/4>

Theme {
    <4*>
    1 2 3 4
}

-> (canon Theme (Violin1 Violin2) 2) ->#
`;
      const sheet = TmdParser.parse(input);
      const formattedOrder = formatOrder(sheet.orders[0]);
      expect(formattedOrder).toBe('(canon Theme (Violin1 Violin2) 2)');

      const formatted = formatSheet(sheet);
      expect(formatted).toContain('-> (canon Theme (Violin1 Violin2) 2) ->#');
    });
  });

  describe('TMDMacroEvaluator (Desugaring AST Expansion)', () => {
    it('evaluates (play Theme Violin) by binding abstract theme to instrument', () => {
      const input = `::SCORE::
** Play Combinator **
!= 120
?= C
<4/4>

Theme {
    <4*>
    1 2 3 4
}

-> (play Theme Violin) ->#
`;
      const sheet = TmdParser.parse(input);
      const playback = TMDPlaybackRenderer.render(sheet, 'Violin');
      expect(playback.events.length).toBe(4);
      expect(playback.events[0].position).toBe(0);
      expect(playback.duration).toBe(4);
    });

    it('evaluates (loop Theme Cello 3) by repeating theme sequentially', () => {
      const input = `::SCORE::
** Loop Combinator **
!= 120
?= C
<4/4>

Bass {
    <4*>
    1 5, 6, 3,
}

-> (loop Bass Cello 3) ->#
`;
      const sheet = TmdParser.parse(input);
      const playback = TMDPlaybackRenderer.render(sheet, 'Cello');
      // 4 beats * 3 iterations = 12 events across 12 beats
      expect(playback.events.length).toBe(12);
      expect(playback.duration).toBe(12);
    });

    it('evaluates (canon Theme (Violin1 Violin2 Violin3) 2) with exact staggered entries', () => {
      const input = `::SCORE::
** Canon Combinator **
!= 120
?= D
<4/4>

Theme {
    <4*>
    3^ 2^ 1^ 7 | 6 5 6 7
}

-> (canon Theme (Violin1 Violin2 Violin3) 2) ->#
`;
      const sheet = TmdParser.parse(input);
      const v1 = TMDPlaybackRenderer.render(sheet, 'Violin1');
      const v2 = TMDPlaybackRenderer.render(sheet, 'Violin2');
      const v3 = TMDPlaybackRenderer.render(sheet, 'Violin3');

      expect(v1.events[0].position).toBe(0);
      expect(v2.events[0].position).toBe(8);  // 2 measures * 4 beats
      expect(v3.events[0].position).toBe(16); // 4 measures * 4 beats

      expect(v1.events.length).toBe(8);
      expect(v2.events.length).toBe(8);
      expect(v3.events.length).toBe(8);
    });

    it('evaluates (layer (canon ...) (loop ...)) combining polyphonic canon with ground bass', () => {
      const input = `::SCORE::
** Pachelbel Canon Macro Demo **
!= 56
?= D
<4/4>

Bass {
    <4*>
    1_ 5__ 6__ 3__ | 4__ 1__ 4__ 5__
}

Theme {
    <4*>
    3^ 2^ 1^ 7 | 6 5 6 7 | 1^ 7 6 5 | 4 3 4 2
}

-> (layer
     (canon Theme (Violin1 Violin2 Violin3) 2)
     (loop Bass Cello 4)) ->#
`;
      const sheet = TmdParser.parse(input);

      const cello = TMDPlaybackRenderer.render(sheet, 'Cello');
      const v1 = TMDPlaybackRenderer.render(sheet, 'Violin1');
      const v2 = TMDPlaybackRenderer.render(sheet, 'Violin2');
      const v3 = TMDPlaybackRenderer.render(sheet, 'Violin3');

      // Cello: 4 iterations * 2 measures * 4 beats = 32 beats
      expect(cello.duration).toBe(32);
      expect(cello.events.length).toBe(32);

      // Violin 1 enters at 0, plays 16 beats
      expect(v1.events[0].position).toBe(0);
      expect(v1.events.length).toBe(16);

      // Violin 2 enters at 8, plays 16 beats
      expect(v2.events[0].position).toBe(8);
      expect(v2.events.length).toBe(16);

      // Violin 3 enters at 16, plays 16 beats
      expect(v3.events[0].position).toBe(16);
      expect(v3.events.length).toBe(16);
    });

    it('passes TMDMeasureChecker and exports MIDI / WAV seamlessly', () => {
      const input = `::SCORE::
** Macro Export & Check **
!= 120
?= D
<4/4>

Bass {
    <4*>
    1_ 5__ 6__ 3__ | 4__ 1__ 4__ 5__
}

Theme {
    <4*>
    3^ 2^ 1^ 7 | 6 5 6 7 | 1^ 7 6 5 | 4 3 4 2
}

-> (layer
     (canon Theme (Violin1 Violin2) 2)
     (loop Bass Cello 3)) ->#
`;
      // 1. Measure check passes with 0 issues
      const issues = TMDMeasureChecker.check(input);
      expect(issues).toEqual([]);

      // 2. MIDI generation produces valid bytes without throwing
      const sheet = TmdParser.parse(input);
      const midiBytes = TMDMIDIGenerator.generateMIDI(sheet);
      expect(midiBytes.length).toBeGreaterThan(50);

      // 3. WAV synthesis produces valid RIFF WAV data
      const wavBytes = TMDWAVRenderer.renderWAV(sheet);
      expect(wavBytes.length).toBeGreaterThan(44);
      const header = String.fromCharCode(...wavBytes.slice(0, 4));
      expect(header).toBe('RIFF');
    });

    it('supports multiple sequential themes in canon and loop: (canon (Theme1 Theme2) ...) and (loop (Bass1 Bass2) ...)', () => {
      const input = `::SCORE::
** Multi-Theme Sequential Canon & Loop **
!= 120
?= C
<4/4>

ThemeA {
    <4*>
    1 2 3 4 |
}

ThemeB {
    <4*>
    5 6 7 1^ |
}

BassA {
    <4*>
    1_ 5_ 6_ 3_ |
}

BassB {
    <4*>
    4_ 1_ 4_ 5_ |
}

-> (layer
     (canon (ThemeA ThemeB) (Violin1 Violin2) 2)
     (loop (BassA BassB) Cello 2)) ->#
`;
      const sheet = TmdParser.parse(input);
      expect(sheet).not.toBeNull();

      // TMDPlaybackRenderer verifies the concatenated sections
      const v1 = TMDPlaybackRenderer.render(sheet, 'Violin1');
      const v2 = TMDPlaybackRenderer.render(sheet, 'Violin2');
      const cello = TMDPlaybackRenderer.render(sheet, 'Cello');

      // Each theme is 1 measure = 4 beats. ThemeA + ThemeB = 8 beats total per voice.
      // Violin1 starts at 0, has 8 note events
      expect(v1.events.length).toBe(8);
      expect(v1.events[0].position).toBe(0);
      expect(v1.events[4].position).toBe(4); // ThemeB starts at beat 4

      // Violin2 starts at 2 bars (8 beats), has 8 note events, ends at beat 16
      expect(v2.events[0].position).toBe(8);
      expect(v2.events[4].position).toBe(12);

      // The layer block duration spans the entire layer timeline (16 beats)
      expect(v1.duration).toBe(16);
      expect(v2.duration).toBe(16);

      // Cello loops (BassA + BassB) 2 times: (4 + 4) * 2 = 16 beats
      expect(cello.duration).toBe(16);
      expect(cello.events.length).toBe(16);
    });
  });
});

