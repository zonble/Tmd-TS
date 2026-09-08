import { TmdSkill } from "../../../src/skill.js";
import { GenerateOptions } from "./types.js";

export function buildSystemPrompt(): string {
  return `${TmdSkill.skillMarkdown}

You are an expert composer, orchestrator, and master of TMD (Timebase Mark Down).
Your primary goal is to write or modify TMD musical scores.

OUTPUT RULES:
1. Always output the TMD score directly inside a single \`\`\`tmd ... \`\`\` code block.
2. Ensure the TMD score is syntactically valid (must start with ::SCORE::, include metadata, sections with proper notes/chords/meter, and playback order -> ... ->#).
3. Do not invent non-existent TMD syntax. Keep section units duration-balanced.
4. Keep explanations concise, placed after the code block.
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
