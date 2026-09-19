import { Sheet, Paragraph, ScaleDegree, UnitGroup } from "./types.js";
import { TmdParser } from "./parser.js";
import { formatSheet, formatParagraph } from "./format.js";

export class TMDRefactorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TMDRefactorError";
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatMusicalUnits(text: string): string {
  let output = "";
  const chars = Array.from(text);
  let i = 0;
  let lastWasSpace = false;

  while (i < chars.length) {
    const ch = chars[i];
    if (ch === "|") {
      if (output.length > 0 && !output.endsWith(" ")) {
        output += " ";
      }
      output += "| ";
      lastWasSpace = true;
      while (i + 1 < chars.length && (chars[i + 1] === " " || chars[i + 1] === "\t")) {
        i++;
      }
    } else if (ch === " " || ch === "\t") {
      if (!lastWasSpace && output.length > 0) {
        output += " ";
        lastWasSpace = true;
      }
    } else {
      output += ch;
      lastWasSpace = false;
    }
    i++;
  }

  return output.trim();
}

function formatLine(line: string, indent = 0): string {
  const indentPrefix = "    ".repeat(indent);
  let working = line;
  let commentSuffix = "";

  // Extract inline block comment if present at end of line
  const commentStart = working.indexOf("/*");
  if (commentStart !== -1) {
    const commentText = working.slice(commentStart);
    working = working.slice(0, commentStart);
    commentSuffix = "  " + commentText.trim();
  }

  const trimmed = working.trim();

  // Check if header line
  if (trimmed.startsWith("::SCORE::")) {
    return "::SCORE::" + commentSuffix;
  }
  if (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length > 4) {
    const title = trimmed.slice(2, -2).trim();
    return `** ${title} **` + commentSuffix;
  }
  if (trimmed.startsWith("!=") || trimmed.startsWith("! =")) {
    const value = (trimmed.startsWith("! =") ? trimmed.slice(3) : trimmed.slice(2)).trim();
    return `!= ${value}` + commentSuffix;
  }
  if (trimmed.startsWith("?=") || trimmed.startsWith("? =")) {
    const value = (trimmed.startsWith("? =") ? trimmed.slice(3) : trimmed.slice(2)).trim();
    return `?= ${value}` + commentSuffix;
  }
  if (trimmed.startsWith("<") && trimmed.endsWith(">") && trimmed.includes("/")) {
    return trimmed + commentSuffix;
  }

  // Paragraph header line: e.g. intro:Piano@|0|{
  if (trimmed.includes(":") && trimmed.includes("@") && trimmed.endsWith("{")) {
    const colonIdx = trimmed.indexOf(":");
    const pName = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();
    const atIdx = rest.indexOf("@");
    if (atIdx !== -1) {
      const inst = rest.slice(0, atIdx).trim();
      const timing = rest.slice(atIdx + 1).trim();
      return `${pName}:${inst}@${timing}` + commentSuffix;
    }
  }

  // Section header line: <4*> or <16*>
  if (trimmed.startsWith("<") && trimmed.endsWith("*>")) {
    return indentPrefix + trimmed + commentSuffix;
  }

  // Closing brace
  if (trimmed === "}") {
    return "}" + commentSuffix;
  }

  // Orders line: -> ...
  if (trimmed.startsWith("->")) {
    const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
    const orderTokens: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "->" || t === "->#") {
        orderTokens.push(t);
      } else if (t.startsWith("->")) {

        orderTokens.push("->");
        const sub = t.slice(2);
        if (sub.length > 0) {
          orderTokens.push(sub);
        }
      } else {
        orderTokens.push(t);
      }
      i++;
    }
    return orderTokens.join(" ") + commentSuffix;
  }

  // Content / measure line
  const formattedContent = formatMusicalUnits(trimmed);
  return indentPrefix + formattedContent + commentSuffix;
}

