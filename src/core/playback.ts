import {
  Beat,
  ChordSymbol,
  KeySignature,
  Note,
  Order,
  Paragraph,
  SectionDirective,
  SectionDirectiveKind,
  Sheet,
  Unit
} from "./types";

export type PlaybackContent =
  | { type: "note"; note: Note }
  | { type: "chord"; chord: ChordSymbol }
  | { type: "rest" }
  | { type: "percussion"; pattern: string };

export interface PlaybackState {
  tempo: number;
  keyOffset: number;
  timeSignature: Beat;
}

export interface PlaybackEvent {
  position: number;
  duration: number;
  content: PlaybackContent;
  state: PlaybackState;
}

export interface PlaybackDirectiveEvent {
  position: number;
  kind: SectionDirectiveKind;
  state: PlaybackState;
}

export interface PlaybackTimeline {
  events: PlaybackEvent[];
  directives: PlaybackDirectiveEvent[];
  duration: number;
}

export class TMDPlaybackRenderer {
  public static render(sheet: Sheet, instrument: string): PlaybackTimeline {
    const paragraphs = sheet.paragraphs.filter((p) => p.instrument === instrument);
    const orders: Order[] = sheet.orders.length > 0
      ? sheet.orders
      : Array.from(new Set(sheet.paragraphs.map((p) => p.name))).map((n) => ({ type: "name", name: n }));

    let state: PlaybackState = {
      tempo: sheet.speed > 0 ? sheet.speed : 120,
      keyOffset: sheet.keySignature.semitoneOffset,
      timeSignature: sheet.beat
    };

    let events: PlaybackEvent[] = [];
    let directives: PlaybackDirectiveEvent[] = [];
    let timelinePosition = 0.0;

    for (const order of orders) {
      if (order.type === "relative") {
        const delta = parseInt(order.value.replace("+", ""), 10);
        if (!isNaN(delta)) {
          state = { ...state, keyOffset: state.keyOffset + delta };
        }
      } else if (order.type === "absolute") {
        state = { ...state, keyOffset: KeySignature.parse(order.value).semitoneOffset };
      } else if (order.type === "name") {
        const paragraph = paragraphs.find((p) => p.name === order.name);
        const paragraphDuration = TMDPlaybackRenderer.durationOf(order.name, sheet);
        if (!paragraph) {
          timelinePosition += paragraphDuration;
          continue;
        }

        const start = timelinePosition + paragraph.start * TMDPlaybackRenderer.measureDuration(state.timeSignature);
        const rendered = TMDPlaybackRenderer.renderParagraph(paragraph, start, state);
        events.push(...rendered.events);
        directives.push(...rendered.directives);
        state = rendered.state;
        timelinePosition += Math.max(paragraphDuration, rendered.duration);
      }
    }

    const minEventPos = events.length > 0 ? Math.min(...events.map((e) => e.position)) : 0.0;
    const minDirPos = directives.length > 0 ? Math.min(...directives.map((d) => d.position)) : 0.0;
    const earliestPosition = Math.min(minEventPos, minDirPos);
    const offset = earliestPosition < 0.0 ? -earliestPosition : 0.0;

    const adjustedEvents: PlaybackEvent[] = events.map((e) => ({
      ...e,
      position: e.position + offset
    }));

    const adjustedDirectives: PlaybackDirectiveEvent[] = directives.map((d) => ({
      ...d,
      position: d.position + offset
    }));

    adjustedEvents.sort((a, b) => a.position - b.position);
    adjustedDirectives.sort((a, b) => a.position - b.position);

    return {
      events: adjustedEvents,
      directives: adjustedDirectives,
      duration: timelinePosition + offset
    };
  }

  private static renderParagraph(
    paragraph: Paragraph,
    start: number,
    initialState: PlaybackState
  ): { events: PlaybackEvent[]; directives: PlaybackDirectiveEvent[]; state: PlaybackState; duration: number } {
    let state = { ...initialState };
    const events: PlaybackEvent[] = [];
    const directives: PlaybackDirectiveEvent[] = [];
    let position = start;

    for (const section of paragraph.sections) {
      const unitDuration = 4.0 / Math.max(1, section.noteLength);
      const sortedDirectives = [...section.directives].sort((a, b) => a.position - b.position);
      let directiveIndex = 0;
      let sectionPosition = 0;

      for (const group of section.unitGroups) {
        while (directiveIndex < sortedDirectives.length && sortedDirectives[directiveIndex].position <= sectionPosition) {
          const dir = sortedDirectives[directiveIndex];
          state = TMDPlaybackRenderer.applyDirective(dir.kind, state);
          directives.push({ position, kind: dir.kind, state });
          directiveIndex++;
        }

        const groupDuration = Math.max(0, group.length) * unitDuration;
        const activeUnits = group.units.filter((u) => u.type !== "tie");

        if (activeUnits.length === 0) {
          if (events.length > 0) {
            const last = events.pop()!;
            events.push({
              position: last.position,
              duration: last.duration + groupDuration,
              content: last.content,
              state: last.state
            });
          } else {
            events.push({ position, duration: groupDuration, content: { type: "rest" }, state });
          }
        } else {
          const eventDuration = groupDuration / activeUnits.length;
          activeUnits.forEach((unit, idx) => {
            const content = TMDPlaybackRenderer.contentOf(unit);
            if (content) {
              events.push({
                position: position + idx * eventDuration,
                duration: eventDuration,
                content,
                state
              });
            }
          });
        }

        position += groupDuration;
        sectionPosition += group.length;
      }

      while (directiveIndex < sortedDirectives.length) {
        const dir = sortedDirectives[directiveIndex];
        state = TMDPlaybackRenderer.applyDirective(dir.kind, state);
        directives.push({ position, kind: dir.kind, state });
        directiveIndex++;
      }
    }

    return { events, directives, state, duration: position - start };
  }

  private static contentOf(unit: Unit): PlaybackContent | null {
    switch (unit.type) {
      case "note": return { type: "note", note: unit.note };
      case "chord": return { type: "chord", chord: unit.chord };
      case "rest": return { type: "rest" };
      case "percussion": return { type: "percussion", pattern: unit.pattern };
      case "tie": return null;
    }
  }

  private static applyDirective(kind: SectionDirectiveKind, state: PlaybackState): PlaybackState {
    switch (kind.type) {
      case "tempo":
        return { ...state, tempo: Math.max(1, kind.bpm) };
      case "relativeTempo":
        return { ...state, tempo: Math.max(1, state.tempo + kind.deltaBpm) };
      case "absoluteKey":
        return { ...state, keyOffset: KeySignature.parse(kind.key).semitoneOffset };
      case "relativeKey":
        return { ...state, keyOffset: state.keyOffset + kind.semitones };
      case "timeSignature":
        return { ...state, timeSignature: kind.beat };
    }
  }

  private static durationOf(name: String, sheet: Sheet): number {
    const matching = sheet.paragraphs.filter((p) => p.name === name);
    if (matching.length === 0) return 0;

    return Math.max(
      ...matching.map((p) => {
        const lead = Math.max(0, p.start) * TMDPlaybackRenderer.measureDuration(sheet.beat);
        const sectionsDuration = p.sections.reduce((tot, sec) => {
          const unitDuration = 4.0 / Math.max(1, sec.noteLength);
          return tot + sec.unitGroups.reduce((acc, g) => acc + Math.max(0, g.length) * unitDuration, 0);
        }, 0);
        return lead + sectionsDuration;
      })
    );
  }

  private static measureDuration(beat: Beat): number {
    return (Math.max(1, beat.count) * 4.0) / Math.max(1, beat.noteValue);
  }
}
