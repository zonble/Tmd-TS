import {
  Accidental,
  accidentalToSemitone,
  Beat,
  Note,
  Order,
  Paragraph,
  ScaleDegree,
  scaleDegreeSemitoneOffset,
  Section,
  SExpr,
  Sheet,
  Unit,
  UnitGroup,
} from "./types.js";
import { TMDPlaybackRenderer } from "./playback.js";

export interface MacroExpansionResult {
  paragraphs: Paragraph[];
  orders: Order[];
}

/**
 * Maps pitch in semitones (0-11) to ScaleDegree and Accidental.
 */
function semitoneToDegreeAccidental(semi: number): { degree: ScaleDegree; accidental: Accidental } {
  // semi: 0 to 11
  switch (semi) {
    case 0: return { degree: ScaleDegree.C, accidental: Accidental.Natural };
    case 1: return { degree: ScaleDegree.C, accidental: Accidental.Sharp };
    case 2: return { degree: ScaleDegree.D, accidental: Accidental.Natural };
    case 3: return { degree: ScaleDegree.D, accidental: Accidental.Sharp };
    case 4: return { degree: ScaleDegree.E, accidental: Accidental.Natural };
    case 5: return { degree: ScaleDegree.F, accidental: Accidental.Natural };
    case 6: return { degree: ScaleDegree.F, accidental: Accidental.Sharp };
    case 7: return { degree: ScaleDegree.G, accidental: Accidental.Natural };
    case 8: return { degree: ScaleDegree.G, accidental: Accidental.Sharp };
    case 9: return { degree: ScaleDegree.A, accidental: Accidental.Natural };
    case 10: return { degree: ScaleDegree.A, accidental: Accidental.Sharp };
    case 11: return { degree: ScaleDegree.B, accidental: Accidental.Natural };
    default: return { degree: ScaleDegree.C, accidental: Accidental.Natural };
  }
}

function noteToTotalSemitones(note: Note): number {
  return scaleDegreeSemitoneOffset(note.degree) + accidentalToSemitone(note.accidental) + note.octave * 12;
}

function totalSemitonesToNote(totalSemitones: number): Note {
  let octave = Math.floor(totalSemitones / 12);
  let semiInOctave = totalSemitones % 12;
  if (semiInOctave < 0) {
    semiInOctave += 12;
  }
  const { degree, accidental } = semitoneToDegreeAccidental(semiInOctave);
  return {
    degree,
    accidental,
    octave,
  };
}

function transposeSections(sections: Section[], semitones: number): Section[] {
  if (semitones === 0) return JSON.parse(JSON.stringify(sections));
  const cloned: Section[] = JSON.parse(JSON.stringify(sections));
  for (const s of cloned) {
    for (const g of s.unitGroups) {
      for (const u of g.units) {
        if (u.type === "note") {
          const currentTotal = noteToTotalSemitones(u.note);
          u.note = totalSemitonesToNote(currentTotal + semitones);
        }
      }
    }
  }
  return cloned;
}

function octaveShiftSections(sections: Section[], octaveDelta: number): Section[] {
  if (octaveDelta === 0) return JSON.parse(JSON.stringify(sections));
  const cloned: Section[] = JSON.parse(JSON.stringify(sections));
  for (const s of cloned) {
    for (const g of s.unitGroups) {
      for (const u of g.units) {
        if (u.type === "note") {
          u.note.octave += octaveDelta;
        }
      }
    }
  }
  return cloned;
}

function reverseSections(sections: Section[]): Section[] {
  const cloned: Section[] = JSON.parse(JSON.stringify(sections));
  // Collect all unit groups across all sections
  const allGroups: UnitGroup[] = [];
  for (const s of cloned) {
    for (const g of s.unitGroups) {
      allGroups.push(g);
    }
  }
  allGroups.reverse();

  // Distribute back matching the original section group counts
  let idx = 0;
  for (const s of cloned) {
    const count = s.unitGroups.length;
    s.unitGroups = allGroups.slice(idx, idx + count);
    idx += count;
  }
  return cloned;
}

