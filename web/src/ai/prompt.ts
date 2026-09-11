import { TmdSkill } from "../../../src/skill.js";
import { GenerateOptions } from "./types.js";

export function buildSystemPrompt(): string {
  return `${TmdSkill.skillMarkdown}

You are an expert composer, orchestrator, and master of TMD (Timebase Mark Down).
Your primary goal is to write or modify TMD musical scores.

CRITICAL SYNTAX RULES:
1. Every score MUST start with '::SCORE::' on line 1.
2. The score-level header must specify Title (** Name **), Speed (!= 120), Key Signature (?= C), and Meter (<4/4>).
3. Every track paragraph MUST follow: 'name:instrument@|offset|{ ... }'
   - Always close every opened paragraph '{' with a matching '}'.
4. Every section inside a paragraph MUST start with a note length grid like '<4*>', '<8*>', or '<16*>'.
5. Accidentals MUST precede octave displacements: write '1'^' (Sharp Do, high octave), NEVER '1^''.
6. Chords are enclosed in brackets: [C], [Dm7], [1], [6m], etc.
7. Tuplet syntax is strictly '(units...)%(dashes)', e.g. '(1 2 3)%(--)'.
8. The playback arrangement at the end MUST start with '->' and terminate with '->#', e.g. '-> intro -> verse -> chorus ->#'.
9. OUTPUT FORMAT: Output ONLY the complete, valid TMD score inside a single \`\`\`tmd ... \`\`\` code block. Keep any explanations concise and placed after the code block.
`;
}

export function buildUserPrompt(options: GenerateOptions): string {
  const current = options.currentTmd?.trim();
  let baseInstruction = options.prompt;

  if (options.mode === "arrange") {
    baseInstruction = `Please arrange accompaniment for the following score (e.g. add CHORD track, Bass track, and Drums track while keeping the melody intact):\n\n${current}\n\nAdditional User Request: ${options.prompt}`;
  } else if (options.mode === "extend") {
    baseInstruction = `Please develop, continue, or expand the musical motif of the following score (e.g. write the chorus, bridge, or counter-melody):\n\n${current}\n\nAdditional User Request: ${options.prompt}`;
  } else if (options.mode === "debug") {
    baseInstruction = `Please analyze, fix any syntax errors, balance section beat durations, and polish the formatting of this TMD score:\n\n${current}\n\nUser Notes: ${options.prompt}`;
  } else if (options.mode === "reharm") {
    baseInstruction = `Please re-harmonize the following score with richer, colorful jazz/pop chord progressions and voice leading:\n\n${current}\n\nUser Request: ${options.prompt}`;
  } else if (current && options.mode === "compose") {
    baseInstruction = `Current score context:\n\`\`\`tmd\n${current}\n\`\`\`\n\nTask: ${options.prompt}`;
  }

  return baseInstruction;
}

export function extractTmdCode(response: string): string | null {
  const match = response.match(/```(?:tmd)?\s*([\s\S]*?)```/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  if (response.includes("::SCORE::")) {
    const idx = response.indexOf("::SCORE::");
    return response.slice(idx).trim();
  }
  return null;
}

export interface RepairPromptOptions {
  originalPrompt: string;
  faultyTmd: string;
  errorMessage: string;
  line?: number;
  column?: number;
  snippet?: string;
  expectedTokens?: string[];
}

export function buildRepairPrompt(options: RepairPromptOptions): string {
  const lineInfo = options.line ? `Line ${options.line}` : "";
  const colInfo = options.column ? `Column ${options.column}` : "";
  const pos = [lineInfo, colInfo].filter(Boolean).join(", ");
  const expected = options.expectedTokens && options.expectedTokens.length > 0
    ? `Expected tokens: ${options.expectedTokens.join(", ")}`
    : "";

  return `The previous TMD score generated for the request "${options.originalPrompt}" has a TMD syntax error and failed strict validation.

=== PARSER DIAGNOSTIC ===
${pos ? `Location: ${pos}` : ""}
Error Message: ${options.errorMessage}
${expected ? expected : ""}
${options.snippet ? `Offending Code Snippet:\n> ${options.snippet}` : ""}

=== FAULTY TMD SCORE ===
\`\`\`tmd
${options.faultyTmd}
\`\`\`

=== REPAIR INSTRUCTIONS ===
1. Correct the syntax error indicated above according to TMD specification (check bar lines '|', section braces '{}', meter '<4/4>', note octaves, paragraph declarations, and play orders '-> ... ->#').
2. Maintain the original musical intent and track balance.
3. Return the complete corrected score inside a single \`\`\`tmd ... \`\`\` code block.`;
}

