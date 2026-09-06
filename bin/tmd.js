#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let tmd;
try {
  tmd = require('../dist/index.js');
} catch (e) {
  try {
    tmd = require('../src/index.js');
  } catch (err) {
    console.error('Error: Could not load TMD library:', err.message);
    process.exit(1);
  }
}

const {
  TmdParser,
  formatSummary,
  TMDABCGenerator,
  TMDLilyPondGenerator,
  TMDMusicXMLGenerator,
  TMDMIDIGenerator,
  TMDWAVRenderer,
  TmdSkill,
} = tmd;

const args = process.argv.slice(2);

function printHelp() {
  console.log(`OVERVIEW: A compiler and toolkit for the TMD (Timebase Mark Down) music markup language.

In memory of Chen, Chih-Han / aguai (阿怪, 1974–2019).
Original project: https://github.com/aguai/TMDLang

USAGE: tmd [<options>] [<input-path>]

ARGUMENTS:
  <input-path>            Path to the .tmd file to process.

OPTIONS:
  -p, --parse-only        Only parse and display the score structure summary.
  -m, --midi-output <path>
                          Export to MIDI file at the specified path.
  -x, --musicxml-output <path>
                          Export to MusicXML file at the specified path.
  -l, --lilypond-output <path>
                          Export to LilyPond (.ly) file at the specified path.
  -a, --abc-output <path> Export to ABC notation (.abc) file at the specified path.
  --pdf-output <path>     Render PDF score using lilypond compiler.
  -w, --wav-output <path> Render WAV audio at the specified path.
  --play                  Render a temporary WAV and play it.
  --install-skills        Install the TMD skill for local AI agents.
  --version               Show the version.
  -h, --help              Show help information.
`);
}

let inputPath = null;
let parseOnly = false;
let midiOutput = null;
let musicxmlOutput = null;
let lilypondOutput = null;
let abcOutput = null;
let pdfOutput = null;
let wavOutput = null;
let play = false;
let installSkills = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-h' || arg === '--help') {
    printHelp();
    process.exit(0);
  } else if (arg === '--version') {
    console.log('tmd-ts 0.1.0');
    process.exit(0);
  } else if (arg === '-p' || arg === '--parse-only') {
    parseOnly = true;
  } else if (arg === '-m' || arg === '--midi-output') {
    midiOutput = args[++i];
  } else if (arg === '-x' || arg === '--musicxml-output') {
    musicxmlOutput = args[++i];
  } else if (arg === '-l' || arg === '--lilypond-output') {
    lilypondOutput = args[++i];
  } else if (arg === '-a' || arg === '--abc-output') {
    abcOutput = args[++i];
  } else if (arg === '--pdf-output') {
    pdfOutput = args[++i];
  } else if (arg === '-w' || arg === '--wav-output') {
    wavOutput = args[++i];
  } else if (arg === '--play') {
    play = true;
  } else if (arg === '--install-skills') {
    installSkills = true;
  } else if (!arg.startsWith('-')) {
    inputPath = arg;
  }
}

if (installSkills) {
  const results = TmdSkill.installSkills();
  results.forEach(result => console.log(`${result.installed ? 'Installed' : 'Failed'} TMD skill: ${result.path}${result.error ? ` (${result.error})` : ''}`));
  if (!inputPath) process.exit(results.some(result => !result.installed) ? 1 : 0);
}

if (!inputPath) {
  console.error("Error: Missing expected argument '<input-path>'");
  console.error("Use --help for usage information.");
  process.exit(1);
}

let content;
try {
  content = fs.readFileSync(inputPath, 'utf8');
} catch (err) {
  console.error(`Error: Could not read file at ${inputPath}: ${err.message}`);
  process.exit(1);
}

let sheet;
try {
  sheet = TmdParser.parse(content);
} catch (err) {
  console.error(`Error: Could not parse TMD file at ${inputPath}: ${err.message}`);
  process.exit(1);
}

console.log('tmd-ts v0.1.0 - In memory of Chen, Chih-Han / aguai (阿怪, 1974–2019).');
console.log(`Successfully parsed TMD file: ${inputPath}`);
console.log('----------------------------------------');
console.log(formatSummary(sheet));
console.log('----------------------------------------');

if (parseOnly) {
  process.exit(0);
}

if (midiOutput) {
  try {
    const bytes = TMDMIDIGenerator.generateMIDI(sheet);
    fs.writeFileSync(midiOutput, Buffer.from(bytes));
    console.log(`MIDI exported successfully to ${midiOutput} (${bytes.length} bytes)`);
  } catch (err) {
    console.error(`Error saving MIDI to ${midiOutput}: ${err.message}`);
    process.exit(1);
  }
}

if (musicxmlOutput) {
  try {
    const xml = TMDMusicXMLGenerator.generateMusicXML(sheet);
    fs.writeFileSync(musicxmlOutput, xml, 'utf8');
    console.log(`MusicXML exported successfully to ${musicxmlOutput} (${Buffer.byteLength(xml, 'utf8')} bytes)`);
  } catch (err) {
    console.error(`Error saving MusicXML to ${musicxmlOutput}: ${err.message}`);
    process.exit(1);
  }
}

if (lilypondOutput) {
  try {
    const ly = TMDLilyPondGenerator.generateLilyPond(sheet);
    fs.writeFileSync(lilypondOutput, ly, 'utf8');
    console.log(`LilyPond exported successfully to ${lilypondOutput} (${Buffer.byteLength(ly, 'utf8')} bytes)`);
  } catch (err) {
    console.error(`Error saving LilyPond file to ${lilypondOutput}: ${err.message}`);
    process.exit(1);
  }
}

if (abcOutput) {
  try {
    const abc = TMDABCGenerator.generateABC(sheet);
    fs.writeFileSync(abcOutput, abc, 'utf8');
    console.log(`ABC exported successfully to ${abcOutput} (${Buffer.byteLength(abc, 'utf8')} bytes)`);
  } catch (err) {
    console.error(`Error saving ABC file to ${abcOutput}: ${err.message}`);
    process.exit(1);
  }
}

if (pdfOutput) {
  try {
    const tmpLy = path.join(require('os').tmpdir(), `tmd_${Date.now()}.ly`);
    const ly = TMDLilyPondGenerator.generateLilyPond(sheet);
    fs.writeFileSync(tmpLy, ly, 'utf8');
    const pdfBase = pdfOutput.endsWith('.pdf') ? pdfOutput.slice(0, -4) : pdfOutput;
    execFileSync('lilypond', ['--pdf', '-o', pdfBase, tmpLy], { stdio: 'inherit' });
    console.log(`PDF rendered successfully via LilyPond to ${pdfOutput}`);
    try { fs.unlinkSync(tmpLy); } catch (_) {}
  } catch (err) {
    console.error(`Error rendering PDF to ${pdfOutput}: ${err.message}`);
    process.exit(1);
  }
}

if (wavOutput || play) {
  try {
    const output = wavOutput || path.join(require('os').tmpdir(), `tmd_${Date.now()}.wav`);
    const bytes = TMDWAVRenderer.renderWAV(sheet);
    fs.writeFileSync(output, Buffer.from(bytes));
    if (wavOutput) console.log(`WAV exported successfully to ${wavOutput} (${bytes.length} bytes)`);
    if (play) execFileSync(process.platform === 'darwin' ? 'afplay' : 'aplay', [output], { stdio: 'inherit' });
    if (!wavOutput) try { fs.unlinkSync(output); } catch (_) {}
  } catch (err) {
    console.error(`Error rendering WAV audio: ${err.message}`);
    process.exit(1);
  }
}
