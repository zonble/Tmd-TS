import {
  Sheet,
  Order,
  TMDMeasureRenderer,
} from '../core/index.js';

export interface ChordProOptions {
  measuresPerLine?: number;
}

export class TMDChordProGenerator {
  public static generateChordPro(
    sheet: Sheet,
    options: ChordProOptions = {}
  ): string {
    const lines: string[] = [];

    // Title and Metadata directives
    if (sheet.name) {
      lines.push(`{title: ${sheet.name}}`);
    }
    if (sheet.metadata) {
      if (sheet.metadata['subtitle']) lines.push(`{subtitle: ${sheet.metadata['subtitle']}}`);
      if (sheet.metadata['artist']) lines.push(`{artist: ${sheet.metadata['artist']}}`);
      if (sheet.metadata['composer']) {
        const comp = sheet.metadata['composer'].replace(/^曲[：:]\s*/, '');
        lines.push(`{composer: ${comp}}`);
      }
      if (sheet.metadata['lyricist'] || sheet.metadata['lyrics']) {
        const lyr = (sheet.metadata['lyricist'] || sheet.metadata['lyrics']).replace(/^詞[：:]\s*/, '');
        lines.push(`{lyricist: ${lyr}}`);
      }
      if (sheet.metadata['arranger']) {
        const arr = sheet.metadata['arranger'].replace(/^編[：:]\s*/, '');
        lines.push(`{arranger: ${arr}}`);
      }
    }

    if (sheet.keySignature) {
      lines.push(`{key: ${sheet.keySignature.toString()}}`);
    }
    if (sheet.beat && sheet.beat.count > 0 && sheet.beat.noteValue > 0) {
      lines.push(`{time: ${sheet.beat.count}/${sheet.beat.noteValue}}`);
    }
    if (sheet.speed > 0) {
      lines.push(`{tempo: ${Math.round(sheet.speed)}}`);
    }

    // Determine target track: pick guitar/chords instrument or first instrument
    const distinctInstruments = Array.from(
      new Set(sheet.paragraphs.map((p) => p.instrument))
    ).sort();

    const targetInstrument =
      distinctInstruments.find((inst) =>
        /guitar|chord|lead|piano/i.test(inst)
      ) ||
      distinctInstruments[0] ||
      'Piano';

    // Group sections by order
    const orders: Order[] =
      sheet.orders.length > 0
        ? sheet.orders
        : Array.from(new Set(sheet.paragraphs.map((p) => p.name))).map((n) => ({
            type: 'name' as const,
            name: n,
          }));

    const measuresPerLine = options.measuresPerLine ?? 4;

    for (const order of orders) {
      if (order.type === 'name') {
        const pName = order.name;
        // Create a sub-sheet with just this section to isolate its measures
        const sectionSheet: Sheet = {
          ...sheet,
          paragraphs: sheet.paragraphs.filter((p) => p.name === pName),
          orders: [{ type: 'name', name: pName }],
        };

        const sectionMeasures = TMDMeasureRenderer.renderMeasures(
          sectionSheet,
          targetInstrument
        );

        if (sectionMeasures.length === 0) continue;

        lines.push('');
        lines.push(`{comment: ${pName}}`);

        const measureStrings: string[] = [];

        for (const m of sectionMeasures) {
          const chordsInMeasure: string[] = [];
          for (const ev of m.events) {
            if (ev.content.type === 'chord') {
              chordsInMeasure.push(`[${ev.content.chord.toString()}]`);
            }
          }

          if (chordsInMeasure.length > 0) {
            measureStrings.push(chordsInMeasure.join(' '));
          } else {
            measureStrings.push('');
          }
        }

        // Format into lines of measuresPerLine: | [C] | [F] |
        for (let i = 0; i < measureStrings.length; i += measuresPerLine) {
          const chunk = measureStrings.slice(i, i + measuresPerLine);
          const chunkFormatted = chunk.map((c) => (c ? ` [${c.slice(1, -1)}] ` : ' ')).join('|');
          // More cleanly: chunk.map(c => c ? ` ${c} ` : ' ').join('|')
          const body = chunk.map((c) => (c ? ` ${c} ` : ' ')).join('|');
          lines.push(`|${body}|`);
        }
      }
    }

    return lines.join('\n') + '\n';
  }
}
