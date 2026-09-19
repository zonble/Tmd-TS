import { Sheet } from './types.js';

/**
 * Common helper functions for querying and resolving instruments from a TMD Sheet.
 * Eliminates duplicate instrument filtering and vocal track heuristic resolution across exporters.
 */
export class SheetInstrumentHelper {
  /**
   * Returns a sorted array of distinct instrument names present in the sheet.
   * If the sheet has no instruments, falls back to `["Piano"]` if fallback is enabled.
   */
  public static distinctInstruments(sheet: Sheet, fallbackToDefault = true): string[] {
    const distinct = Array.from(new Set(sheet.paragraphs.map((p) => p.instrument))).sort();
    if (distinct.length === 0 && fallbackToDefault) {
      return ['Piano'];
    }
    return distinct;
  }

  /**
   * Resolves a target vocal instrument for singing-synthesis exporters (VSQ, VSQX, UST).
   * Checks requested instrument first, then matches vocal regex, or falls back to first track.
   */
  public static resolveVocalInstrument(sheet: Sheet, requested?: string): string {
    const distinct = this.distinctInstruments(sheet, false);
    if (requested && distinct.includes(requested)) {
      return requested;
    }
    const regex = /vocal|voice|miku|utau|teto|sing|lead|melody/i;
    const matched = distinct.find((inst) => regex.test(inst));
    if (matched) {
      return matched;
    }
    return distinct[0] || 'Vocal';
  }
}
