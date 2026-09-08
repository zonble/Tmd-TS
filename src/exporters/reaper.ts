import {
  Sheet,
  PlaybackTimeline,
  TMDPlaybackRenderer,
  Order,
  Beat,
} from '../core/index.js';
import {
  MIDIInstrument,
  MIDIEvent,
  TMDMIDIGenerator,
} from './midi.js';

interface TempoSegment {
  quarterStart: number;
  secondStart: number;
  bpm: number;
  timeSignature: Beat;
}

export class TMDReaperGenerator {
  public static readonly defaultPPQ = 960;

  public static generateRPP(
    sheet: Sheet,
    ppq: number = TMDReaperGenerator.defaultPPQ
  ): string {
    const distinctInstruments = Array.from(
      new Set(sheet.paragraphs.map(p => p.instrument))
    ).sort();

    const timelineInstrument =
      sheet.paragraphs.find(p => p.sections.some(s => s.directives.length > 0))
        ?.instrument ??
      distinctInstruments[0] ??
      'Piano';

    const conductorTimeline = TMDPlaybackRenderer.render(sheet, timelineInstrument);

    // Build timeline tempo segments
    const initialBpm = sheet.speed > 0 ? sheet.speed : 120;
    const initialTimeSig = sheet.beat;

    const segments: TempoSegment[] = [
      {
        quarterStart: 0,
        secondStart: 0,
        bpm: initialBpm,
        timeSignature: initialTimeSig,
      },
    ];

    const sortedDirectives = [...conductorTimeline.directives].sort(
      (a, b) => a.position - b.position
    );

    for (const directive of sortedDirectives) {
      if (
        directive.kind.type === 'tempo' ||
        directive.kind.type === 'relativeTempo' ||
        directive.kind.type === 'timeSignature'
      ) {
        const last = segments[segments.length - 1];
        if (directive.position > last.quarterStart) {
          const deltaQuarters = directive.position - last.quarterStart;
          const deltaSeconds = deltaQuarters * (60.0 / last.bpm);
          const secondStart = last.secondStart + deltaSeconds;
          segments.push({
            quarterStart: directive.position,
            secondStart,
            bpm: directive.state.tempo,
            timeSignature: directive.state.timeSignature,
          });
        } else if (directive.position === last.quarterStart) {
          last.bpm = directive.state.tempo;
          last.timeSignature = directive.state.timeSignature;
        }
      }
    }

    const quarterToSeconds = (quarter: number): number => {
      if (quarter <= 0) return 0;
      let seg = segments[0];
      for (let i = segments.length - 1; i >= 0; i--) {
        if (quarter >= segments[i].quarterStart) {
          seg = segments[i];
          break;
        }
      }
      const deltaQuarters = quarter - seg.quarterStart;
      return seg.secondStart + deltaQuarters * (60.0 / seg.bpm);
    };

    // Calculate section markers
    const orders: Order[] = sheet.orders.length > 0
      ? sheet.orders
      : Array.from(new Set(sheet.paragraphs.map((p) => p.name))).map((n) => ({ type: "name" as const, name: n }));

    let currentQuarter = 0.0;
    let markerId = 1;
    const markerLines: string[] = [];

    for (const order of orders) {
      if (order.type === 'name') {
        const paragraphDuration = TMDPlaybackRenderer.durationOf(order.name, sheet);
        const secondPos = quarterToSeconds(currentQuarter);
        markerLines.push(`  MARKER ${markerId} ${secondPos.toFixed(8)} "${order.name}" 0`);
        markerId++;
        currentQuarter += paragraphDuration;
      }
    }

    // Build Tempo Envelope Points (PT)
    const ptLines: string[] = [];
    for (const seg of segments) {
      const timesigEncoded = (seg.timeSignature.noteValue << 16) | seg.timeSignature.count;
      ptLines.push(
        `    PT ${seg.secondStart.toFixed(8)} ${seg.bpm.toFixed(8)} 0 ${timesigEncoded}`
      );
    }

    // Build Tracks
    const trackChunks: string[] = [];
    let melodyChannel = 0;

    for (const instrument of distinctInstruments) {
      const midiInst = MIDIInstrument.resolve(instrument);
      let channel: number;
      if (MIDIInstrument.isPercussion(midiInst)) {
        channel = 9;
      } else {
        if (melodyChannel === 9) melodyChannel += 1;
        channel = melodyChannel % 16;
        melodyChannel += 1;
      }

      // Pan
      let pan = 0.0;
      const lower = instrument.toLowerCase();
      if (lower.includes('left') || lower.includes('-l')) {
        pan = -0.8;
      } else if (lower.includes('right') || lower.includes('-r')) {
        pan = 0.8;
      }

      // Color
      const color = this.getTrackColor(midiInst);

      // Render track events
      const instTimeline = TMDPlaybackRenderer.render(sheet, instrument);
      const events: MIDIEvent[] = TMDMIDIGenerator.instrumentEvents(
        instTimeline,
        instrument,
        midiInst,
        channel,
        ppq
      );

      const totalDurationQuarters = Math.max(instTimeline.duration, currentQuarter);
      const totalTrackSeconds = Math.max(1.0, quarterToSeconds(totalDurationQuarters));

      // Serialize inline MIDI events
      const sortedEvents = [...events].sort((a, b) => a.tick - b.tick);
      let lastTick = 0;
      const eventLines: string[] = [];
      const toHex2 = (n: number) => (n & 0xff).toString(16).padStart(2, '0');

      for (const evt of sortedEvents) {
        const delta = Math.max(0, evt.tick - lastTick);
        lastTick = evt.tick;
        const msg = evt.message;
        switch (msg.type) {
          case 'noteOn': {
            const status = toHex2(0x90 | (msg.channel & 0x0f));
            const data1 = toHex2(msg.note & 0x7f);
            const data2 = toHex2(msg.velocity & 0x7f);
            eventLines.push(`        E ${delta} ${status} ${data1} ${data2}`);
            break;
          }
          case 'noteOff': {
            const status = toHex2(0x80 | (msg.channel & 0x0f));
            const data1 = toHex2(msg.note & 0x7f);
            eventLines.push(`        E ${delta} ${status} ${data1} 00`);
            break;
          }
          case 'programChange': {
            const status = toHex2(0xc0 | (msg.channel & 0x0f));
            const data1 = toHex2(msg.program & 0x7f);
            eventLines.push(`        E ${delta} ${status} ${data1}`);
            break;
          }
          case 'controlChange': {
            const status = toHex2(0xb0 | (msg.channel & 0x0f));
            const data1 = toHex2(msg.controller & 0x7f);
            const data2 = toHex2(msg.value & 0x7f);
            eventLines.push(`        E ${delta} ${status} ${data1} ${data2}`);
            break;
          }
        }
      }

      if (events.length > 0) {
        const status = toHex2(0xb0 | (channel & 0x0f));
        eventLines.push(`        E 0 ${status} 7b 00`);
      }

      const trackChunk = [
        `  <TRACK`,
        `    NAME "${instrument}"`,
        `    PEAKCOL ${color}`,
        `    VOLPAN 1.00000000 ${pan.toFixed(8)} 1 -1 1`,
        `    <ITEM`,
        `      POSITION 0.00000000`,
        `      SNAPOFFS 0.00000000`,
        `      LENGTH ${totalTrackSeconds.toFixed(8)}`,
        `      LOOP 0`,
        `      ALLTAKES 0`,
        `      NAME "${instrument}"`,
        `      <SOURCE MIDI`,
        `        HASDATA 1 ${ppq} QN`,
        ...eventLines,
        `      >`,
        `    >`,
        `  >`,
      ].join('\n');

      trackChunks.push(trackChunk);
    }

    const lines: string[] = [
      `<REAPER_PROJECT 0.1 "7.0" 0 0`,
      `  <TEMPOENVEX`,
      `    ACT 1`,
      `    VIS 1 0 1`,
      `    LANEHEIGHT 0 0`,
      `    ARM 1`,
      `    DEFSHAPE 0 -1 -1`,
      ...ptLines,
      `  >`,
      ...markerLines,
      ...trackChunks,
      `>`,
      ``,
    ];

    return lines.join('\n');
  }

