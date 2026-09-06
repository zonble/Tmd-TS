import {
  Sheet,
  Note,
  Accidental,
  ChordSymbol,
  chordQualityIntervals,
  Beat,
  PlaybackTimeline,
  TMDPlaybackRenderer,
} from '../core/index.js';

export enum MIDIInstrument {
  Piano = 'piano',
  ElectricPiano = 'electricPiano',
  Organ = 'organ',
  Guitar = 'guitar',
  DistortionGuitar = 'distortionGuitar',
  OverdriveGuitar = 'overdriveGuitar',
  CleanGuitar = 'cleanGuitar',
  NylonGuitar = 'nylonGuitar',
  Bass = 'bass',
  Strings = 'strings',
  Violin = 'violin',
  Cello = 'cello',
  Choir = 'choir',
  Trumpet = 'trumpet',
  Brass = 'brass',
  Sax = 'sax',
  Flute = 'flute',
  Pad = 'pad',
  Percussion = 'percussion',
  Unknown = 'unknown',
}

export namespace MIDIInstrument {
  export function resolve(name: string): MIDIInstrument {
    const lower = name.toLowerCase();
    const aliases: [MIDIInstrument, string[]][] = [
      [MIDIInstrument.Percussion, ['drum', 'groove', 'percussion']],
      [MIDIInstrument.DistortionGuitar, ['distortion', 'dist', 'fuzz', 'heavy', 'metal']],
      [MIDIInstrument.OverdriveGuitar, ['overdrive', 'od', 'rockguitar', 'electricguitar', 'electric-guitar']],
      [MIDIInstrument.CleanGuitar, ['cleanguitar', 'electricclean']],
      [MIDIInstrument.Flute, ['flute', 'pipe', 'whistle']],
      [MIDIInstrument.Violin, ['violin', 'fiddle']],
      [MIDIInstrument.Cello, ['cello']],
      [MIDIInstrument.Trumpet, ['trumpet', 'cornet']],
      [MIDIInstrument.Brass, ['brass', 'horn', 'trombone', 'tuba']],
      [MIDIInstrument.Sax, ['sax', 'saxophone']],
      [MIDIInstrument.Organ, ['organ', 'b3']],
      [MIDIInstrument.ElectricPiano, ['ep', 'electricpiano', 'rhodes', 'wurlitzer']],
      [MIDIInstrument.NylonGuitar, ['nylon', 'acousticguitar']],
      [MIDIInstrument.Guitar, ['guitar']],
      [MIDIInstrument.Bass, ['bass']],
      [MIDIInstrument.Strings, ['string', 'strings']],
      [MIDIInstrument.Choir, ['choir', 'chorus', 'vocal', 'voice']],
      [MIDIInstrument.Pad, ['pad', 'warm']],
      [MIDIInstrument.Piano, ['piano', 'keyboard']],
    ];

    for (const [inst, terms] of aliases) {
      if (terms.some(t => lower.includes(t))) {
        return inst;
      }
    }
    return MIDIInstrument.Unknown;
  }

  export function program(instrument: MIDIInstrument): number {
    switch (instrument) {
      case MIDIInstrument.Piano:
      case MIDIInstrument.Unknown:
        return 0;
      case MIDIInstrument.ElectricPiano:
        return 4;
      case MIDIInstrument.Organ:
        return 16;
      case MIDIInstrument.NylonGuitar:
        return 24;
      case MIDIInstrument.Guitar:
        return 25;
      case MIDIInstrument.CleanGuitar:
        return 27;
      case MIDIInstrument.OverdriveGuitar:
        return 29;
      case MIDIInstrument.DistortionGuitar:
        return 30;
      case MIDIInstrument.Bass:
        return 33;
      case MIDIInstrument.Violin:
        return 40;
      case MIDIInstrument.Cello:
        return 42;
      case MIDIInstrument.Strings:
        return 48;
      case MIDIInstrument.Choir:
        return 52;
      case MIDIInstrument.Trumpet:
        return 56;
      case MIDIInstrument.Brass:
        return 61;
      case MIDIInstrument.Sax:
        return 65;
      case MIDIInstrument.Flute:
        return 73;
      case MIDIInstrument.Pad:
        return 89;
      case MIDIInstrument.Percussion:
        return 0;
    }
  }

