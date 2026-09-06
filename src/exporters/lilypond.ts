import { ChordSymbol, Note, Paragraph, PitchMapping, PlaybackDirectiveEvent, PlaybackEvent, Sheet, TMDPlaybackRenderer, chordQualityIntervals } from "../core";

export class TMDLilyPondGenerator {
  public static generateLilyPond(sheet: Sheet): string {
    const composer = sheet.metadata["composer"] || "TMD";
    let ly = `\\version "2.24.0"\n\n`;
    ly += `\\header {\n`;
    ly += `  title = "${TMDLilyPondGenerator.escapeLilyPond(sheet.name || "Untitled")}"\n`;
    ly += `  composer = "${TMDLilyPondGenerator.escapeLilyPond(composer)}"\n`;
    ly += `  tagline = "Engraved by Tmd-TS LilyPond Exporter"\n`;
    ly += `}\n\n`;

    ly += `\\paper {\n  indent = 1.5\\cm\n  short-indent = 0.5\\cm\n}\n\n`;
    ly += `global = {\n`;
    ly += `  \\time ${sheet.beat.count}/${sheet.beat.noteValue}\n`;
    ly += `  \\tempo 4 = ${Math.round(sheet.speed > 0 ? sheet.speed : 120)}\n`;
    ly += `  \\key ${TMDLilyPondGenerator.lilyPondKey(sheet.keySignature.toString())}\n`;
    ly += `}\n\n`;

    const distinct = Array.from(new Set(sheet.paragraphs.map((p) => p.instrument))).sort();
    const instruments = distinct.length > 0 ? distinct : ["Piano"];

    instruments.forEach((inst, idx) => {
      const varName = TMDLilyPondGenerator.sanitizeIdentifier(inst, idx);
      const isDrum = TMDLilyPondGenerator.paragraphsContainPercussion(sheet.paragraphs, inst);
      ly += `${varName} = ${isDrum ? "\\drummode " : ""}{\n  \\global\n`;
      ly += TMDLilyPondGenerator.generateTrackMusic(inst, sheet, isDrum);
      ly += `}\n\n`;
    });

    ly += `\\score {\n  <<\n`;
    instruments.forEach((inst, idx) => {
      const varName = TMDLilyPondGenerator.sanitizeIdentifier(inst, idx);
      const isDrum = TMDLilyPondGenerator.paragraphsContainPercussion(sheet.paragraphs, inst);
      const staffType = isDrum ? "DrumStaff" : "Staff";
      ly += `    \\new ${staffType} = "${TMDLilyPondGenerator.escapeLilyPond(inst)}" \\with {\n`;
      ly += `      instrumentName = "${TMDLilyPondGenerator.escapeLilyPond(inst)}"\n`;
      ly += `      shortInstrumentName = "${TMDLilyPondGenerator.escapeLilyPond(inst.slice(0, 3))}"\n`;
      ly += `    } {\n      \\${varName}\n    }\n\n`;
    });
    ly += `  >>\n  \\layout { }\n  \\midi { }\n}\n`;

    return ly;
  }

  private static generateTrackMusic(instrument: string, sheet: Sheet, percussion: boolean): string {
    const timeline = TMDPlaybackRenderer.render(sheet, instrument);
    let result = "  ";
    let dirIdx = 0;

    for (const event of timeline.events) {
      while (dirIdx < timeline.directives.length && timeline.directives[dirIdx].position <= event.position) {
        result += TMDLilyPondGenerator.formatDirective(timeline.directives[dirIdx]);
        dirIdx++;
      }
      result += TMDLilyPondGenerator.formatPlaybackEvent(event, percussion);
      result += " ";
    }

    while (dirIdx < timeline.directives.length) {
      result += TMDLilyPondGenerator.formatDirective(timeline.directives[dirIdx]);
      dirIdx++;
    }

    result += "|\n";
    return result;
  }

  private static formatDirective(directive: PlaybackDirectiveEvent): string {
    const k = directive.kind;
    switch (k.type) {
      case "tempo":
      case "relativeTempo":
        return `\\tempo 4 = ${Math.round(directive.state.tempo)} `;
      case "timeSignature":
        return `\\time ${k.beat.count}/${k.beat.noteValue} `;
      case "absoluteKey":
        return `\\key ${TMDLilyPondGenerator.lilyPondKey(k.key)} `;
      case "relativeKey":
        return "% TMD relative key modulation ";
    }
  }