export class TMDRefactor {
  public static format(source: string): string {
    const resultLines: string[] = [];
    const rawLines = source.split(/\r?\n/);
    let inProgramBlock = false;
    let indentLevel = 0;

    for (const line of rawLines) {
      const trimmed = line.trim();

      if (trimmed.includes('"""')) {
        const occurrences = trimmed.split('"""').length - 1;
        if (occurrences % 2 !== 0) {
          inProgramBlock = !inProgramBlock;
        }
        resultLines.push(line);
        continue;
      }

      if (inProgramBlock) {
        resultLines.push(line);
        continue;
      }

      if (trimmed.length === 0) {
        resultLines.push("");
        continue;
      }

      if (trimmed === "}") {
        indentLevel = Math.max(0, indentLevel - 1);
        resultLines.push(formatLine(line, 0));
        continue;
      }

      // If line is pure block comment
      if (trimmed.startsWith("/*") && trimmed.endsWith("*/")) {
        const indent = "    ".repeat(indentLevel);
        resultLines.push(indent + trimmed);
        continue;
      }

      const formattedLine = formatLine(line, indentLevel);
      resultLines.push(formattedLine);

      if (trimmed.endsWith("{")) {
        indentLevel++;
      }
    }

    // Clean up excessive empty lines (> 2 consecutive empty lines to 1)
    const finalLines: string[] = [];
    let emptyCount = 0;
    for (const l of resultLines) {
      if (l.trim().length === 0) {
        emptyCount++;
        if (emptyCount <= 1) {
          finalLines.push("");
        }
      } else {
        emptyCount = 0;
        finalLines.push(l);
      }
    }

    return finalLines.join("\n") + "\n";
  }

  public static renameInstrument(
    source: string,
    oldInstrument: string,
    newInstrument: string
  ): string {
    const pattern = new RegExp(
      "([A-Za-z0-9_\\-\\u4e00-\\u9fa5]+)\\s*:\\s*" +
        escapeRegex(oldInstrument) +
        "\\s*@",
      "g"
    );

    const replaced = source.replace(pattern, `$1:${newInstrument}@`);
    if (replaced === source) {
      // Check if score even parses
      TmdParser.parseThrowing(source);
    }
    // Verify valid TMD score after rename
    TmdParser.parseThrowing(replaced);
    return replaced;
  }

  public static renameSection(
    source: string,
    oldSection: string,
    newSection: string
  ): string {
    // 1. Rename in paragraph declarations: <oldSection>:<instrument>@... -> <newSection>:<instrument>@...
    const paraPattern = new RegExp("(^|\\n)\\s*" + escapeRegex(oldSection) + "\\s*:", "g");
    let result = source.replace(paraPattern, `$1${newSection}:`);

    // 2. Rename in orders: `-> <oldSection> ` or `-> <oldSection>\n` or `-> <oldSection>->`
    const orderPattern = new RegExp("(->\\s*)" + escapeRegex(oldSection) + "(?=\\s*(->|->#|\\n|$))", "g");
    result = result.replace(orderPattern, `$1${newSection}`);

    // Verify valid TMD score after rename
    TmdParser.parseThrowing(result);
    return result;
  }

