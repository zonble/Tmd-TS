import {
  Note,
  Unit,
  UnitGroup,
  Section,
  SectionDirective,
  Paragraph,
  Order,
  Sheet,
  Accidental
} from "./types";

export function formatNote(note: Note): string {
  let str = `${note.degree}`;
  if (note.accidental === Accidental.Sharp) str += "'";
  else if (note.accidental === Accidental.Flat) str += ",";

  if (note.octave > 0) str += "^".repeat(note.octave);
  else if (note.octave < 0) str += "_".repeat(-note.octave);

  return str;
}

export function formatUnit(unit: Unit): string {
  switch (unit.type) {
    case "note":
      return formatNote(unit.note);
    case "chord":
      return `[${unit.chord.toString()}]`;
    case "tie":
      return "-";
    case "rest":
      return "0";
    case "percussion":
      return unit.pattern;
  }
}

export function formatUnitGroup(group: UnitGroup): string {
  if (group.units.length === 1 && group.length === 1) {
    return formatUnit(group.units[0]);
  }
  const unitsStr = group.units.map(formatUnit).join("");
  const lenStr = "-".repeat(group.length);
  return `(${unitsStr})%(${lenStr})`;
}

export function formatSectionDirective(dir: SectionDirective): string {
  const k = dir.kind;
  switch (k.type) {
    case "tempo":
      return `{!=${Number.isInteger(k.bpm) ? k.bpm : k.bpm}}`;
    case "relativeTempo":
      return `{!+${k.deltaBpm}}`;
    case "absoluteKey":
      return `{?=${k.key}}`;
    case "relativeKey":
      return `{?${k.semitones >= 0 ? "+" + k.semitones : k.semitones}}`;
    case "timeSignature":
      return `{<${k.beat.count}/${k.beat.noteValue}>}`;
  }
}

export function formatSection(sec: Section): string {
  let result = `\t<${sec.noteLength}*>`;
  let counter = 0;
  let dirIdx = 0;
  const sortedDirs = [...sec.directives].sort((a, b) => a.position - b.position);

  function appendDirs(pos: number) {
    while (dirIdx < sortedDirs.length && sortedDirs[dirIdx].position === pos) {
      result += `${formatSectionDirective(sortedDirs[dirIdx])} `;
      dirIdx++;
    }
  }

  let curPos = 0;
  appendDirs(curPos);

  for (const group of sec.unitGroups) {
    if (counter % 8 === 0 || counter >= 8) {
      result += "\n\t";
      counter = 0;
    }
    result += `${formatUnitGroup(group)} `;
    counter += group.length;
    curPos += group.length;
    appendDirs(curPos);
  }

  while (dirIdx < sortedDirs.length) {
    result += `${formatSectionDirective(sortedDirs[dirIdx])} `;
    dirIdx++;
  }

  result += "\n\n";
  return result;
}

export function formatParagraph(p: Paragraph): string {
  if (p.showProgram) {
    const time = p.executionTime ?? "";
    return `${p.name}:${p.instrument}@${time}{\n"""${p.showProgram}"""\n}\n\n`;
  }

  let result = `${p.name}:${p.instrument}@|`;
  if (p.start > 0) result += `+${p.start}`;
  else result += `${p.start}`;
  result += "|{\n";

  for (const sec of p.sections) {
    result += formatSection(sec);
  }
  result += "}\n\n";
  return result;
}

export function formatOrder(order: Order): string {
  switch (order.type) {
    case "name": return order.name;
    case "relative": return `{?${order.value}}`;
    case "absolute": return `{?=${order.value}}`;
  }
}

export function formatSheet(sheet: Sheet): string {
  let result = "";
  result += "::SCORE::\n";
  result += `** ${sheet.name} **\n`;
  result += `!=${Number.isInteger(sheet.speed) ? sheet.speed : sheet.speed}\n`;
  result += `?=${sheet.keySignature.toString()}\n`;
  result += `<${sheet.beat.count}/${sheet.beat.noteValue}>\n\n`;

  const metaKeys = Object.keys(sheet.metadata).sort();
  for (const k of metaKeys) {
    const val = sheet.metadata[k];
    if (["lyrics", "composer", "arranger"].includes(k.toLowerCase())) {
      result += `~ "${val}"\n`;
    } else {
      result += `=~:__${k.toUpperCase()}__= "${val}"\n`;
    }
  }
  if (metaKeys.length > 0) result += "\n";

  for (const p of sheet.paragraphs) {
    result += formatParagraph(p);
  }

  let counter = 0;
  for (const order of sheet.orders) {
    result += `-> ${formatOrder(order)} `;
    counter++;
    if (counter % 4 === 0) result += "\n";
  }
  result += "->#\n";
  return result;
}

export function formatSummary(sheet: Sheet): string {
  const lines: string[] = [];
  lines.push(`Name:         ${sheet.name}`);
  lines.push(`Speed:        ${sheet.speed} BPM`);
  lines.push(`KeySignature: ${sheet.keySignature.toString()}`);
  lines.push(`Beat:         ${sheet.beat.count}/${sheet.beat.noteValue}`);
  lines.push(`Paragraphs:   ${sheet.paragraphs.length}`);

  sheet.paragraphs.forEach((p, idx) => {
    const secCount = p.sections.length;
    const totalUnits = p.sections.reduce((acc, s) => acc + s.unitGroups.length, 0);
    lines.push(`  [${idx + 1}] ${p.name} (Instrument: ${p.instrument}, Start: ${p.start}, Sections: ${secCount}, UnitGroups: ${totalUnits})`);
  });

  lines.push(`Orders:       ${sheet.orders.length}`);
  sheet.orders.forEach((order, idx) => {
    lines.push(`  [${idx + 1}] -> ${formatOrder(order)}`);
  });

  return lines.join("\n");
}
