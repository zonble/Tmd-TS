import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export class TmdSkill {
  static readonly skillName = "tmd";
  static readonly skillMarkdown = `# TMD\n\nTMD is a text notation for numbered melodies, chords, sections, arrangement orders, and music exporters. Parse and validate TMD before editing; preserve score structure and musical intent.\n`;
  static defaultInstallPaths(): string[] { return [".codex", ".gemini", ".gemini/config", ".claude", ".agent", ".agents"].map(root => path.join(os.homedir(), root, "skills", "tmd")); }
  static installSkills(paths = this.defaultInstallPaths()): { path: string; installed: boolean; error?: string }[] { return paths.map(p => { try { fs.mkdirSync(p, { recursive: true }); fs.writeFileSync(path.join(p, "SKILL.md"), this.skillMarkdown); return { path: p, installed: true }; } catch (e) { return { path: p, installed: false, error: String(e) }; } }); }
}