  public static extractInstrument(source: string, instrument: string): string {
    const sheet = TmdParser.parseThrowing(source);
    const matchingParagraphs = sheet.paragraphs.filter((p) => p.instrument === instrument);
    if (matchingParagraphs.length === 0) {
      throw new TMDRefactorError(`Instrument '${instrument}' not found in score`);
    }

    const rawLines = source.split(/\r?\n/);
    const resultLines: string[] = [];
    let insideParagraph = false;
    let keepParagraph = false;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();

      const paraMatch = trimmed.match(
        /^([a-zA-Z0-9_\u4e00-\u9fa5-]+)\s*:\s*([a-zA-Z0-9_\u4e00-\u9fa5-]+)(@[^{]*)?\s*\{/
      );
      if (paraMatch) {
        insideParagraph = true;
        const pInst = paraMatch[2];
        keepParagraph = pInst === instrument;
        if (keepParagraph) {
          resultLines.push(rawLine);
        }
        continue;
      }

      if (trimmed === "}") {
        if (insideParagraph && keepParagraph) {
          resultLines.push(rawLine);
        }
        insideParagraph = false;
        keepParagraph = false;
        continue;
      }

      if (insideParagraph) {
        if (keepParagraph) {
          resultLines.push(rawLine);
        }
        continue;
      }

      resultLines.push(rawLine);
    }

    const formatted = this.format(resultLines.join("\n"));
    TmdParser.parseThrowing(formatted);
    return formatted;
  }

  public static duplicateTrack(
    source: string,
    sourceInstrument: string,
    targetInstrument: string,
    options?: { section?: string; octaveShift?: number }
  ): string {
    const sheet = TmdParser.parseThrowing(source);
    let matching = sheet.paragraphs.filter((p) => p.instrument === sourceInstrument);
    if (options?.section) {
      matching = matching.filter((p) => p.name === options.section);
    }
    if (matching.length === 0) {
      if (options?.section) {
        throw new TMDRefactorError(`Track '${options.section}:${sourceInstrument}' not found in score`);
      }
      throw new TMDRefactorError(`Instrument '${sourceInstrument}' not found in score`);
    }

    const shift = options?.octaveShift || 0;
    const duplicatedParagraphs: Paragraph[] = matching.map((orig) => {
      const clonedSections = orig.sections.map((sec) => ({
        noteLength: sec.noteLength,
        directives: [...sec.directives],
        unitGroups: sec.unitGroups.map((g) => ({
          length: g.length,
          units: g.units.map((u) => {
            if (u.type === "note") {
              return {
                type: "note" as const,
                note: {
                  degree: u.note.degree,
                  accidental: u.note.accidental,
                  octave: u.note.octave + shift,
                },
              };
            }
            return u;
          }),
        })),
      }));

      return {
        name: orig.name,
        instrument: targetInstrument,
        start: orig.start,
        sections: clonedSections,
        executionTime: orig.executionTime,
        showProgram: orig.showProgram,
      };
    });

    const newParagraphsText = duplicatedParagraphs
      .map((p) => formatParagraph(p, sheet.beat))
      .join("\n");

    let combined: string;
    const orderMatch = source.search(/(^|\n)\s*->/);
    if (orderMatch !== -1) {
      const insertPos = orderMatch === 0 ? 0 : orderMatch + 1;
      combined = source.slice(0, insertPos) + "\n" + newParagraphsText + "\n" + source.slice(insertPos);
    } else {
      combined = source + "\n\n" + newParagraphsText;
    }

    const formatted = this.format(combined);
    TmdParser.parseThrowing(formatted);
    return formatted;
  }

  public static generateHarmony(
    source: string,
    sourceInstrument: string,
    harmonyInstrument: string,
    options: { section?: string; intervalSteps: number }
  ): string {
    const sheet = TmdParser.parseThrowing(source);
    let matching = sheet.paragraphs.filter((p) => p.instrument === sourceInstrument);
    if (options?.section) {
      matching = matching.filter((p) => p.name === options.section);
    }
    if (matching.length === 0) {
      if (options?.section) {
        throw new TMDRefactorError(`Track '${options.section}:${sourceInstrument}' not found in score`);
      }
      throw new TMDRefactorError(`Instrument '${sourceInstrument}' not found in score`);
    }

    const steps = options.intervalSteps; // e.g. +2 for 3rd up, -2 for 3rd down
    const harmonizedParagraphs: Paragraph[] = matching.map((orig) => {
      const clonedSections = orig.sections.map((sec) => ({
        noteLength: sec.noteLength,
        directives: [...sec.directives],
        unitGroups: sec.unitGroups.map((g) => ({
          length: g.length,
          units: g.units.map((u) => {
            if (u.type === "note") {
              const currentDeg = u.note.degree as number; // 1..7
              const zeroIndexed = currentDeg - 1; // 0..6
              const newZero = zeroIndexed + steps;
              const newDeg = (((newZero % 7) + 7) % 7) + 1;
              const octaveDelta = Math.floor(newZero / 7);

              return {
                type: "note" as const,
                note: {
                  degree: newDeg as ScaleDegree,
                  accidental: u.note.accidental,
                  octave: u.note.octave + octaveDelta,
                },
              };
            }
            return u;
          }),
        })),
      }));

      return {
        name: orig.name,
        instrument: harmonyInstrument,
        start: orig.start,
        sections: clonedSections,
        executionTime: orig.executionTime,
        showProgram: orig.showProgram,
      };
    });

    const newParagraphsText = harmonizedParagraphs
      .map((p) => formatParagraph(p, sheet.beat))
      .join("\n");

    let combined: string;
    const orderMatch = source.search(/(^|\n)\s*->/);
    if (orderMatch !== -1) {
      const insertPos = orderMatch === 0 ? 0 : orderMatch + 1;
      combined = source.slice(0, insertPos) + "\n" + newParagraphsText + "\n" + source.slice(insertPos);
    } else {
      combined = source + "\n\n" + newParagraphsText;
    }

    const formatted = this.format(combined);
    TmdParser.parseThrowing(formatted);
    return formatted;
  }

  public static inlineOrders(source: string): string {
    const sheet = TmdParser.parseThrowing(source);
    if (!sheet.orders || sheet.orders.length === 0) {
      return source;
    }

    // Map instruments -> combined list of sections in linear playback sequence
    const instruments = Array.from(new Set(sheet.paragraphs.map((p) => p.instrument)));
    const linearParagraphs: Paragraph[] = [];

    for (const inst of instruments) {
      const combinedUnitGroups: UnitGroup[] = [];
      let baseNoteLength = 4;

      for (const ord of sheet.orders) {
        if (ord.type !== "name") continue;
        const para = sheet.paragraphs.find((p) => p.name === ord.name && p.instrument === inst);
        if (!para) continue;

        for (const sec of para.sections) {
          baseNoteLength = sec.noteLength;
          combinedUnitGroups.push(...sec.unitGroups);
        }
      }

      linearParagraphs.push({
        name: "linear",
        instrument: inst,
        start: 0,
        sections: [
          {
            noteLength: baseNoteLength,
            unitGroups: combinedUnitGroups,
            directives: [],
          },
        ],
      });
    }

    const newSheet: Sheet = {
      name: sheet.name,
      speed: sheet.speed,
      keySignature: sheet.keySignature,
      beat: sheet.beat,
      paragraphs: linearParagraphs,
      orders: [{ type: "name", name: "linear" }],
      metadata: sheet.metadata,
    };

    return this.format(formatSheet(newSheet));
  }

  public static doubleGrid(
    source: string,
    target?: { section?: string; instrument?: string }
  ): string {
    const rawLines = source.split(/\r?\n/);
    const resultLines: string[] = [];

    let inMatchingPara = false;
    let insideParagraph = false;
    let currentNoteLength = 4;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();

      // Check paragraph header: section:instrument@...{
      const paraMatch = trimmed.match(
        /^([a-zA-Z0-9_\u4e00-\u9fa5-]+)\s*:\s*([a-zA-Z0-9_\u4e00-\u9fa5-]+)(@[^{]*)?\s*\{/
      );
      if (paraMatch) {
        insideParagraph = true;
        const pSec = paraMatch[1];
        const pInst = paraMatch[2];
        inMatchingPara =
          (!target?.section || target.section === pSec) &&
          (!target?.instrument || target.instrument === pInst);
        currentNoteLength = 4;
        resultLines.push(rawLine);
        continue;
      }

      if (trimmed === "}") {
        insideParagraph = false;
        inMatchingPara = false;
        resultLines.push(rawLine);
        continue;
      }

      if (!insideParagraph || !inMatchingPara) {
        resultLines.push(rawLine);
        continue;
      }

      // Check section noteLength header: <4*> -> <8*>
      const gridMatch = trimmed.match(/^<(\d+)\*>/);
      if (gridMatch) {
        currentNoteLength = parseInt(gridMatch[1], 10);
        const newLen = currentNoteLength * 2;
        const indent = rawLine.match(/^\s*/)?.[0] || "";
        resultLines.push(`${indent}<${newLen}*>`);
        continue;
      }

      // If line is measure line / contains units
      if (trimmed.startsWith("|") || trimmed.includes("|") || /[0-7\[\]\-]/.test(trimmed)) {
        const indent = rawLine.match(/^\s*/)?.[0] || "";
        const transformed = doubleGridInLine(trimmed);
        resultLines.push(indent + transformed);
      } else {
        resultLines.push(rawLine);
      }
    }

    return this.format(resultLines.join("\n"));
  }

  public static halveGrid(
    source: string,
    target?: { section?: string; instrument?: string }
  ): string {
    const rawLines = source.split(/\r?\n/);
    const resultLines: string[] = [];

    let inMatchingPara = false;
    let insideParagraph = false;
    let currentNoteLength = 4;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();

      const paraMatch = trimmed.match(
        /^([a-zA-Z0-9_\u4e00-\u9fa5-]+)\s*:\s*([a-zA-Z0-9_\u4e00-\u9fa5-]+)(@[^{]*)?\s*\{/
      );
      if (paraMatch) {
        insideParagraph = true;
        const pSec = paraMatch[1];
        const pInst = paraMatch[2];
        inMatchingPara =
          (!target?.section || target.section === pSec) &&
          (!target?.instrument || target.instrument === pInst);
        currentNoteLength = 4;
        resultLines.push(rawLine);
        continue;
      }

      if (trimmed === "}") {
        insideParagraph = false;
        inMatchingPara = false;
        resultLines.push(rawLine);
        continue;
      }

      if (!insideParagraph || !inMatchingPara) {
        resultLines.push(rawLine);
        continue;
      }

      const gridMatch = trimmed.match(/^<(\d+)\*>/);
      if (gridMatch) {
        currentNoteLength = parseInt(gridMatch[1], 10);
        if (currentNoteLength % 2 !== 0) {
          throw new TMDRefactorError(`Cannot halve odd grid <${currentNoteLength}*>`);
        }
        const newLen = currentNoteLength / 2;
        const indent = rawLine.match(/^\s*/)?.[0] || "";
        resultLines.push(`${indent}<${newLen}*>`);
        continue;
      }

      if (trimmed.startsWith("|") || trimmed.includes("|") || /[0-7\[\]\-]/.test(trimmed)) {
        const indent = rawLine.match(/^\s*/)?.[0] || "";
        const transformed = halveGridInLine(trimmed);
        resultLines.push(indent + transformed);
      } else {
        resultLines.push(rawLine);
      }
    }

    return this.format(resultLines.join("\n"));
  }
}

function parseTupletToken(tok: string): { inner: string; dashes: string } | null {
  const matchWithLen = tok.match(/^\(([^)]+)\)\s*%\s*\(([-]+)\)$/);
  if (matchWithLen) {
    return { inner: matchWithLen[1].trim(), dashes: matchWithLen[2] };
  }
  const matchWithoutLen = tok.match(/^\(([^)]+)\)$/);
  if (matchWithoutLen) {
    return { inner: matchWithoutLen[1].trim(), dashes: "-" };
  }
  return null;
}

function doubleGridInLine(line: string): string {
  // Break line into tokens while preserving pipes and comments
  // Extract comment if present
  let working = line;
  let commentSuffix = "";
  const commentStart = working.indexOf("/*");
  if (commentStart !== -1) {
    commentSuffix = " " + working.slice(commentStart);
    working = working.slice(0, commentStart).trim();
  }

  // Tokenize the measure content
  const tokens = tokenizeMeasureLine(working);
  const outTokens: string[] = [];

  for (const tok of tokens) {
    if (tok === "|") {
      outTokens.push("|");
      continue;
    }

    const tuplet = parseTupletToken(tok);
    if (tuplet) {
      const doubledDashes = tuplet.dashes + tuplet.dashes;
      outTokens.push(`(${tuplet.inner})%(${doubledDashes})`);
      continue;
    }

    // Regular unit: append a tie '-'
    outTokens.push(tok);
    outTokens.push("-");
  }

  return outTokens.join(" ") + commentSuffix;
}

function halveGridInLine(line: string): string {
  let working = line;
  let commentSuffix = "";
  const commentStart = working.indexOf("/*");
  if (commentStart !== -1) {
    commentSuffix = " " + working.slice(commentStart);
    working = working.slice(0, commentStart).trim();
  }

  const tokens = tokenizeMeasureLine(working);
  const outTokens: string[] = [];

  // Group tokens by measure (between pipes)
  let currentMeasure: string[] = [];

  const processMeasure = (measureTokens: string[]) => {
    let i = 0;
    while (i < measureTokens.length) {
      const u1 = measureTokens[i];
      const tuplet = parseTupletToken(u1);
      if (tuplet) {
        if (tuplet.dashes.length % 2 !== 0) {
          throw new TMDRefactorError(
            `Cannot halve tuplet with odd length: '${u1}' in | ${measureTokens.join(" ")} |`
          );
        }
        const halfLen = tuplet.dashes.length / 2;
        const halvedDashes = "-".repeat(halfLen);
        outTokens.push(`(${tuplet.inner})%(${halvedDashes})`);
        i++;
        continue;
      }

      if (i + 1 >= measureTokens.length) {
        throw new TMDRefactorError(
          `Cannot halve measure with odd number of units: | ${measureTokens.join(" ")} |`
        );
      }
      const u2 = measureTokens[i + 1];
      if (u2 !== "-") {
        throw new TMDRefactorError(
          `Cannot halve grid: unit '${u1} ${u2}' does not sustain with a tie '-'`
        );
      }
      outTokens.push(u1);
      i += 2;
    }
  };

  for (const tok of tokens) {
    if (tok === "|") {
      if (currentMeasure.length > 0) {
        processMeasure(currentMeasure);
        currentMeasure = [];
      }
      outTokens.push("|");
    } else {
      currentMeasure.push(tok);
    }
  }

  if (currentMeasure.length > 0) {
    processMeasure(currentMeasure);
  }

  return outTokens.join(" ") + commentSuffix;
}

function tokenizeMeasureLine(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === "|") {
      tokens.push("|");
      i++;
      continue;
    }
    if (ch === "[") {
      // Chord [Am7]
      const end = line.indexOf("]", i);
      if (end !== -1) {
        tokens.push(line.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    if (ch === "(") {
      // Tuplet (1 2 3) or (1 2 3)%(--) or (1 2 3) % (--)
      const endParen = line.indexOf(")", i);
      if (endParen !== -1) {
        let afterParen = endParen + 1;
        while (afterParen < line.length && (line[afterParen] === " " || line[afterParen] === "\t")) {
          afterParen++;
        }
        if (line[afterParen] === "%") {
          let afterPercent = afterParen + 1;
          while (afterPercent < line.length && (line[afterPercent] === " " || line[afterPercent] === "\t")) {
            afterPercent++;
          }
          if (line[afterPercent] === "(") {
            const endDashes = line.indexOf(")", afterPercent + 1);
            if (endDashes !== -1) {
              tokens.push(line.slice(i, endDashes + 1));
              i = endDashes + 1;
              continue;
            }
          }
        }
        tokens.push(line.slice(i, endParen + 1));
        i = endParen + 1;
        continue;
      }
    }
    // Directive {!= 120} etc
    if (ch === "{") {
      const end = line.indexOf("}", i);
      if (end !== -1) {
        tokens.push(line.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    // Normal word/note token until whitespace or pipe or bracket or paren
    let word = "";
    while (i < line.length && !/[\s|\[\]\(\)\{\}]/.test(line[i])) {
      word += line[i];
      i++;
    }
    if (word.length > 0) {
      tokens.push(word);
    }
  }
  return tokens;
}
