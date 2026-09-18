import { Beat } from "./types.js";
import { Lexer, Token, LexedToken } from "./parser.js";

export interface TMDMeasureIssue {
  paragraphName: string;
  instrument: string;
  lineNumber: number;
  measureIndex: number;
  expectedUnits: number;
  actualUnits: number;
  deltaUnits: number;
  noteLength: number;
  beat: Beat;
  snippet: string;
  description: string;
}

interface ParagraphSpanInfo {
  paragraphName: string;
  instrument: string;
  startLine: number;
  startOffset: number;
  measures: number;
  endMeasure: number;
  quarterNotes: number;
  endQuarterNotes: number;
}

function intValueOfToken(token: Token): number | undefined {
  if (token.type === "number" || token.type === "positiveNumber") {
    return token.value as number;
  }
  if (token.type === "note") {
    return token.value.degree as number;
  }
  return undefined;
}

function formatIssueDescription(issue: {
  paragraphName: string;
  instrument: string;
  lineNumber: number;
  measureIndex: number;
  expectedUnits: number;
  actualUnits: number;
  deltaUnits: number;
  noteLength: number;
  beat: Beat;
  snippet: string;
}): string {
  const diffStr = issue.deltaUnits > 0 ? `+${issue.deltaUnits}` : `${issue.deltaUnits}`;
  if (issue.measureIndex === 0) {
    return `${issue.paragraphName}:${issue.instrument} (line ${issue.lineNumber}): Expected ${issue.expectedUnits} measures (${issue.snippet}), found ${issue.actualUnits} measures (${diffStr} measures)`;
  } else {
    let desc = `${issue.paragraphName}:${issue.instrument} (line ${issue.lineNumber}, measure ${issue.measureIndex}): Expected ${issue.expectedUnits} units (${issue.beat.count}/${issue.beat.noteValue} at <${issue.noteLength}*>), found ${issue.actualUnits} units (${diffStr} units)`;
    if (issue.snippet) {
      desc += `\n  --> | ${issue.snippet} |`;
    }
    return desc;
  }
}

