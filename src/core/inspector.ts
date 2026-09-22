import {
  KeySignature,
  Order,
  Paragraph,
  ScaleDegree,
  scaleDegreeLetter,
  scaleDegreeSemitoneOffset,
  Sheet,
} from "./types.js";
import { SheetInstrumentHelper } from "./instruments.js";
import { TMDPlaybackRenderer, PlaybackState, PlaybackEvent } from "./playback.js";
import { TMDMacroEvaluator } from "./macro.js";

/**
 * Pitch descriptor with MIDI note number, canonical note name (e.g. "C4", "A5"), and source section context.
 */
export interface TMDNotePitchInfo {
  midiPitch: number;
  noteName: string;
  sectionName: string;
  timelinePosition: number;
}

export namespace TMDNotePitchInfo {
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  /**
   * Converts MIDI note number (0~127) to standard note name string (e.g. 60 -> "C4", 69 -> "A4").
   */
  export function name(midiPitch: number): string {
    const octave = Math.floor(midiPitch / 12) - 1;
    const noteIndex = ((midiPitch % 12) + 12) % 12;
    return `${NOTE_NAMES[noteIndex]}${octave}`;
  }
}

export type PitchRangeDifficulty = "easy" | "moderate" | "challenging" | "difficult";

export type VocalClassification = "soprano" | "mezzo-soprano" | "contralto" | "tenor" | "baritone" | "bass";

/**
 * Vocal or instrument pitch range and tessitura summary.
 */
export interface TMDPitchRangeProfile {
  instrument: string;
  lowestNote: TMDNotePitchInfo;
  highestNote: TMDNotePitchInfo;
  spanSemitones: number;
  totalNotes: number;
  averageMidiPitch: number;
  difficulty: PitchRangeDifficulty;
  suitableVoiceTypes: VocalClassification[];
}

/**
 * Timing span descriptor for a section in the song's playback timeline.
 */
export interface TMDSectionTimingProfile {
  name: string;
  orderIndex: number;
  startPositionQuarterNotes: number;
  durationQuarterNotes: number;
  startSeconds: number;
  durationSeconds: number;
  measures: number;
  keyOffset: number;
  tempo: number;
}

/**
 * Song playback timeline timing and duration breakdown.
 */
export interface TMDTimingProfile {
  totalDurationSeconds: number;
  totalMeasures: number;
  sections: TMDSectionTimingProfile[];
}

/**
 * Harmonic content and progression analysis.
 */
export interface TMDHarmonyProfile {
  distinctChords: string[];
  chordCount: number;
  modulations: string[];
}

/**
 * Section arrangement density descriptor.
 */
export interface TMDSectionDensity {
  sectionName: string;
  trackCount: number;
  instruments: string[];
}

/**
 * Arrangement orchestration and concurrent track layering density.
 */
export interface TMDArrangementDensityProfile {
  maxConcurrentTracks: number;
  sectionDensities: TMDSectionDensity[];
}

/**
 * Complete structural, vocal range, harmonic, and temporal profile of a TMD score.
 */
export interface TMDSongProfile {
  title: string;
  initialTempo: number;
  initialKey: string;
  initialTimeSignature: string;
  timing: TMDTimingProfile;
  vocalRange?: TMDPitchRangeProfile;
  instrumentRanges: TMDPitchRangeProfile[];
  harmony: TMDHarmonyProfile;
  density: TMDArrangementDensityProfile;
}

/**
 * Inspector engine extracting holistic musical metrics, vocal tessitura, and arrangement profiles from a TMD Sheet.
 * Ported faithfully from TmdSwift.
 */
