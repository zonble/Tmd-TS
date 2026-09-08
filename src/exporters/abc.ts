import {
  Note,
  Paragraph,
  PlaybackDirectiveEvent,
  Sheet,
  TMDMeasureRenderer,
  MeasureEvent,
  KeySignature,
} from "../core";

interface ABCKeyInfo {
  name: string;
  stepAccidentals: number[];
  degreeSteps: number[];
}

export class TMDABCGenerator {
  public static generateABC(sheet: Sheet): string {
    let abc = "";

    abc += "X:1\n";
    abc += `T:${sheet.name ? sheet.name : "Untitled"}\n`;
    abc += `C:${sheet.metadata["composer"] || "TMD (Chen, Chih-Han / aguai)"}\n`;
    abc += `M:${sheet.beat.count}/${sheet.beat.noteValue}\n`;
    abc += "L:1/16\n";
    abc += `Q:1/4=${Math.round(sheet.speed > 0 ? sheet.speed : 120)}\n`;
    abc += `K:${TMDABCGenerator.abcKey(sheet.keySignature.toString())}\n\n`;

    const distinct = Array.from(new Set(sheet.paragraphs.map((p) => p.instrument))).sort();
    const instruments = distinct.length > 0 ? distinct : ["Piano"];

    instruments.forEach((inst, idx) => {
      const vId = `V${idx + 1}`;
      abc += `V:${vId} name="${inst}" snm="${inst.slice(0, 3)}"\n`;
    });
    abc += "\n";

    instruments.forEach((inst, idx) => {
      const vId = `V${idx + 1}`;
      abc += `[V:${vId}]\n`;
      if (TMDABCGenerator.paragraphsContainPercussion(sheet.paragraphs, inst)) {
        abc += "%%MIDI channel 10\n";
      }
      abc += TMDABCGenerator.generateTrackMusic(inst, sheet);
      abc += "\n\n";
    });

    return abc;
  }

  private static generateTrackMusic(instrument: string, sheet: Sheet): string {
    const measures = TMDMeasureRenderer.renderMeasures(sheet, instrument);
    let result = "";

    for (let mIdx = 0; mIdx < measures.length; mIdx++) {
      const measure = measures[mIdx];
      for (const directive of measure.directives) {
        result += TMDABCGenerator.formatDirective(directive);
      }
      for (const event of measure.events) {
        result += TMDABCGenerator.formatMeasureEvent(event);
        result += " ";
      }
      result += "|";
      if ((mIdx + 1) % 4 === 0 && mIdx < measures.length - 1) {
        result += "\n";
      } else {
        result += " ";
      }
    }

    return result.trim() + "\n";
  }

  private static formatDirective(directive: PlaybackDirectiveEvent): string {
    const k = directive.kind;
    switch (k.type) {
      case "tempo":
      case "relativeTempo":
        return `Q:1/4=${Math.round(directive.state.tempo)} `;
      case "timeSignature":
        return `M:${k.beat.count}/${k.beat.noteValue} `;
      case "absoluteKey":
        return `K:${TMDABCGenerator.abcKey(k.key)} `;
      case "relativeKey":
        return "% TMD relative key modulation ";
    }
  }

  private static formatMeasureEvent(event: MeasureEvent): string {
    const multiplier = Math.max(1, Math.round(event.duration * 4));
    const suffix = multiplier > 1 ? String(multiplier) : "";

    switch (event.content.type) {
      case "note": {
        const tie = event.tieStart ? "-" : "";
        return `${TMDABCGenerator.noteToABCPitch(event.content.note, event.state.keyOffset)}${suffix}${tie}`;
      }
      case "chord":
        return `"${event.content.chord.toString()}"z${suffix}`;
      case "rest":
        return `z${suffix}`;
      case "percussion": {
        const pattern = event.content.pattern;
        const mapping: Record<string, string> = {
          X: "^F", x: "^F", T: "A", t: "A", S: "D", s: "D"
        };
        const pitches = Array.from(pattern).map((c) => mapping[c]).filter(Boolean);
        if (pitches.length === 0) return `z${suffix}`;
        const count = pitches.length;
        const base = Math.floor(multiplier / count);
        const remainder = multiplier % count;
        return pitches
          .map((p, i) => {
            const dur = base + (i < remainder ? 1 : 0);
            const s = dur > 1 ? String(dur) : "";
            return `${p}${s}`;
          })
          .join(" ");
      }
    }
  }