export class TMDMeasureChecker {
  public static check(source: string): TMDMeasureIssue[] {
    const lexer = new Lexer(source);
    const tokensWithRanges = lexer.tokenizeWithRanges();

    // First, extract song-level default beat (<4/4>)
    let beat: Beat = { count: 4, noteValue: 4 };
    for (let i = 0; i < tokensWithRanges.length; i++) {
      if (tokensWithRanges[i].token.type === "openAngle") {
        if (
          i + 4 < tokensWithRanges.length &&
          tokensWithRanges[i + 2].token.type === "slash" &&
          tokensWithRanges[i + 4].token.type === "closeAngle"
        ) {
          const c = intValueOfToken(tokensWithRanges[i + 1].token) ?? 4;
          const n = intValueOfToken(tokensWithRanges[i + 3].token) ?? 4;
          beat = { count: c, noteValue: n };
          break;
        }
      }
    }

    const issues: TMDMeasureIssue[] = [];
    const paragraphInfos: ParagraphSpanInfo[] = [];
    let pos = 0;

    function current(): LexedToken | undefined {
      return pos < tokensWithRanges.length ? tokensWithRanges[pos] : undefined;
    }

    function advance(): LexedToken | undefined {
      if (pos < tokensWithRanges.length) {
        const tok = tokensWithRanges[pos];
        pos++;
        return tok;
      }
      return undefined;
    }

    while (pos < tokensWithRanges.length) {
      const tok = current();
      if (!tok) break;

      // Paragraph header: identifier:identifier@...{
      if (
        tok.token.type === "identifier" &&
        pos + 1 < tokensWithRanges.length &&
        tokensWithRanges[pos + 1].token.type === "colon"
      ) {
        const pName = tok.token.value as string;
        const paraStartLine = tok.range.start.line;
        advance(); // pName
        advance(); // :

        let instName = "";
        const instTok = advance();
        if (instTok && instTok.token.type === "identifier") {
          instName = instTok.token.value as string;
        }

        // Extract start offset from @|start| if present
        let startOffset = 0;
        while (pos < tokensWithRanges.length && current()?.token.type !== "openBrace") {
          if (current()?.token.type === "at") {
            advance(); // @
            if (current()?.token.type === "pipe") {
              advance(); // |
              let sign = 1;
              if (current()?.token.type === "tie") {
                sign = -1;
                advance(); // -
              }
              const numTok = current();
              if (numTok) {
                if (numTok.token.type === "number" || numTok.token.type === "positiveNumber") {
                  startOffset = sign * (numTok.token.value as number);
                  advance();
                } else if (numTok.token.type === "note") {
                  startOffset = sign * (numTok.token.value.degree as number);
                  advance();
                }
              }
              if (current()?.token.type === "pipe") {
                advance(); // |
              }
            }
            break;
          }
          advance();
        }

        // Advance until `{`
        while (pos < tokensWithRanges.length && current()?.token.type !== "openBrace") {
          advance();
        }
        if (current()?.token.type !== "openBrace") continue;
        advance(); // {

        // Parse inside paragraph
        let noteLength = 4;
        let currentMeasureUnits = 0;
        let currentMeasureSnippet: string[] = [];
        let measureCount = 0;
        let insideBar = false;
        let measureStartLine = paraStartLine;
        let paragraphQuarterNotes = 0.0;

        function expectedUnitsForMeasure(): number {
          const numerator = beat.count * noteLength;
          return Math.max(1, Math.floor(numerator / beat.noteValue));
        }

        while (pos < tokensWithRanges.length && current()?.token.type !== "closeBrace") {
          const item = current();
          if (!item) break;

          // Check for Section subdivision header: < noteLength * >
          if (item.token.type === "openAngle") {
            if (
              pos + 2 < tokensWithRanges.length &&
              tokensWithRanges[pos + 2].token.type === "asterisk"
            ) {
              advance(); // <
              const lenTok = advance();
              if (lenTok) {
                const val = intValueOfToken(lenTok.token);
                if (val !== undefined) {
                  noteLength = val;
                }
              }
              advance(); // *
              if (current()?.token.type === "closeAngle") {
                advance(); // >
              }
              continue;
            }
          }

          if (item.token.type === "pipe") {
            const pipeLine = item.range.start.line;
            advance(); // |

            if (insideBar && currentMeasureUnits > 0) {
              measureCount++;
              const expected = expectedUnitsForMeasure();
              const isPickup =
                startOffset < 0 &&
                measureCount === 1 &&
                currentMeasureUnits < expected &&
                currentMeasureUnits > 0;
              if (currentMeasureUnits !== expected && !isPickup) {
                const delta = currentMeasureUnits - expected;
                const snippetStr = currentMeasureSnippet.join(" ");
                const issueObj = {
                  paragraphName: pName,
                  instrument: instName,
                  lineNumber: measureStartLine,
                  measureIndex: measureCount,
                  expectedUnits: expected,
                  actualUnits: currentMeasureUnits,
                  deltaUnits: delta,
                  noteLength,
                  beat,
                  snippet: snippetStr,
                };
                issues.push({
                  ...issueObj,
                  description: formatIssueDescription(issueObj),
                });
              }
              currentMeasureUnits = 0;
              currentMeasureSnippet = [];
              measureStartLine = pipeLine;
            } else {
              insideBar = true;
              currentMeasureUnits = 0;
              currentMeasureSnippet = [];
              measureStartLine = pipeLine;
            }
            continue;
          }

          // Count unit duration
          const unitQuarterNotes = 4.0 / Math.max(1, noteLength);

          if (item.token.type === "openParen") {
            // Tuplet / unit group: ( ... ) % ( -- )
            advance(); // (
            const innerUnits: string[] = [];
            while (pos < tokensWithRanges.length && current()?.token.type !== "closeParen") {
              const inner = advance();
              if (inner) {
                innerUnits.push(inner.text);
              }
            }
            if (current()?.token.type === "closeParen") advance(); // )

            let length = 1;
            if (current()?.token.type === "percentOpenParen") {
              advance(); // %(
              let dashes = 0;
              while (pos < tokensWithRanges.length && current()?.token.type === "tie") {
                dashes++;
                advance();
              }
              if (current()?.token.type === "closeParen") advance(); // )
              length = Math.max(1, dashes);
            }

            paragraphQuarterNotes += length * unitQuarterNotes;
            if (insideBar) {
              currentMeasureUnits += length;
              currentMeasureSnippet.push(`(${innerUnits.join(" ")})`);
            }
            continue;
          }

          // Check for standard units: note, chord, tie, percussion, rest, drum identifiers
          switch (item.token.type) {
            case "note":
            case "chord":
            case "tie":
            case "percussion":
              advance();
              paragraphQuarterNotes += unitQuarterNotes;
              if (insideBar) {
                currentMeasureUnits += 1;
                currentMeasureSnippet.push(item.text);
              }
              break;
            case "identifier": {
              const val = typeof item.token.value === "string" ? item.token.value : item.text;
              if (val.length > 0 && /^[XxTtSsDdBbOoCc]+$/.test(val)) {
                advance();
                paragraphQuarterNotes += unitQuarterNotes;
                if (insideBar) {
                  currentMeasureUnits += 1;
                  currentMeasureSnippet.push(item.text);
                }
              } else {
                advance();
              }
              break;
            }
            case "number":
              advance();
              paragraphQuarterNotes += unitQuarterNotes;
              if (insideBar) {
                currentMeasureUnits += 1;
                currentMeasureSnippet.push(String(item.token.value));
              }
              break;
            default:
              advance();
              break;
          }
        }

        if (current()?.token.type === "closeBrace") {
          advance(); // }
        }

        const nominalMeasureDur = (Math.max(1, beat.count) * 4.0) / Math.max(1, beat.noteValue);
        const calculatedMeasures = Math.round(paragraphQuarterNotes / nominalMeasureDur);
        const actualMeasures = measureCount > 0 ? measureCount : Math.max(1, calculatedMeasures);

        const endMeasure =
          startOffset < 0 ? Math.max(0, startOffset + actualMeasures) : startOffset + actualMeasures;
        const positiveQuarterNotes =
          startOffset < 0
            ? Math.max(0, paragraphQuarterNotes + startOffset * nominalMeasureDur)
            : startOffset * nominalMeasureDur + paragraphQuarterNotes;

        paragraphInfos.push({
          paragraphName: pName,
          instrument: instName,
          startLine: paraStartLine,
          startOffset,
          measures: actualMeasures,
          endMeasure,
          quarterNotes: paragraphQuarterNotes,
          endQuarterNotes: positiveQuarterNotes,
        });
      } else {
        advance();
      }
    }

    // Section length consistency check
    const paragraphsBySection = new Map<string, ParagraphSpanInfo[]>();
    for (const p of paragraphInfos) {
      const list = paragraphsBySection.get(p.paragraphName) || [];
      list.push(p);
      paragraphsBySection.set(p.paragraphName, list);
    }

    for (const [sectionName, list] of paragraphsBySection.entries()) {
      if (list.length < 2) continue;


      // Find the longest track by endMeasure (and endQuarterNotes)
      let maxTrack = list[0];
      for (let i = 1; i < list.length; i++) {
        const cur = list[i];
        if (cur.endMeasure !== maxTrack.endMeasure) {
          if (cur.endMeasure > maxTrack.endMeasure) maxTrack = cur;
        } else if (cur.endQuarterNotes > maxTrack.endQuarterNotes) {
          maxTrack = cur;
        }
      }

      const expectedMeasures = maxTrack.endMeasure;
      const expectedBeats = maxTrack.endQuarterNotes;

      for (const track of list) {
        if (track.endMeasure < expectedMeasures) {
          const diffBeats = track.endQuarterNotes - expectedBeats;
          const diffBeatsStr = diffBeats > 0 ? `+${diffBeats.toFixed(1)}` : `${diffBeats.toFixed(1)}`;
          const expectedBeatsStr = expectedBeats.toFixed(1);
          const trackBeatsStr = track.endQuarterNotes.toFixed(1);

          const snippet = `${expectedBeatsStr} beats based on ${maxTrack.instrument}; found ${trackBeatsStr} beats, ${diffBeatsStr} beats`;
          const delta = track.endMeasure - expectedMeasures;
          const issueObj = {
            paragraphName: sectionName,
            instrument: track.instrument,
            lineNumber: track.startLine,
            measureIndex: 0,
            expectedUnits: expectedMeasures,
            actualUnits: track.endMeasure,
            deltaUnits: delta,
            noteLength: 4,
            beat,
            snippet,
          };
          issues.push({
            ...issueObj,
            description: formatIssueDescription(issueObj),
          });
        } else if (
          track.endMeasure === expectedMeasures &&
          track.startOffset >= 0 &&
          maxTrack.startOffset >= 0 &&
          track.endQuarterNotes + 1e-4 < expectedBeats
        ) {
          const diffBeats = track.endQuarterNotes - expectedBeats;
          const diffBeatsStr = diffBeats > 0 ? `+${diffBeats.toFixed(1)}` : `${diffBeats.toFixed(1)}`;
          const expectedBeatsStr = expectedBeats.toFixed(1);
          const trackBeatsStr = track.endQuarterNotes.toFixed(1);

          const snippet = `${expectedBeatsStr} beats based on ${maxTrack.instrument}; found ${trackBeatsStr} beats, ${diffBeatsStr} beats`;
          const delta = track.endMeasure - expectedMeasures;
          const issueObj = {
            paragraphName: sectionName,
            instrument: track.instrument,
            lineNumber: track.startLine,
            measureIndex: 0,
            expectedUnits: expectedMeasures,
            actualUnits: track.endMeasure,
            deltaUnits: delta,
            noteLength: 4,
            beat,
            snippet,
          };
          issues.push({
            ...issueObj,
            description: formatIssueDescription(issueObj),
          });
        }
      }
    }

    return issues;
  }
}
