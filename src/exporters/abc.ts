import { Note, Paragraph, PitchMapping, PlaybackDirectiveEvent, PlaybackEvent, Sheet, TMDPlaybackRenderer } from "../core";

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
    const timeline = TMDPlaybackRenderer.render(sheet, instrument);
    let result = "";
    let dirIdx = 0;

    for (const event of timeline.events) {
      while (dirIdx < timeline.directives.length && timeline.directives[dirIdx].position <= event.position) {
        result += TMDABCGenerator.formatDirective(timeline.directives[dirIdx]);
        dirIdx++;
      }
      result += TMDABCGenerator.formatPlaybackEvent(event);
      result += " ";
    }

    while (dirIdx < timeline.directives.length) {
      result += TMDABCGenerator.formatDirective(timeline.directives[dirIdx]);
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
        return `Q:1/4=${Math.round(directive.state.tempo)} `;
      case "timeSignature":
        return `M:${k.beat.count}/${k.beat.noteValue} `;
      case "absoluteKey":
        return `K:${TMDABCGenerator.abcKey(k.key)} `;
      case "relativeKey":
        return "% TMD relative key modulation ";
    }
  }

  private static formatPlaybackEvent(event: PlaybackEvent): string {
    const multiplier = Math.round(event.duration * 4);
    const suffix = multiplier > 1 ? String(multiplier) : "";

    switch (event.content.type) {
      case "note":
        return `${TMDABCGenerator.noteToABCPitch(event.content.note, event.state.keyOffset)}${suffix}`;
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
        return pitches.map((p) => `${p}${suffix}`).join(" ");
      }
    }
  }

  private static noteToABCPitch(note: Note, keyOffset: number): string {
    let midiPitch = 60 + keyOffset + (note.degree === 1 ? 0 : [0, 2, 4, 5, 7, 9, 11][note.degree - 1]);
    if (note.accidental === "sharp") midiPitch += 1;
    else if (note.accidental === "flat") midiPitch -= 1;
    midiPitch += note.octave * 12;

    return TMDABCGenerator.midiPitchToABC(midiPitch);
  }

  private static midiPitchToABC(pitch: number): string {
    const semitone = ((pitch % 12) + 12) % 12;
    const octave = Math.floor(pitch / 12) - 1;

    if (octave >= 5) {
      const base = PitchMapping.abcLowerNames[semitone];
      const apostrophes = "'".repeat(octave - 5);
      return `${base}${apostrophes}`;
    } else if (octave === 4) {
      return PitchMapping.abcLowerNames[semitone];
    } else if (octave === 3) {
      return PitchMapping.abcUpperNames[semitone];
    } else {
      const base = PitchMapping.abcUpperNames[semitone];
      const commas = ",".repeat(Math.max(0, 3 - octave));
      return `${base}${commas}`;
    }
  }

  private static abcKey(key: string): string {
    const trimmed = key.trim();
    if (!trimmed.length) return "C";
    let pitch = trimmed[0].toUpperCase();
    if (trimmed.includes("'") || trimmed.includes("#")) {
      pitch += "#";
    } else if (trimmed.includes(",") || trimmed.includes("b")) {
      pitch += "b";
    }
    return pitch;
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