  export function isPercussion(instrument: MIDIInstrument): boolean {
    return instrument === MIDIInstrument.Percussion;
  }
}

export type MIDIMessage =
  | { type: 'trackName'; name: string }
  | { type: 'tempo'; bpm: number }
  | { type: 'timeSignature'; beat: Beat }
  | { type: 'endOfTrack' }
  | { type: 'noteOn'; channel: number; note: number; velocity: number }
  | { type: 'noteOff'; channel: number; note: number }
  | { type: 'programChange'; channel: number; program: number }
  | { type: 'controlChange'; channel: number; controller: number; value: number };

export interface MIDIEvent {
  tick: number;
  message: MIDIMessage;
}

export class TMDMIDIEncoder {
  public static encodeFile(tracks: Uint8Array[], ticksPerQuarter: number): Uint8Array {
    const headerChunks: number[] = [
      0x4d, 0x54, 0x68, 0x64, // 'MThd'
      0x00, 0x00, 0x00, 0x06, // length 6
      0x00, 0x01,             // format 1
      (tracks.length >> 8) & 0xff, tracks.length & 0xff, // tracks count
      (ticksPerQuarter >> 8) & 0xff, ticksPerQuarter & 0xff // ticks per quarter note
    ];

    const chunks: Uint8Array[] = [new Uint8Array(headerChunks)];
    for (const track of tracks) {
      const trackHeader = new Uint8Array([
        0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
        (track.length >>> 24) & 0xff,
        (track.length >>> 16) & 0xff,
        (track.length >>> 8) & 0xff,
        track.length & 0xff,
      ]);
      chunks.push(trackHeader);
      chunks.push(track);
    }

    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  }

  public static encodeTrack(events: MIDIEvent[]): Uint8Array {
    const sorted = [...events].sort((a, b) => a.tick - b.tick);
    const lastTick = sorted.length > 0 ? sorted[sorted.length - 1].tick : 0;
    sorted.push({ tick: lastTick, message: { type: 'endOfTrack' } });

    const bytes: number[] = [];
    let currentLastTick = 0;

    for (const event of sorted) {
      const delta = event.tick >= currentLastTick ? event.tick - currentLastTick : 0;
      bytes.push(...this.variableLengthQuantity(delta));
      bytes.push(...this.encodeMessage(event.message));
      currentLastTick = event.tick;
    }

    return new Uint8Array(bytes);
  }

  private static encodeMessage(message: MIDIMessage): number[] {
    switch (message.type) {
      case 'trackName': {
        const encoder = new TextEncoder();
        const data = Array.from(encoder.encode(message.name));
        return this.metaEvent(0x03, data);
      }
      case 'tempo': {
        const mpqn = Math.min(0xffffffff, Math.max(0, Math.round(60_000_000.0 / Math.max(1, message.bpm))));
        const data = [(mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff];
        return this.metaEvent(0x51, data);
      }
      case 'timeSignature': {
        const denom = Math.round(Math.log2(Math.max(1, message.beat.noteValue)));
        return this.metaEvent(0x58, [
          Math.min(255, Math.max(1, message.beat.count)),
          denom & 0xff,
          24,
          8,
        ]);
      }
      case 'endOfTrack':
        return this.metaEvent(0x2f, []);
      case 'noteOn':
        return [(0x90 | (message.channel & 0x0f)) & 0xff, message.note & 0x7f, message.velocity & 0x7f];
      case 'noteOff':
        return [(0x80 | (message.channel & 0x0f)) & 0xff, message.note & 0x7f, 0];
      case 'programChange':
        return [(0xc0 | (message.channel & 0x0f)) & 0xff, message.program & 0x7f];
      case 'controlChange':
        return [
          (0xb0 | (message.channel & 0x0f)) & 0xff,
          message.controller & 0x7f,
          message.value & 0x7f,
        ];
    }
  }

  private static metaEvent(type: number, data: number[]): number[] {
    return [0xff, type & 0xff, ...this.variableLengthQuantity(data.length), ...data];
  }

  private static variableLengthQuantity(val: number): number[] {
    let value = Math.max(0, Math.floor(val));
    const buffer: number[] = [value & 0x7f];
    value = Math.floor(value / 128);
    while (value > 0) {
      buffer.push((value & 0x7f) | 0x80);
      value = Math.floor(value / 128);
    }
    return buffer.reverse();
  }
}

export class TMDMIDIGenerator {
  public static readonly defaultTicksPerQuarterNote = 480;

