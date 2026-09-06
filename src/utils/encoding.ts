export interface TextReadResult { content: string; encoding: string; }

/** Decode common TMD source encodings without silently accepting invalid UTF-8. */
export class TextEncodingDetector {
  static detectAndDecode(data: Uint8Array): TextReadResult | null {
    if (data.length === 0) return { content: "", encoding: "UTF-8" };
    if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) return { content: new TextDecoder("utf-8").decode(data.slice(3)), encoding: "UTF-8" };
    if (data[0] === 0xff && data[1] === 0xfe) return { content: new TextDecoder("utf-16le").decode(data.slice(2)), encoding: "UTF-16LE" };
    if (data[0] === 0xfe && data[1] === 0xff) {
      const swapped = new Uint8Array(data.length - 2);
      for (let i = 2; i + 1 < data.length; i += 2) { swapped[i - 2] = data[i + 1]; swapped[i - 1] = data[i]; }
      return { content: new TextDecoder("utf-16le").decode(swapped), encoding: "UTF-16BE" };
    }
    try { return { content: new TextDecoder("utf-8", { fatal: true }).decode(data), encoding: "UTF-8" }; }
    catch { return { content: new TextDecoder("windows-1252").decode(data), encoding: "Windows-1252" }; }
  }

  static displayName(encoding: string): string { return encoding; }
}