export class TMDSongInspector {
  /**
   * Inspects a parsed TMD Sheet and produces an in-depth TMDSongProfile.
   */
  public static inspect(sheet: Sheet, targetInstrument?: string): TMDSongProfile {
    const effectiveSheet = TMDMacroEvaluator.expand(sheet);
    const title = effectiveSheet.name || "Untitled";
    const initialTempo = effectiveSheet.speed && effectiveSheet.speed > 0 ? effectiveSheet.speed : 120.0;
    const initialKey = effectiveSheet.keySignature ? effectiveSheet.keySignature.toString() : "C";
    const initialMeter = effectiveSheet.beat ? `${effectiveSheet.beat.count}/${effectiveSheet.beat.noteValue}` : "4/4";

    // 1. Timing Profile
    const timingProfile = this.buildTimingProfile(effectiveSheet);

    // 2. Instrument Ranges
    const distinctInsts = SheetInstrumentHelper.distinctInstruments(effectiveSheet, false);
    const instrumentRanges: TMDPitchRangeProfile[] = [];
    for (const inst of distinctInsts) {
      const profile = this.buildPitchProfile(inst, effectiveSheet, timingProfile);
      if (profile) {
        instrumentRanges.push(profile);
      }
    }

    // 3. Target Range (picks target instrument or auto resolves)
    const targetInst = targetInstrument && distinctInsts.includes(targetInstrument)
      ? targetInstrument
      : SheetInstrumentHelper.resolveVocalInstrument(effectiveSheet);
    const vocalRange = instrumentRanges.find((r) => r.instrument === targetInst);

    // 4. Harmony & Chord Profile
    const harmonyProfile = this.buildHarmonyProfile(effectiveSheet);

    // 5. Arrangement & Density Profile
    const densityProfile = this.buildDensityProfile(effectiveSheet);

    return {
      title,
      initialTempo,
      initialKey,
      initialTimeSignature: initialMeter,
      timing: timingProfile,
      vocalRange,
      instrumentRanges,
      harmony: harmonyProfile,
      density: densityProfile,
    };
  }

  private static buildTimingProfile(sheet: Sheet): TMDTimingProfile {
    const orders: Order[] =
      sheet.orders.length > 0
        ? sheet.orders
        : Array.from(new Set(sheet.paragraphs.map((p) => p.name))).map((n) => ({
            type: "name",
            name: n,
          }));

    let state: PlaybackState = {
      tempo: sheet.speed && sheet.speed > 0 ? sheet.speed : 120.0,
      keyOffset: sheet.keySignature ? sheet.keySignature.semitoneOffset : 0,
      timeSignature: sheet.beat || { count: 4, noteValue: 4 },
    };

    const sections: TMDSectionTimingProfile[] = [];
    let currentQuarterPosition = 0.0;
    let currentSeconds = 0.0;
    let totalMeasures = 0;

    for (let idx = 0; idx < orders.length; idx++) {
      const order = orders[idx];
      if (order.type === "relative") {
        const delta = parseInt(order.value.replace(/\+/g, ""), 10);
        if (!isNaN(delta)) {
          state = { ...state, keyOffset: state.keyOffset + delta };
        }
      } else if (order.type === "absolute") {
        const offset = KeySignature.parse(order.value).semitoneOffset;
        state = { ...state, keyOffset: offset };
      } else if (order.type === "name") {
        const durQuarterNotes = TMDPlaybackRenderer.durationOf(order.name, sheet);
        const nominalMeasureDur =
          (Math.max(1, state.timeSignature.count) * 4.0) / Math.max(1, state.timeSignature.noteValue);
        const secMeasures = Math.max(1, Math.round(durQuarterNotes / nominalMeasureDur));
        const secDurationSeconds = durQuarterNotes / (state.tempo / 60.0);

        sections.push({
          name: order.name,
          orderIndex: idx,
          startPositionQuarterNotes: currentQuarterPosition,
          durationQuarterNotes: durQuarterNotes,
          startSeconds: currentSeconds,
          durationSeconds: secDurationSeconds,
          measures: secMeasures,
          keyOffset: state.keyOffset,
          tempo: state.tempo,
        });

        currentQuarterPosition += durQuarterNotes;
        currentSeconds += secDurationSeconds;
        totalMeasures += secMeasures;
      }
    }

    return {
      totalDurationSeconds: currentSeconds,
      totalMeasures,
      sections,
    };
  }