  private static keyInfo(keyOffset: number): ABCKeyInfo {
    const normalized = ((keyOffset % 12) + 12) % 12;
    switch (normalized) {
      case 0: // C
        return { name: "C", stepAccidentals: [0, 0, 0, 0, 0, 0, 0], degreeSteps: [0, 1, 2, 3, 4, 5, 6] };
      case 1: // Db
        return { name: "Db", stepAccidentals: [0, -1, -1, 0, -1, -1, -1], degreeSteps: [1, 2, 3, 4, 5, 6, 0] };
      case 2: // D
        return { name: "D", stepAccidentals: [1, 0, 0, 1, 0, 0, 0], degreeSteps: [1, 2, 3, 4, 5, 6, 0] };
      case 3: // Eb
        return { name: "Eb", stepAccidentals: [0, 0, -1, 0, 0, -1, -1], degreeSteps: [2, 3, 4, 5, 6, 0, 1] };
      case 4: // E
        return { name: "E", stepAccidentals: [1, 1, 0, 1, 1, 0, 0], degreeSteps: [2, 3, 4, 5, 6, 0, 1] };
      case 5: // F
        return { name: "F", stepAccidentals: [0, 0, 0, 0, 0, 0, -1], degreeSteps: [3, 4, 5, 6, 0, 1, 2] };
      case 6: // F#
        return { name: "F#", stepAccidentals: [1, 1, 1, 1, 1, 1, 0], degreeSteps: [3, 4, 5, 6, 0, 1, 2] };
      case 7: // G
        return { name: "G", stepAccidentals: [0, 0, 0, 1, 0, 0, 0], degreeSteps: [4, 5, 6, 0, 1, 2, 3] };
      case 8: // Ab
        return { name: "Ab", stepAccidentals: [0, -1, -1, 0, 0, -1, -1], degreeSteps: [5, 6, 0, 1, 2, 3, 4] };
      case 9: // A
        return { name: "A", stepAccidentals: [1, 0, 0, 1, 1, 0, 0], degreeSteps: [5, 6, 0, 1, 2, 3, 4] };
      case 10: // Bb
        return { name: "Bb", stepAccidentals: [0, 0, -1, 0, 0, 0, -1], degreeSteps: [6, 0, 1, 2, 3, 4, 5] };
      case 11: // B
        return { name: "B", stepAccidentals: [1, 1, 0, 1, 1, 1, 0], degreeSteps: [6, 0, 1, 2, 3, 4, 5] };
      default:
        return { name: "C", stepAccidentals: [0, 0, 0, 0, 0, 0, 0], degreeSteps: [0, 1, 2, 3, 4, 5, 6] };
    }
  }

  private static noteToABCPitch(note: Note, keyOffset: number): string {
    const info = TMDABCGenerator.keyInfo(keyOffset);
    const degIdx = Math.max(0, Math.min(6, note.degree - 1));
    const stepIdx = info.degreeSteps[degIdx];
    const keyAcc = info.stepAccidentals[stepIdx];

    let delta = 0;
    if (note.accidental === "sharp") delta = 1;
    else if (note.accidental === "flat") delta = -1;

    const noteAlter = keyAcc + delta;
    let prefix = "";
    if (noteAlter === keyAcc) {
      prefix = "";
    } else if (noteAlter === 0 && keyAcc !== 0) {
      prefix = "=";
    } else if (noteAlter === 1 && keyAcc !== 1) {
      prefix = "^";
    } else if (noteAlter === -1 && keyAcc !== -1) {
      prefix = "_";
    } else if (noteAlter >= 2) {
      prefix = "^^";
    } else if (noteAlter <= -2) {
      prefix = "__";
    }

    const stepUpper = ["C", "D", "E", "F", "G", "A", "B"][stepIdx];
    const stepLower = ["c", "d", "e", "f", "g", "a", "b"][stepIdx];

    const semitones = [0, 2, 4, 5, 7, 9, 11][note.degree - 1];
    const midiPitch = 60 + keyOffset + semitones + delta + note.octave * 12;
    const octave = Math.floor(midiPitch / 12) - 1;

    let letter = "";
    if (octave >= 5) {
      const apostrophes = "'".repeat(octave - 5);
      letter = `${stepLower}${apostrophes}`;
    } else if (octave === 4) {
      letter = stepLower;
    } else if (octave === 3) {
      letter = stepUpper;
    } else {
      const commas = ",".repeat(Math.max(0, 3 - octave));
      letter = `${stepUpper}${commas}`;
    }

    return `${prefix}${letter}`;
  }

  private static abcKey(key: string): string {
    const keySig = KeySignature.parse(key);
    return TMDABCGenerator.keyInfo(keySig.semitoneOffset).name;
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