  public static generateMIDI(
    sheet: Sheet,
    ticksPerQuarter: number = TMDMIDIGenerator.defaultTicksPerQuarterNote
  ): Uint8Array {
    const distinctInstruments = Array.from(
      new Set(sheet.paragraphs.map(p => p.instrument))
    ).sort();

    const timelineInstrument =
      sheet.paragraphs.find(p => p.sections.some(s => s.directives.length > 0))
        ?.instrument ??
      distinctInstruments[0] ??
      'Piano';

    const timeline = TMDPlaybackRenderer.render(sheet, timelineInstrument);
    const trackData: Uint8Array[] = [
      TMDMIDIEncoder.encodeTrack(
        this.conductorEvents(sheet, timeline, ticksPerQuarter)
      ),
    ];

    let melodyChannel = 0;
    for (const instrument of distinctInstruments) {
      const midiInst = MIDIInstrument.resolve(instrument);
      let channel: number;
      if (MIDIInstrument.isPercussion(midiInst)) {
        channel = 9;
      } else {
        if (melodyChannel === 9) {
          melodyChannel += 1;
        }
        channel = melodyChannel % 16;
        melodyChannel += 1;
      }

      const instTimeline = TMDPlaybackRenderer.render(sheet, instrument);
      trackData.push(
        TMDMIDIEncoder.encodeTrack(
          this.instrumentEvents(
            instTimeline,
            instrument,
            midiInst,
            channel,
            ticksPerQuarter
          )
        )
      );
    }

    return TMDMIDIEncoder.encodeFile(trackData, ticksPerQuarter);
  }

  private static conductorEvents(
    sheet: Sheet,
    timeline: PlaybackTimeline,
    ticksPerQuarter: number
  ): MIDIEvent[] {
    const initial: MIDIEvent[] = [
      {
        tick: 0,
        message: {
          type: 'trackName',
          name: sheet.name.length > 0 ? sheet.name : 'TMD Score',
        },
      },
      {
        tick: 0,
        message: {
          type: 'tempo',
          bpm: sheet.speed > 0 ? sheet.speed : 120,
        },
      },
      {
        tick: 0,
        message: {
          type: 'timeSignature',
          beat: sheet.beat,
        },
      },
    ];

    const directives: MIDIEvent[] = [];
    for (const directive of timeline.directives) {
      const tick = this.midiTick(directive.position, ticksPerQuarter);
      switch (directive.kind.type) {
        case 'tempo':
        case 'relativeTempo':
          directives.push({
            tick,
            message: { type: 'tempo', bpm: directive.state.tempo },
          });
          break;
        case 'timeSignature':
          directives.push({
            tick,
            message: {
              type: 'timeSignature',
              beat: directive.state.timeSignature,
            },
          });
          break;
        case 'absoluteKey':
        case 'relativeKey':
          break;
      }
    }

    return [...initial, ...directives];
  }