  private static buildPitchProfile(
    instrument: string,
    sheet: Sheet,
    timingProfile: TMDTimingProfile
  ): TMDPitchRangeProfile | null {
    const timeline = TMDPlaybackRenderer.render(sheet, instrument);

    interface NoteHit {
      midi: number;
      name: string;
      pos: number;
      sectionName: string;
    }

    const hits: NoteHit[] = [];

    for (const event of timeline.events) {
      if (event.content.type !== "note") continue;
      const note = event.content.note;

      // Note MIDI pitch calculation:
      // 60 (Middle C) + keyOffset + degreeOffset + accidental + octave * 12
      let pitch = 60 + event.state.keyOffset + scaleDegreeSemitoneOffset(note.degree);
      if (note.accidental === "sharp") pitch += 1;
      else if (note.accidental === "flat") pitch -= 1;
      pitch += note.octave * 12;

      const noteName = TMDNotePitchInfo.name(pitch);
      const secProfile = timingProfile.sections.find(
        (s) =>
          event.position >= s.startPositionQuarterNotes &&
          event.position < s.startPositionQuarterNotes + s.durationQuarterNotes + 0.001
      );
      const sectionName = secProfile ? secProfile.name : "";

      hits.push({
        midi: pitch,
        name: noteName,
        pos: event.position,
        sectionName,
      });
    }

    if (hits.length === 0) return null;

    let lowest = hits[0];
    let highest = hits[0];
    let sumPitch = 0;

    for (const hit of hits) {
      if (hit.midi < lowest.midi) lowest = hit;
      if (hit.midi > highest.midi) highest = hit;
      sumPitch += hit.midi;
    }

    const avgPitch = sumPitch / hits.length;
    const spanSemitones = highest.midi - lowest.midi;
    const difficulty = TMDSongInspector.evaluateDifficulty(spanSemitones);
    const suitableVoiceTypes = TMDSongInspector.evaluateSuitableVoiceTypes(lowest.midi, highest.midi);

    return {
      instrument,
      lowestNote: {
        midiPitch: lowest.midi,
        noteName: lowest.name,
        sectionName: lowest.sectionName,
        timelinePosition: lowest.pos,
      },
      highestNote: {
        midiPitch: highest.midi,
        noteName: highest.name,
        sectionName: highest.sectionName,
        timelinePosition: highest.pos,
      },
      spanSemitones,
      totalNotes: hits.length,
      averageMidiPitch: avgPitch,
      difficulty,
      suitableVoiceTypes,
    };
  }

  /**
   * Evaluates pitch span difficulty based on semitones range.
   * <= 12: easy (within an octave)
   * 13 ~ 16: moderate (approx 1 octave to 1 octave + major 3rd)
   * 17 ~ 20: challenging (approx 1.5 octaves)
   * >= 21: difficult (> 1.5 octaves)
   */
  public static evaluateDifficulty(spanSemitones: number): PitchRangeDifficulty {
    if (spanSemitones <= 12) return "easy";
    if (spanSemitones <= 16) return "moderate";
    if (spanSemitones <= 20) return "challenging";
    return "difficult";
  }

  /**
   * Classical standard vocal ranges (with standard amateur/popular margins):
   * Soprano (女高音): C4 (60) - A5/C6 (81/84)
   * Mezzo-Soprano (女中音): A3 (57) - F5/A5 (77/81)
   * Contralto (女低音): F3 (53) - D5/F5 (74/77)
   * Tenor (男高音): C3 (48) - A4/C5 (69/72) (or falsetto up to G5/A5)
   * Baritone (男中音): A2 (45) - F4/G4 (65/67)
   * Bass (男低音): E2 (40) - E4 (64)
   *
   * A voice type is considered suitable if the song's pitch range has substantial overlap
   * or comfortably fits within the standard practical tessitura of that voice type.
   */
  public static evaluateSuitableVoiceTypes(lowestMidi: number, highestMidi: number): VocalClassification[] {
    // Reference standard singing ranges [practicalMin, practicalMax]
    // Considering vocal displacement (octave transpose for male vs female notation when singing pop/choral)
    const voiceRanges: { type: VocalClassification; min: number; max: number }[] = [
      { type: "soprano", min: 57, max: 86 },       // A3 - D6
      { type: "mezzo-soprano", min: 53, max: 81 }, // F3 - A5
      { type: "contralto", min: 50, max: 77 },     // D3 - F5
      { type: "tenor", min: 45, max: 74 },         // A2 - D5
      { type: "baritone", min: 41, max: 69 },      // F2 - A4
      { type: "bass", min: 38, max: 65 },          // D2 - F4
    ];

    const suitable: VocalClassification[] = [];

    // Direct range check
    for (const vr of voiceRanges) {
      if (lowestMidi >= vr.min && highestMidi <= vr.max) {
        suitable.push(vr.type);
      }
    }

    // Also check standard male octave transpose (many vocal melodies written in treble clef C4-C5 are sung an octave lower C3-C4 by male voices)
    const transposedLow = lowestMidi - 12;
    const transposedHigh = highestMidi - 12;
    const maleVoiceTypes: VocalClassification[] = ["tenor", "baritone", "bass"];
    for (const vr of voiceRanges) {
      if (maleVoiceTypes.includes(vr.type) && !suitable.includes(vr.type)) {
        if (transposedLow >= vr.min && transposedHigh <= vr.max) {
          suitable.push(vr.type);
        }
      }
    }

    return suitable;
  }