  private static formatPlaybackEvent(event: PlaybackEvent, percussion: boolean): string {
    const duration = TMDLilyPondGenerator.formatQuarterDuration(event.duration);
    switch (event.content.type) {
      case "note":
        return `${TMDLilyPondGenerator.noteToLilyPondPitch(event.content.note, event.state.keyOffset)}${duration}`;
      case "chord": {
        const pitches = TMDLilyPondGenerator.chordToLilyPondPitches(event.content.chord, event.state.keyOffset);
        return `<${pitches.join(" ")}>${duration}`;
      }
      case "rest":
        return `r${duration}`;
      case "percussion": {
        const pattern = event.content.pattern;
        const mapping: Record<string, string> = {
          X: "hh", x: "hh", T: "toml", t: "toml", S: "sn", s: "sn"
        };
        const names = Array.from(pattern).map((c) => mapping[c]).filter(Boolean);
        return names.map((n) => `${n}${duration}`).join(" ");
      }
    }
  }

  private static formatQuarterDuration(quarterNotes: number): string {
    const val = Math.round(4.0 / Math.max(quarterNotes, 0.0001));
    return String(Math.max(1, val));
  }

  private static noteToLilyPondPitch(note: Note, keyOffset: number): string {
    let midiPitch = 60 + keyOffset + (note.degree === 1 ? 0 : [0, 2, 4, 5, 7, 9, 11][note.degree - 1]);
    if (note.accidental === "sharp") midiPitch += 1;
    else if (note.accidental === "flat") midiPitch -= 1;
    midiPitch += note.octave * 12;

    return TMDLilyPondGenerator.midiPitchToLilyPond(midiPitch);
  }

  private static chordToLilyPondPitches(chord: ChordSymbol, keyOffset: number): string[] {
    let root = 0;
    if (chord.root.isScaleDegree) {
      root = 60 + keyOffset + (chord.root.degree === 1 ? 0 : [0, 2, 4, 5, 7, 9, 11][chord.root.degree - 1]);
      if (chord.root.accidental === "sharp") root += 1;
      else if (chord.root.accidental === "flat") root -= 1;
      root += chord.root.octave * 12;
    } else {
      root = 48 + chord.root.semitoneOffset;
    }
    const intervals = chordQualityIntervals(chord.quality);
    return intervals.map((i) => TMDLilyPondGenerator.midiPitchToLilyPond(root + i));
  }

  private static midiPitchToLilyPond(pitch: number): string {
    const semitone = ((pitch % 12) + 12) % 12;
    const octave = Math.floor(pitch / 12) - 1;

    let name = PitchMapping.lilyPondNames[semitone];
    if (octave > 3) {
      name += "'".repeat(octave - 3);
    } else if (octave < 3) {
      name += ",".repeat(3 - octave);
    }
    return name;
  }

  private static lilyPondKey(key: string): string {
    const trimmed = key.trim();
    if (!trimmed.length) return "c \\major";
    let pitch = trimmed[0].toLowerCase();
    if (trimmed.includes("'") || trimmed.includes("#")) {
      pitch += "is";
    } else if (trimmed.includes(",") || trimmed.includes("b")) {
      pitch += "es";
    }
    return `${pitch} \\major`;
  }

  private static sanitizeIdentifier(str: string, idx: number): string {
    const filtered = Array.from(str).filter((c) => /[a-zA-Z]/.test(c)).join("");
    return filtered.length > 0 ? filtered : `track${idx + 1}`;
  }

  private static escapeLilyPond(str: string): string {
    return str.replace(/"/g, '\\"');
  }

  private static paragraphsContainPercussion(paragraphs: Paragraph[], instrument: string): boolean {
    return paragraphs
      .filter((p) => p.instrument === instrument)
      .some((p) =>
        p.sections.some((s) =>
          s.unitGroups.some((g) => g.units.some((u) => u.type === "percussion"))
        )
      );
  }
}
