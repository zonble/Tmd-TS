import { Sheet, TMDPlaybackRenderer, PlaybackEvent, Note, Accidental } from "./core/index.js";

export class TmdAudioError extends Error {}

/** Portable fallback renderer. It produces deterministic stereo PCM WAV without platform audio APIs. */
export class TMDWAVRenderer {
  static renderWAV(sheet: Sheet, sampleRate = 44100): Uint8Array {
    if (!Number.isFinite(sampleRate) || sampleRate < 8000) throw new TmdAudioError("Sample rate must be at least 8000 Hz");
    const events: PlaybackEvent[] = [];
    for (const instrument of new Set(sheet.paragraphs.map(p => p.instrument))) events.push(...TMDPlaybackRenderer.render(sheet, instrument).events);
    const tempo = Math.max(1, sheet.speed || 120);
    const secondsPerBeat = 60 / tempo;
    const totalSeconds = Math.max(2, ...events.map(e => (e.position + e.duration) * secondsPerBeat + 2.5));
    const frames = Math.ceil(totalSeconds * sampleRate);
    const pcm = new Int16Array(frames * 2);
    for (const event of events) {
      const pitches = event.content.type === "note" ? [this.noteToMidi(event.content.note, event.state.keyOffset)] : event.content.type === "chord" ? this.chordToMidi(event.content.chord.root.semitoneOffset + event.state.keyOffset) : [];
      for (const pitch of pitches) {
        const start = Math.max(0, Math.floor(event.position * secondsPerBeat * sampleRate));
        const end = Math.min(frames, Math.ceil((event.position + event.duration) * secondsPerBeat * sampleRate));
        const frequency = 440 * Math.pow(2, (pitch - 69) / 12);
        for (let i = start; i < end; i++) { const t = (i - start) / sampleRate; const env = Math.min(1, t * 80, (end - i) / sampleRate * 8); const sample = Math.sin(2 * Math.PI * frequency * t) * 0.12 * env * 32767; const left = i * 2; pcm[left] = Math.max(-32768, Math.min(32767, pcm[left] + sample)); pcm[left + 1] = Math.max(-32768, Math.min(32767, pcm[left + 1] + sample)); }
      }
    }
    const data = new Uint8Array(44 + pcm.byteLength); const view = new DataView(data.buffer);
    const put = (offset: number, text: string) => [...text].forEach((c, i) => data[offset + i] = c.charCodeAt(0));
    put(0, "RIFF"); view.setUint32(4, 36 + pcm.byteLength, true); put(8, "WAVE"); put(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); put(36, "data"); view.setUint32(40, pcm.byteLength, true); new Int16Array(data.buffer, 44).set(pcm);
    return data;
  }
  private static noteToMidi(note: Note, key: number): number { return 60 + key + [0, 2, 4, 5, 7, 9, 11][note.degree - 1] + (note.accidental === Accidental.Sharp ? 1 : note.accidental === Accidental.Flat ? -1 : 0) + note.octave * 12; }
  private static chordToMidi(offset: number): number[] { return [60 + offset, 64 + offset, 67 + offset]; }
}