  private static instrumentEvents(
    timeline: PlaybackTimeline,
    instrument: string,
    midiInstrument: MIDIInstrument,
    channel: number,
    ticksPerQuarter: number
  ): MIDIEvent[] {
    const events: MIDIEvent[] = [
      { tick: 0, message: { type: 'trackName', name: instrument } },
    ];

    if (!MIDIInstrument.isPercussion(midiInstrument)) {
      events.push({
        tick: 0,
        message: {
          type: 'programChange',
          channel,
          program: MIDIInstrument.program(midiInstrument),
        },
      });
    }

    const lower = instrument.toLowerCase();
    if (lower.includes('left') || lower.includes('-l')) {
      events.push({
        tick: 0,
        message: {
          type: 'controlChange',
          channel,
          controller: 10,
          value: 20,
        },
      });
    } else if (lower.includes('right') || lower.includes('-r')) {
      events.push({
        tick: 0,
        message: {
          type: 'controlChange',
          channel,
          controller: 10,
          value: 108,
        },
      });
    }

    for (const event of timeline.events) {
      const start = this.midiTick(event.position, ticksPerQuarter);
      const duration = Math.max(1, this.midiTick(event.duration, ticksPerQuarter));

      switch (event.content.type) {
        case 'note': {
          const pitch = this.noteToMIDIPitch(
            event.content.note,
            event.state.keyOffset
          );
          this.appendNote(events, start, duration, channel, pitch, 96);
          break;
        }
        case 'chord': {
          const pitches = this.chordToMIDIPitches(
            event.content.chord,
            event.state.keyOffset
          );
          for (const p of pitches) {
            this.appendNote(events, start, duration, channel, p, 88);
          }
          break;
        }
        case 'percussion': {
          const pattern = event.content.pattern;
          const step = Math.max(1, Math.floor(duration / Math.max(1, pattern.length)));
          for (let index = 0; index < pattern.length; index++) {
            const char = pattern[index];
            const pitch = this.percussionMIDIPitch(char);
            if (pitch !== undefined) {
              let velocity = 78;
              switch (char) {
                case 'D':
                case 'd':
                case 'B':
                case 'b':
                  velocity = 118;
                  break;
                case 'C':
                case 'c':
                  velocity = 115;
                  break;
                case 'S':
                case 's':
                  velocity = 105;
                  break;
                case 'T':
                case 't':
                  velocity = 100;
                  break;
                case 'O':
                case 'o':
                  velocity = 90;
                  break;
                default:
                  velocity = 78;
                  break;
              }
              const noteStart = start + index * step;
              this.appendNote(events, noteStart, step, 9, pitch, velocity);
            }
          }
          break;
        }
        case 'rest':
          break;
      }
    }

    return events;
  }

  private static appendNote(
    events: MIDIEvent[],
    start: number,
    duration: number,
    channel: number,
    pitch: number,
    velocity: number
  ): void {
    if (pitch < 0 || pitch > 127) return;
    events.push({
      tick: start,
      message: {
        type: 'noteOn',
        channel,
        note: pitch,
        velocity,
      },
    });
    const noteOffOffset = duration > 2 ? duration - 2 : 1;
    const noteOffTick = start + noteOffOffset;
    events.push({
      tick: noteOffTick,
      message: {
        type: 'noteOff',
        channel,
        note: pitch,
      },
    });
  }

  private static midiTick(quarterNotes: number, ticksPerQuarter: number): number {
    const ticks = Math.round(quarterNotes * ticksPerQuarter);
    if (!Number.isFinite(ticks)) return 0;
    return Math.max(0, ticks);
  }

  public static noteToMIDIPitch(note: Note, keyOffset: number): number {
    const semitones = [0, 2, 4, 5, 7, 9, 11];
    let pitch = 60 + keyOffset + semitones[note.degree - 1];
    switch (note.accidental) {
      case Accidental.Sharp:
        pitch += 1;
        break;
      case Accidental.Flat:
        pitch -= 1;
        break;
      case Accidental.Natural:
        break;
    }
    pitch += note.octave * 12;
    return pitch;
  }

  private static percussionMIDIPitch(char: string): number | undefined {
    const map: Record<string, number> = {
      D: 36,
      d: 36,
      B: 36,
      b: 36,
      S: 38,
      s: 38,
      X: 42,
      x: 42,
      O: 46,
      o: 46,
      T: 45,
      t: 45,
      C: 49,
      c: 49,
    };
    return map[char];
  }

  public static chordToMIDIPitches(
    chord: string | ChordSymbol,
    keyOffset: number
  ): number[] {
    const symbol =
      typeof chord === 'string' ? ChordSymbol.parse(chord) : chord;
    let rootPitch: number;
    if (symbol.root.isScaleDegree) {
      const note: Note = {
        accidental: symbol.root.accidental,
        degree: symbol.root.degree,
        octave: symbol.root.octave,
      };
      rootPitch = this.noteToMIDIPitch(note, keyOffset) - 12;
    } else {
      rootPitch = 48 + symbol.root.semitoneOffset;
    }
    const intervals = chordQualityIntervals(symbol.quality);
    return intervals.map(i => rootPitch + i);
  }

  public static generalMidiProgram(instrument: string): number {
    return MIDIInstrument.program(MIDIInstrument.resolve(instrument));
  }
}