function invertSections(sections: Section[], axisPitchSemitones?: number): Section[] {
  const cloned: Section[] = JSON.parse(JSON.stringify(sections));
  let axis = axisPitchSemitones;
  if (axis === undefined) {
    // Find the first note as axis
    for (const s of cloned) {
      for (const g of s.unitGroups) {
        for (const u of g.units) {
          if (u.type === "note") {
            axis = noteToTotalSemitones(u.note);
            break;
          }
        }
        if (axis !== undefined) break;
      }
      if (axis !== undefined) break;
    }
  }

  if (axis === undefined) {
    return cloned;
  }

  for (const s of cloned) {
    for (const g of s.unitGroups) {
      for (const u of g.units) {
        if (u.type === "note") {
          const origSemitones = noteToTotalSemitones(u.note);
          const diff = origSemitones - axis;
          const invertedSemitones = axis - diff;
          u.note = totalSemitonesToNote(invertedSemitones);
        }
      }
    }
  }
  return cloned;
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
        if (themeArg.length === 0) {
          return { name: "empty", sections: [] };
        }

        const head = String(themeArg[0]).toLowerCase();

        // 1. (transpose <theme> <semitones>) or (transpose <semitones> <theme>)
        if (head === "transpose") {
          let target = themeArg[1];
          let semitones = Number(themeArg[2]) || 0;
          if (typeof target === "number" || (!isNaN(Number(target)) && typeof themeArg[2] === "string")) {
            semitones = Number(target) || 0;
            target = themeArg[2];
          }
          const sub = getThemeSections(target);
          return {
            name: `${sub.name}_tr${semitones >= 0 ? "+" + semitones : semitones}`,
            sections: transposeSections(sub.sections, semitones),
          };
        }

        // 2. (octave <theme> <octaveDelta>) or (octave <octaveDelta> <theme>)
        if (head === "octave") {
          let target = themeArg[1];
          let delta = Number(themeArg[2]) || 0;
          if (typeof target === "number" || (!isNaN(Number(target)) && typeof themeArg[2] === "string")) {
            delta = Number(target) || 0;
            target = themeArg[2];
          }
          const sub = getThemeSections(target);
          return {
            name: `${sub.name}_oct${delta >= 0 ? "+" + delta : delta}`,
            sections: octaveShiftSections(sub.sections, delta),
          };
        }

        // 3. (reverse <theme>) / (retrograde <theme>)
        if (head === "reverse" || head === "retrograde") {
          const target = themeArg[1];
          const sub = getThemeSections(target);
          return {
            name: `${sub.name}_rev`,
            sections: reverseSections(sub.sections),
          };
        }

        // 4. (invert <theme> [axis])
        if (head === "invert") {
          const target = themeArg[1];
          const axisArg = themeArg.length >= 3 ? Number(themeArg[2]) : undefined;
          const sub = getThemeSections(target);
          return {
            name: `${sub.name}_inv`,
            sections: invertSections(sub.sections, axisArg),
          };
        }

        // 5. (ri <theme> [axis]) - Retrograde Inversion
        if (head === "ri") {
          const target = themeArg[1];
          const axisArg = themeArg.length >= 3 ? Number(themeArg[2]) : undefined;
          const sub = getThemeSections(target);
          return {
            name: `${sub.name}_ri`,
            sections: invertSections(reverseSections(sub.sections), axisArg),
          };
        }

        // 6. (vary <theme> <transform1> <transform2> ...)
        if (head === "vary") {
          const target = themeArg[1];
          let current = getThemeSections(target);
          for (let i = 2; i < themeArg.length; i++) {
            const transform = themeArg[i];
            if (!Array.isArray(transform) || transform.length === 0) continue;
            const tOp = String(transform[0]).toLowerCase();
            if (tOp === "transpose") {
              const semitones = Number(transform[1]) || 0;
              current = {
                name: `${current.name}_tr${semitones >= 0 ? "+" + semitones : semitones}`,
                sections: transposeSections(current.sections, semitones),
              };
            } else if (tOp === "octave") {
              const delta = Number(transform[1]) || 0;
              current = {
                name: `${current.name}_oct${delta >= 0 ? "+" + delta : delta}`,
                sections: octaveShiftSections(current.sections, delta),
              };
            } else if (tOp === "reverse" || tOp === "retrograde") {
              current = {
                name: `${current.name}_rev`,
                sections: reverseSections(current.sections),
              };
            } else if (tOp === "invert") {
              const axisArg = transform.length >= 2 ? Number(transform[1]) : undefined;
              current = {
                name: `${current.name}_inv`,
                sections: invertSections(current.sections, axisArg),
              };
            } else if (tOp === "ri") {
              const axisArg = transform.length >= 2 ? Number(transform[1]) : undefined;
              current = {
                name: `${current.name}_ri`,
                sections: invertSections(reverseSections(current.sections), axisArg),
              };
            }
          }
          return current;
        }

        // Sequential multi-theme: (ThemeA ThemeB)
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
          // (canon <theme|themes|canon_expr> (<instruments...>) <offset_bars>)
          const themeTarget = expr[1];
          const instrumentsRaw = expr[2];
          const instruments: string[] = Array.isArray(instrumentsRaw)
            ? instrumentsRaw.map((x) => String(x))
            : [String(instrumentsRaw)];
          const offsetBars = Number(expr[3]) || 0;

          // Check if themeTarget is a nested sub-expression like (canon ...), (layer ...), (reverse ...), etc.
          const nestedOps = ["canon", "layer", "play", "loop", "reverse", "retrograde", "invert", "ri", "transpose", "octave"];
          if (
            Array.isArray(themeTarget) &&
            themeTarget.length > 0 &&
            typeof themeTarget[0] === "string" &&
            nestedOps.includes(String(themeTarget[0]).toLowerCase()) &&
            // Note: if it's (reverse Theme) without instruments/canon inside, it might be a theme variation.
            // But if it contains an inner canon/layer/play/loop or explicit instrument, it's a full sub-expression!
            // Let's check if the target has an inner nestedOp or if evaluating it as an expression produces concrete paragraphs
            (function isSubExpr(node: SExpr): boolean {
              if (!Array.isArray(node) || node.length === 0) return false;
              const h = String(node[0]).toLowerCase();
              if (["canon", "layer", "play", "loop"].includes(h)) return true;
              if (["reverse", "retrograde", "invert", "ri", "transpose", "octave"].includes(h)) {
                return isSubExpr(node[1]) || (node.length >= 3 && isSubExpr(node[2]));
              }
              return false;
            })(themeTarget)
          ) {
            const innerResult = evalExpr(themeTarget);
            const innerParagraphs = concreteParagraphs.filter((cp) => innerResult.paragraphNames.includes(cp.name));

            // Extract the distinct instruments used in the inner expression in appearance order
            const innerDistinctInsts: string[] = [];
            for (const ip of innerParagraphs) {
              if (!innerDistinctInsts.includes(ip.instrument)) {
                innerDistinctInsts.push(ip.instrument);
              }
            }

            genCounter++;
            const outerCanonSectionName = `__nested_canon_${genCounter}`;

            // If instruments were provided for the outer voice, clone and remap
            if (instruments.length > 0) {
              for (let i = 0; i < innerParagraphs.length; i++) {
                const p = innerParagraphs[i];
                const instIdx = innerDistinctInsts.indexOf(p.instrument);
                const mappedInst = (instIdx >= 0 && instIdx < instruments.length) ? instruments[instIdx] : p.instrument;

                // Clone outer voice with shifted start offset
                const outerP = createSyntheticParagraph(
                  p.name,
                  mappedInst,
                  p.start + offsetBars,
                  p.sections
                );
                outerP.name = outerCanonSectionName;
              }
            }

            // Merge inner voice paragraphs under the same unified playback section
            for (const ip of innerParagraphs) {
              ip.name = outerCanonSectionName;
            }

            return { paragraphNames: [outerCanonSectionName] };
          }

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

        case "reverse":
        case "retrograde": {
          // (reverse <child>)
          const childExpr = expr[1];
          const innerRes = evalExpr(childExpr);
          const innerParagraphs = concreteParagraphs.filter((cp) => innerRes.paragraphNames.includes(cp.name));
          for (const ip of innerParagraphs) {
            ip.sections = reverseSections(ip.sections);
          }
          return innerRes;
        }

        case "invert": {
          // (invert <child> [axis])
          const childExpr = expr[1];
          const axisArg = expr.length >= 3 ? Number(expr[2]) : undefined;
          const innerRes = evalExpr(childExpr);
          const innerParagraphs = concreteParagraphs.filter((cp) => innerRes.paragraphNames.includes(cp.name));
          for (const ip of innerParagraphs) {
            ip.sections = invertSections(ip.sections, axisArg);
          }
          return innerRes;
        }

        case "ri": {
          // (ri <child> [axis])
          const childExpr = expr[1];
          const axisArg = expr.length >= 3 ? Number(expr[2]) : undefined;
          const innerRes = evalExpr(childExpr);
          const innerParagraphs = concreteParagraphs.filter((cp) => innerRes.paragraphNames.includes(cp.name));
          for (const ip of innerParagraphs) {
            ip.sections = invertSections(reverseSections(ip.sections), axisArg);
          }
          return innerRes;
        }

        case "transpose": {
          // (transpose <child> <semitones>) or (transpose <semitones> <child>)
          let target = expr[1];
          let semitones = Number(expr[2]) || 0;
          if (typeof target === "number" || (!isNaN(Number(target)) && typeof expr[2] !== "number")) {
            semitones = Number(target) || 0;
            target = expr[2];
          }
          const innerRes = evalExpr(target);
          const innerParagraphs = concreteParagraphs.filter((cp) => innerRes.paragraphNames.includes(cp.name));
          for (const ip of innerParagraphs) {
            ip.sections = transposeSections(ip.sections, semitones);
          }
          return innerRes;
        }

        case "octave": {
          // (octave <child> <delta>) or (octave <delta> <child>)
          let target = expr[1];
          let delta = Number(expr[2]) || 0;
          if (typeof target === "number" || (!isNaN(Number(target)) && typeof expr[2] !== "number")) {
            delta = Number(target) || 0;
            target = expr[2];
          }
          const innerRes = evalExpr(target);
          const innerParagraphs = concreteParagraphs.filter((cp) => innerRes.paragraphNames.includes(cp.name));
          for (const ip of innerParagraphs) {
            ip.sections = octaveShiftSections(ip.sections, delta);
          }
          return innerRes;
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
