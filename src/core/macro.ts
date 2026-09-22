import {
  Beat,
  Order,
  Paragraph,
  Section,
  SExpr,
  Sheet,
  UnitGroup,
} from "./types.js";
import { TMDPlaybackRenderer } from "./playback.js";

export interface MacroExpansionResult {
  paragraphs: Paragraph[];
  orders: Order[];
}

export class TMDMacroEvaluator {
  /**
   * Expands any S-expression macro orders (`Order.macro`) in a Sheet into concrete
   * paragraphs and concrete order sequences.
   * If the sheet contains no macro orders, it returns the paragraphs and orders as-is.
   */
  public static expand(sheet: Sheet): Sheet {
    const hasMacro = sheet.orders.some((o) => o.type === "macro");
    if (!hasMacro) {
      return sheet;
    }

    const abstractMap = new Map<string, Paragraph>();
    for (const p of sheet.paragraphs) {
      if (!p.instrument) {
        abstractMap.set(p.name, p);
      }
    }

    const concreteParagraphs: Paragraph[] = sheet.paragraphs.filter((p) => Boolean(p.instrument));
    const newOrders: Order[] = [];
    let genCounter = 0;

    const createSyntheticParagraph = (
      baseName: string,
      instrument: string,
      startOffset: number,
      sections: Section[]
    ): Paragraph => {
      genCounter++;
      const uniqueName = `__macro_${baseName}_${genCounter}`;
      const p: Paragraph = {
        name: uniqueName,
        instrument,
        start: startOffset,
        sections: JSON.parse(JSON.stringify(sections)),
      };
      concreteParagraphs.push(p);
      return p;
    };

    const getThemeSections = (themeArg: SExpr): { name: string; sections: Section[] } => {
      if (Array.isArray(themeArg)) {
        const combinedSections: Section[] = [];
        const names: string[] = [];
        for (const item of themeArg) {
          const sub = getThemeSections(item);
          names.push(sub.name);
          for (const s of sub.sections) {
            combinedSections.push(JSON.parse(JSON.stringify(s)));
          }
        }
        return { name: names.join("_"), sections: combinedSections };
      }

      const themeName = String(themeArg);
      const p = abstractMap.get(themeName) || sheet.paragraphs.find((p) => p.name === themeName);
      if (!p) {
        throw new Error(`Macro error: Theme '${themeName}' not found`);
      }
      return { name: themeName, sections: p.sections };
    };

    const evalExpr = (expr: SExpr): { paragraphNames: string[] } => {
      if (!Array.isArray(expr) || expr.length === 0) {
        return { paragraphNames: [] };
      }

      const op = String(expr[0]).toLowerCase();

      switch (op) {
        case "play": {
          // (play <theme|themes> <instrument> [:at <measure_offset>])
          const themeTarget = expr[1];
          const instrument = String(expr[2]);
          let atOffset = 0;
          if (expr.length >= 5 && String(expr[3]).toLowerCase() === ":at") {
            atOffset = Number(expr[4]) || 0;
          } else if (expr.length >= 4 && typeof expr[3] === "number") {
            atOffset = Number(expr[3]) || 0;
          }

          const { name: themeName, sections } = getThemeSections(themeTarget);
          const p = createSyntheticParagraph(themeName, instrument, atOffset, sections);
          return { paragraphNames: [p.name] };
        }

        case "loop": {
          // (loop <theme|themes> <instrument> <times>)
          const themeTarget = expr[1];
          const instrument = String(expr[2]);
          const times = Number(expr[3]) || 1;
          const { name: themeName, sections: baseSections } = getThemeSections(themeTarget);

          const loopedSections: Section[] = [];
          for (let t = 0; t < times; t++) {
            for (const s of baseSections) {
              loopedSections.push(JSON.parse(JSON.stringify(s)));
            }
          }

          const p = createSyntheticParagraph(themeName, instrument, 0, loopedSections);
          return { paragraphNames: [p.name] };
        }

        case "canon": {
          // (canon <theme|themes> (<instruments...>) <offset_bars>)
          const themeTarget = expr[1];
          const instrumentsRaw = expr[2];
          const instruments: string[] = Array.isArray(instrumentsRaw)
            ? instrumentsRaw.map((x) => String(x))
            : [String(instrumentsRaw)];
          const offsetBars = Number(expr[3]) || 0;
          const { name: themeName, sections } = getThemeSections(themeTarget);

          const createdNames: string[] = [];
          for (let i = 0; i < instruments.length; i++) {
            const inst = instruments[i];
            const startOffset = i * offsetBars;
            const p = createSyntheticParagraph(themeName, inst, startOffset, sections);
            createdNames.push(p.name);
          }

          // A canon executes all voices concurrently within the same block
          // In TMD playback order, multiple paragraphs playing concurrently share the same section name.
          // We can merge all voices of this canon under a single shared section name!
          genCounter++;
          const canonSectionName = `__canon_${themeName}_${genCounter}`;
          for (const name of createdNames) {
            const p = concreteParagraphs.find((cp) => cp.name === name);
            if (p) {
              p.name = canonSectionName;
            }
          }

          return { paragraphNames: [canonSectionName] };
        }

        case "layer": {
          // (layer <child1> <child2> ...)
          // Evaluates all child expressions concurrently.
          // All generated paragraphs will share the same unified section name so they start at the same time.
          const childNames: string[] = [];
          for (let i = 1; i < expr.length; i++) {
            const res = evalExpr(expr[i]);
            childNames.push(...res.paragraphNames);
          }

          genCounter++;
          const layerSectionName = `__layer_${genCounter}`;
          for (const cName of childNames) {
            for (const cp of concreteParagraphs) {
              if (cp.name === cName) {
                cp.name = layerSectionName;
              }
            }
          }

          return { paragraphNames: [layerSectionName] };
        }

        default:
          throw new Error(`Unknown macro operation '${op}' in S-expression`);
      }
    };

    for (const order of sheet.orders) {
      if (order.type === "macro") {
        const res = evalExpr(order.expr);
        for (const name of Array.from(new Set(res.paragraphNames))) {
          newOrders.push({ type: "name", name });
        }
      } else {
        newOrders.push(order);
      }
    }

    return {
      ...sheet,
      paragraphs: concreteParagraphs,
      orders: newOrders,
    };
  }
}
