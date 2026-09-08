import { Note, PitchMapping, PlaybackDirectiveEvent, Sheet, TMDPlaybackRenderer, TMDMeasureRenderer } from "../core";

export class TMDMusicXMLGenerator {
  public static generateMusicXML(sheet: Sheet): string {
    const metaCreators = Object.keys(sheet.metadata)
      .sort()
      .map((key) => {
        const value = sheet.metadata[key];
        const type = key.toLowerCase() === "lyrics" ? "lyricist" : key.toLowerCase() === "arranger" ? "arranger" : "composer";
        return `    <creator type="${type}">${TMDMusicXMLGenerator.escapeXML(value)}</creator>`;
      })
      .join("\n");

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n`;
    xml += `<score-partwise version="4.0">\n`;
    xml += `  <work>\n`;
    xml += `    <work-title>${TMDMusicXMLGenerator.escapeXML(sheet.name || "Untitled Score")}</work-title>\n`;
    xml += `  </work>\n`;
    xml += `  <identification>\n`;
    xml += `    <creator type="composer">TMD</creator>\n`;
    if (metaCreators.length > 0) xml += `${metaCreators}\n`;
    xml += `    <encoding>\n      <software>Tmd-TS MusicXML Exporter</software>\n    </encoding>\n`;
    xml += `  </identification>\n\n`;

    const distinct = Array.from(new Set(sheet.paragraphs.map((p) => p.instrument))).sort();
    const instruments = distinct.length > 0 ? distinct : ["Piano"];

    xml += `  <part-list>\n`;
    instruments.forEach((inst, idx) => {
      const partID = `P${idx + 1}`;
      xml += `    <score-part id="${partID}">\n`;
      xml += `      <part-name>${TMDMusicXMLGenerator.escapeXML(inst)}</part-name>\n`;
      xml += `    </score-part>\n`;
    });
    xml += `  </part-list>\n\n`;

    const divisions = 16;
    instruments.forEach((inst, idx) => {
      const partID = `P${idx + 1}`;
      xml += `  <part id="${partID}">\n`;
      xml += TMDMusicXMLGenerator.generatePartMeasures(inst, sheet, divisions);
      xml += `  </part>\n`;
    });

    xml += `</score-partwise>\n`;
    return xml;
  }

  private static generatePartMeasures(instrument: string, sheet: Sheet, divisions: number): string {
    const measures = TMDMeasureRenderer.renderMeasures(sheet, instrument);
    let xml = "";

    for (const measure of measures) {
      let content = "";
      if (measure.index === 0) {
        content += TMDMusicXMLGenerator.generateAttributesXML(sheet, divisions);
      }
      for (const directive of measure.directives) {
        content += TMDMusicXMLGenerator.generatePlaybackDirectiveXML(directive);
      }

      for (const event of measure.events) {
        const duration = Math.max(1, Math.round(event.duration * divisions));
        switch (event.content.type) {
          case "note":
            content += TMDMusicXMLGenerator.generateNoteXML(
              event.content.note,
              duration,
              event.state.keyOffset,
              event.tieStart,
              event.tieStop
            );
            break;
          case "chord":
            content += TMDMusicXMLGenerator.generateChordXML(event.content.chord.toString(), duration);
            break;
          case "rest":
            content += TMDMusicXMLGenerator.generateRestXML(duration);
            break;
          case "percussion":
            content += TMDMusicXMLGenerator.generatePercussionXML(event.content.pattern, duration);
            break;
        }
      }

      xml += `    <measure number="${measure.index + 1}">\n${content}    </measure>\n\n`;
    }

    return xml;
  }

  private static generateRestXML(duration: number): string {
    return `      <note>\n        <rest/>\n        <duration>${Math.max(1, duration)}</duration>\n      </note>\n`;
  }

  private static generatePlaybackDirectiveXML(directive: PlaybackDirectiveEvent): string {
    switch (directive.kind.type) {
      case "tempo":
      case "relativeTempo":
        return `      <direction placement="above">\n        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${Math.round(directive.state.tempo)}</per-minute></metronome></direction-type>\n        <sound tempo="${directive.state.tempo}"/>\n      </direction>\n`;
      case "timeSignature":
        return `      <attributes><time><beats>${directive.kind.beat.count}</beats><beat-type>${directive.kind.beat.noteValue}</beat-type></time></attributes>\n`;
      case "absoluteKey":
        return `      <attributes><key><fifths>${TMDMusicXMLGenerator.keySignatureToFifths(directive.kind.key)}</fifths></key></attributes>\n`;
      case "relativeKey":
        return `      <!-- TMD relative key modulation -->\n`;
    }
  }

  private static generatePercussionXML(pattern: string, duration: number): string {
    const notes: [string, number][] = [];
    for (const c of pattern) {
      if (c === "X" || c === "x") notes.push(["F", 5]);
      else if (c === "T" || c === "t") notes.push(["A", 4]);
      else if (c === "S" || c === "s") notes.push(["D", 5]);
    }
    if (notes.length === 0) {
      return TMDMusicXMLGenerator.generateRestXML(duration);
    }
    const count = notes.length;
    const base = Math.floor(duration / count);
    const remainder = duration % count;
    let xml = "";
    notes.forEach(([step, octave], i) => {
      const noteDur = base + (i < remainder ? 1 : 0);
      xml += `      <note>\n        <unpitched>\n          <display-step>${step}</display-step>\n          <display-octave>${octave}</display-octave>\n        </unpitched>\n        <duration>${noteDur}</duration>\n      </note>\n`;
    });
    return xml;
  }

  private static generateAttributesXML(sheet: Sheet, divisions: number): string {
    return `      <attributes>\n        <divisions>${divisions}</divisions>\n        <key>\n          <fifths>${TMDMusicXMLGenerator.keySignatureToFifths(sheet.keySignature.toString())}</fifths>\n        </key>\n        <time>\n          <beats>${sheet.beat.count}</beats>\n          <beat-type>${sheet.beat.noteValue}</beat-type>\n        </time>\n        <clef>\n          <sign>G</sign>\n          <line>2</line>\n        </clef>\n      </attributes>\n      <direction placement="above">\n        <direction-type>\n          <metronome>\n            <beat-unit>quarter</beat-unit>\n            <per-minute>${Math.round(sheet.speed > 0 ? sheet.speed : 120)}</per-minute>\n          </metronome>\n        </direction-type>\n        <sound tempo="${Math.round(sheet.speed > 0 ? sheet.speed : 120)}"/>\n      </direction>\n`;
  }

  private static generateNoteXML(
    note: Note,
    duration: number,
    keyOffset: number,
    tieStart = false,
    tieStop = false
  ): string {
    const { step, alter, octave } = TMDMusicXMLGenerator.pitchToStepAlterOctave(note, keyOffset);
    let xml = `      <note>\n        <pitch>\n          <step>${step}</step>\n`;
    if (alter !== 0) {
      xml += `          <alter>${alter}</alter>\n`;
    }
    xml += `          <octave>${octave}</octave>\n        </pitch>\n        <duration>${duration}</duration>\n`;
    if (tieStop) {
      xml += `        <tie type="stop"/>\n`;
    }
    if (tieStart) {
      xml += `        <tie type="start"/>\n`;
    }
    if (tieStart || tieStop) {
      xml += `        <notations>\n`;
      if (tieStop) {
        xml += `          <tied type="stop"/>\n`;
      }
      if (tieStart) {
        xml += `          <tied type="start"/>\n`;
      }
      xml += `        </notations>\n`;
    }
    xml += `      </note>\n`;
    return xml;
  }

  private static generateChordXML(chordName: string, duration: number): string {
    return `      <harmony>\n        <root>\n          <root-step>${TMDMusicXMLGenerator.escapeXML(chordName)}</root-step>\n        </root>\n        <kind text="${TMDMusicXMLGenerator.escapeXML(chordName)}">other</kind>\n      </harmony>\n      <note>\n        <rest/>\n        <duration>${duration}</duration>\n      </note>\n`;
  }

  private static pitchToStepAlterOctave(note: Note, keyOffset: number): { step: string; alter: number; octave: number } {
    let midiPitch = 60 + keyOffset + (note.degree === 1 ? 0 : [0, 2, 4, 5, 7, 9, 11][note.degree - 1]);
    if (note.accidental === "sharp") midiPitch += 1;
    else if (note.accidental === "flat") midiPitch -= 1;
    midiPitch += note.octave * 12;

    const semitone = ((midiPitch % 12) + 12) % 12;
    const step = PitchMapping.musicXMLSteps[semitone];
    const alter = PitchMapping.musicXMLAlters[semitone];
    const octave = Math.floor(midiPitch / 12) - 1;

    return { step, alter, octave };
  }

  private static keySignatureToFifths(key: string): number {
    const trimmed = key.trim().toUpperCase();
    switch (trimmed) {
      case "C": return 0;
      case "G": return 1;
      case "D": return 2;
      case "A": return 3;
      case "E": return 4;
      case "B": return 5;
      case "F#":
      case "F'": return 6;
      case "F": return -1;
      case "BB":
      case "B,": return -2;
      case "EB":
      case "E,": return -3;
      case "AB":
      case "A,":
      case "A'": return 3;
      case "DB":
      case "D,": return -5;
      case "GB":
      case "G,": return -6;
      default: return 0;
    }
  }

  private static escapeXML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