  private static getTrackColor(midiInst: MIDIInstrument): number {
    let r = 120, g = 140, b = 160;
    switch (midiInst) {
      case MIDIInstrument.Percussion:
        r = 230; g = 80; b = 50;
        break;
      case MIDIInstrument.Bass:
        r = 30; g = 130; b = 230;
        break;
      case MIDIInstrument.Guitar:
      case MIDIInstrument.CleanGuitar:
      case MIDIInstrument.NylonGuitar:
      case MIDIInstrument.OverdriveGuitar:
      case MIDIInstrument.DistortionGuitar:
        r = 50; g = 180; b = 80;
        break;
      case MIDIInstrument.Piano:
      case MIDIInstrument.ElectricPiano:
      case MIDIInstrument.Organ:
        r = 150; g = 70; b = 210;
        break;
      case MIDIInstrument.Strings:
      case MIDIInstrument.Violin:
      case MIDIInstrument.Cello:
        r = 230; g = 160; b = 30;
        break;
      case MIDIInstrument.Brass:
      case MIDIInstrument.Trumpet:
        r = 230; g = 200; b = 30;
        break;
      case MIDIInstrument.Flute:
      case MIDIInstrument.Sax:
        r = 30; g = 180; b = 180;
        break;
      case MIDIInstrument.Choir:
      case MIDIInstrument.Pad:
        r = 220; g = 100; b = 180;
        break;
    }
    const native = (r & 0xff) | ((g & 0xff) << 8) | ((b & 0xff) << 16);
    return 0x1000000 | native;
  }
}
