import * as path from "node:path";

export interface ParsedLocation {
  filePath: string;
  line?: number;
  column?: number;
}

export class FilePathNormalizer {
  static isFileURL(value: string): boolean {
    const text = value.trim().replace(/^<|>$/g, "").trim().toLowerCase();
    return text.startsWith("file:");
  }

  static fileURLToPath(value: string): string {
    const text = value.trim().replace(/^<|>$/g, "").trim();
    if (!this.isFileURL(text)) return text;
    try { return path.normalize(decodeURIComponent(new URL(text).pathname)); }
    catch { return decodeURIComponent(text.replace(/^file:(\/\/localhost)?/, "")); }
  }

  static parseLocation(value: string): ParsedLocation {
    let text = value.trim();
    let line: number | undefined;
    let column: number | undefined;
    const anchor = text.match(/#L?(\d+)(?:C|:)?(\d+)?$/i);
    if (anchor) { line = Number(anchor[1]); column = anchor[2] ? Number(anchor[2]) : undefined; text = text.slice(0, anchor.index); }
    if (line === undefined) {
      const suffix = text.match(/^(.*?)(?<!^[A-Za-z]):(\d+)(?::(\d+))?$/);
      if (suffix) { text = suffix[1]; line = Number(suffix[2]); column = suffix[3] ? Number(suffix[3]) : undefined; }
    }
    return { filePath: this.fileURLToPath(text), line, column };
  }
}
