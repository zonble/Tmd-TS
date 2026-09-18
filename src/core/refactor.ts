import { Sheet, Paragraph } from "./types.js";
import { TmdParser } from "./parser.js";
import { formatSheet } from "./format.js";

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

    const extractedSheet: Sheet = {
      name: sheet.name,
      speed: sheet.speed,
      keySignature: sheet.keySignature,
      beat: sheet.beat,
      paragraphs: matchingParagraphs,
      orders: sheet.orders,
      metadata: sheet.metadata,
    };

    return this.format(formatSheet(extractedSheet));
  }
}
