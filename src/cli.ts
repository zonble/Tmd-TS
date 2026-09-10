import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { TmdParser, formatSummary } from "./core/index.js";
import { TMDABCGenerator, TMDLilyPondGenerator, TMDMusicXMLGenerator, TMDMIDIGenerator, TMDReaperGenerator, TMDChordProGenerator, TMDVSQGenerator, TMDVSQXGenerator } from "./exporters/index.js";
import { TMDWAVRenderer } from "./audio.js";
import { TmdSkill } from "./skill.js";
import { TmdMcpServer, TmdMcpInstaller } from "./mcp/index.js";
import { TMD_VERSION } from "./version.js";

export function printHelp(): void {
  console.log(`OVERVIEW: A compiler and toolkit for TMD (Timebase Mark Down) music notation.

USAGE: tmd [<options>] [<input-path>]

  -p, --parse-only        Parse and display the score summary.
  -m, --midi-output PATH  Export Standard MIDI.
  -x, --musicxml-output PATH  Export MusicXML 4.0.
  -l, --lilypond-output PATH  Export LilyPond source.
  -a, --abc-output PATH   Export ABC notation.
  -r, --reaper-output PATH Export REAPER project (.rpp).
      --rpp-output PATH   Export REAPER project (.rpp).
  -c, --chordpro-output PATH Export ChordPro lead sheet (.cho/.chordpro).
      --cho-output PATH   Export ChordPro lead sheet (.cho/.chordpro).
      --vsq-output PATH   Export vocal track to VOCALOID2 (.vsq) file.
      --vsqx-output PATH  Export vocal track to VOCALOID3/4 (.vsqx) XML file.
      --singer NAME       Vocaloid singer name (defaults to Miku).
  -w, --wav-output PATH   Render portable 16-bit stereo WAV.
      --pdf-output PATH   Render PDF through lilypond.
      --play              Render and play through afplay/aplay.
      --mcp               Run as a stdio Model Context Protocol (MCP) server.
      --install-mcp       Register TMD MCP server in Claude, Cursor, and Gemini configs.
      --install-skills    Install the TMD AI-agent skill.
      --version           Show the version.
  -h, --help              Show this help.
`);
}

export function main(argv = process.argv.slice(2)): number {
  let input: string | undefined, parseOnly = false, play = false, installSkills = false, installMcp = false, runMcp = false, singer = "Miku";
  const outputs: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") { printHelp(); return 0; }
    if (arg === "--version") { console.log(`tmd-ts ${TMD_VERSION}`); return 0; }
    if (arg === "-p" || arg === "--parse-only") { parseOnly = true; continue; }
    if (arg === "--play") { play = true; continue; }
    if (arg === "--mcp") { runMcp = true; continue; }
    if (arg === "--install-mcp") { installMcp = true; continue; }
    if (arg === "--install-skills") { installSkills = true; continue; }
    if (arg === "--singer") { singer = argv[++i] || "Miku"; continue; }
    const option: Record<string, string> = { "-m": "midi", "--midi-output": "midi", "-x": "musicxml", "--musicxml-output": "musicxml", "-l": "lilypond", "--lilypond-output": "lilypond", "-a": "abc", "--abc-output": "abc", "-r": "reaper", "--reaper-output": "reaper", "--rpp-output": "reaper", "-c": "chordpro", "--chordpro-output": "chordpro", "--cho-output": "chordpro", "--vsq-output": "vsq", "--vsqx-output": "vsqx", "-w": "wav", "--wav-output": "wav", "--pdf-output": "pdf" };
    if (option[arg]) { outputs[option[arg]] = argv[++i]; continue; }
    if (!arg.startsWith("-")) input = arg;
    else { console.error(`Unknown option: ${arg}`); return 2; }
  }
  if (runMcp) {
    TmdMcpServer.run().catch((err) => {
      console.error("Fatal error running TMD MCP Server:", err);
      process.exit(1);
    });
    return 0;
  }
  if (installMcp) {
    const results = TmdMcpInstaller.installAll();
    results.forEach(result => console.log(`${result.installed ? "Installed" : "Failed"} TMD MCP config: ${result.path}${result.error ? ` (${result.error})` : ""}`));
    if (!input) return results.every(result => result.installed) ? 0 : 1;
  }
  if (installSkills) {
    const results = TmdSkill.installSkills();
    results.forEach(result => console.log(`${result.installed ? "Installed" : "Failed"} TMD skill: ${result.path}${result.error ? ` (${result.error})` : ""}`));
    if (!input) return results.every(result => result.installed) ? 0 : 1;
  }
  if (!input) { console.error("Error: Missing expected argument '<input-path>'"); return 2; }
  let sheet;
  try { sheet = TmdParser.parseFile(input); }
  catch (error) { console.error(`Error: Could not parse TMD file at ${input}: ${error instanceof Error ? error.message : String(error)}`); return 1; }
  console.log(`tmd-ts ${TMD_VERSION} - In memory of Chen, Chih-Han / aguai (阿怪, 1974–2019).`);
  console.log(`Successfully parsed TMD file: ${input}\n----------------------------------------\n${formatSummary(sheet)}\n----------------------------------------`);
  if (parseOnly) return 0;
  try {
    if (outputs.midi) fs.writeFileSync(outputs.midi, TMDMIDIGenerator.generateMIDI(sheet));
    if (outputs.musicxml) fs.writeFileSync(outputs.musicxml, TMDMusicXMLGenerator.generateMusicXML(sheet));
    if (outputs.lilypond) fs.writeFileSync(outputs.lilypond, TMDLilyPondGenerator.generateLilyPond(sheet));
    if (outputs.abc) fs.writeFileSync(outputs.abc, TMDABCGenerator.generateABC(sheet));
    if (outputs.reaper) fs.writeFileSync(outputs.reaper, TMDReaperGenerator.generateRPP(sheet));
    if (outputs.chordpro) fs.writeFileSync(outputs.chordpro, TMDChordProGenerator.generateChordPro(sheet));
    if (outputs.vsq) fs.writeFileSync(outputs.vsq, TMDVSQGenerator.generateVSQ(sheet, { singerName: singer }));
    if (outputs.vsqx) fs.writeFileSync(outputs.vsqx, TMDVSQXGenerator.generateVSQX(sheet, { singerName: singer }));
    if (outputs.pdf) { const temp = path.join(os.tmpdir(), `tmd-${Date.now()}.ly`); fs.writeFileSync(temp, TMDLilyPondGenerator.generateLilyPond(sheet)); execFileSync("lilypond", ["--pdf", "-o", outputs.pdf.replace(/\.pdf$/, ""), temp], { stdio: "inherit" }); fs.rmSync(temp, { force: true }); }
    if (outputs.wav || play) { const temp = outputs.wav || path.join(os.tmpdir(), `tmd-${Date.now()}.wav`); fs.writeFileSync(temp, TMDWAVRenderer.renderWAV(sheet)); if (play) execFileSync(process.platform === "darwin" ? "afplay" : "aplay", [temp], { stdio: "inherit" }); if (!outputs.wav) fs.rmSync(temp, { force: true }); }
  } catch (error) { console.error(`Error exporting TMD: ${error instanceof Error ? error.message : String(error)}`); return 1; }
  return 0;
}