  private static buildHarmonyProfile(sheet: Sheet): TMDHarmonyProfile {
    const chords: string[] = [];
    for (const p of sheet.paragraphs) {
      for (const sec of p.sections) {
        for (const group of sec.unitGroups) {
          for (const unit of group.units) {
            if (unit.type === "chord") {
              const raw = `[${unit.chord.toString()}]`;
              if (!chords.includes(raw)) {
                chords.push(raw);
              }
            }
          }
        }
      }
    }

    const modulations: string[] = [];
    for (const order of sheet.orders) {
      if (order.type === "relative") {
        modulations.push(`Relative: ${order.value} semitones`);
      } else if (order.type === "absolute") {
        modulations.push(`Key: ${order.value}`);
      }
    }

    return {
      distinctChords: chords,
      chordCount: chords.length,
      modulations,
    };
  }

  private static buildDensityProfile(sheet: Sheet): TMDArrangementDensityProfile {
    const sectionDict: Record<string, string[]> = {};
    for (const p of sheet.paragraphs) {
      if (!sectionDict[p.name]) {
        sectionDict[p.name] = [];
      }
      sectionDict[p.name].push(p.instrument);
    }

    const sectionDensities: TMDSectionDensity[] = [];
    let maxTracks = 0;

    for (const [secName, instList] of Object.entries(sectionDict)) {
      const uniqueInst = Array.from(new Set(instList)).sort();
      if (uniqueInst.length > maxTracks) {
        maxTracks = uniqueInst.length;
      }
      sectionDensities.push({
        sectionName: secName,
        trackCount: uniqueInst.length,
        instruments: uniqueInst,
      });
    }

    sectionDensities.sort((a, b) => a.sectionName.localeCompare(b.sectionName));

    return {
      maxConcurrentTracks: maxTracks,
      sectionDensities,
    };
  }

  /**
   * Generates a human-readable plain text / ASCII inspection report.
   */
  public static generateReport(profile: TMDSongProfile): string {
    const mins = Math.floor(profile.timing.totalDurationSeconds / 60);
    const secs = Math.floor(profile.timing.totalDurationSeconds % 60);
    const timeFormatted = `${mins}:${secs.toString().padStart(2, "0")} (${profile.timing.totalDurationSeconds.toFixed(1)}s)`;

    const lines: string[] = [];
    lines.push("================================================================================");
    lines.push(`📊 TMD Song Profile: [ ${profile.title} ]`);
    lines.push("================================================================================");
    lines.push(`⏱  Duration:       ${timeFormatted}, ${profile.timing.totalMeasures} measures total`);
    lines.push(
      `🎼 Key & Tempo:    ${profile.initialKey} Major, != ${profile.initialTempo} BPM, <${profile.initialTimeSignature}>`
    );

    if (profile.vocalRange) {
      const vocal = profile.vocalRange;
      lines.push(
        `🎤 Vocal Range:    ${vocal.lowestNote.noteName} (MIDI ${vocal.lowestNote.midiPitch}) – ${vocal.highestNote.noteName} (MIDI ${vocal.highestNote.midiPitch}) [Span: ${vocal.spanSemitones} semitones, Difficulty: ${vocal.difficulty}]`
      );
      lines.push(`   - Lowest Note:  ${vocal.lowestNote.noteName} in [${vocal.lowestNote.sectionName}]`);
      lines.push(`   - Highest Note: ${vocal.highestNote.noteName} in [${vocal.highestNote.sectionName}]`);
      if (vocal.suitableVoiceTypes.length > 0) {
        lines.push(`   - Suitable For: ${vocal.suitableVoiceTypes.join(", ")}`);
      }
    }

    lines.push(
      "🏛  Structure:      " +
        profile.timing.sections
          .map((s) => `${s.name} (${s.durationSeconds.toFixed(1)}s)`)
          .join(" -> ")
    );
    lines.push(`⚡ Density:        Peak ${profile.density.maxConcurrentTracks} tracks concurrently`);

    if (profile.harmony.distinctChords.length > 0) {
      lines.push("🎹 Harmony:        " + profile.harmony.distinctChords.join(" "));
    }

    lines.push("--------------------------------------------------------------------------------");
    lines.push("Instrument Track Ranges:");
    for (const inst of profile.instrumentRanges) {
      const padded = inst.instrument.padEnd(14, " ");
      lines.push(
        `  - ${padded}: ${inst.lowestNote.noteName} – ${inst.highestNote.noteName} (${inst.spanSemitones} semitones, ${inst.totalNotes} notes)`
      );
    }
    lines.push("================================================================================");

    return lines.join("\n");
  }
}
