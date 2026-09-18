import { describe, it, expect } from "vitest";
import {
  TMDRefactor,
  TMDMeasureChecker,
  TMDMeasureIssue,
  TmdParser,
} from "../src/index.js";

describe("TMDRefactor (TDD)", () => {
  it("formats TMD document preserving comments and normalizing layout", () => {
    const input = `::SCORE::
/* Header Comment */
** My Song **
!=   120
?=  C
<4/4>

intro:Piano@|0|{
<4*>
|[1]  -   |   -  [7,]   |  /* bar comment */
1   2   3   4
(1' 2,  3^ 4_)%(--)
}

-> intro   ->#
`;

    const formatted = TMDRefactor.format(input);
    expect(formatted).toContain("/* Header Comment */");
    expect(formatted).toContain("/* bar comment */");
    expect(formatted).toContain("intro:Piano@|0|{");
    expect(formatted).toContain("    <4*>");
    expect(formatted).toContain("    | [1] - | - [7,] |");
    expect(formatted).toContain("    1 2 3 4");
    expect(formatted).toContain("    (1' 2, 3^ 4_)%(--)");
    expect(formatted).toContain("}");
    expect(formatted).toContain("-> intro ->#");

    const origSheet = TmdParser.parse(input);
    const newSheet = TmdParser.parse(formatted);
    expect(origSheet.name).toBe(newSheet.name);
    expect(origSheet.paragraphs.length).toBe(newSheet.paragraphs.length);
    expect(origSheet.orders.length).toBe(newSheet.orders.length);
  });

  it("renames instrument across paragraphs in TMD document", () => {
    const input = `::SCORE::
** Test Song **
!= 120
?= C
<4/4>

intro:Piano@|0|{
<4*>
1 2 3 4
}

verse:Guitar@|0|{
<4*>
[C] - - -
}

outro:Piano@|0|{
<4*>
5 6 7 1^
}

-> intro -> verse -> outro ->#
`;

    const result = TMDRefactor.renameInstrument(input, "Piano", "GrandPiano");
    expect(result).toContain("intro:GrandPiano@|0|{");
    expect(result).toContain("outro:GrandPiano@|0|{");
    expect(result).toContain("verse:Guitar@|0|{");
    expect(result).not.toContain(":Piano@");

    const sheet = TmdParser.parse(result);
    expect(sheet.paragraphs[0].instrument).toBe("GrandPiano");
    expect(sheet.paragraphs[1].instrument).toBe("Guitar");
    expect(sheet.paragraphs[2].instrument).toBe("GrandPiano");
  });

  it("renames section in TMD document updating paragraphs and orders", () => {
    const input = `::SCORE::
** Test Song **
!= 120
?= C
<4/4>

intro:Piano@|0|{
<4*>
1 2 3 4
}

verse:Piano@|0|{
<4*>
1 3 5 1^
}

verse:Bass@|0|{
<4*>
1_ - - -
}

-> intro -> verse -> {?+2} -> verse ->#
`;

    const result = TMDRefactor.renameSection(input, "verse", "A");
    expect(result).toContain("intro:Piano@|0|{");
    expect(result).toContain("A:Piano@|0|{");
    expect(result).toContain("A:Bass@|0|{");
    expect(result).not.toContain("verse:Piano@");
    expect(result).not.toContain("verse:Bass@");
    expect(result).toContain("-> intro -> A -> {?+2} -> A ->#");

    const sheet = TmdParser.parse(result);
    expect(sheet.paragraphs[1].name).toBe("A");
    expect(sheet.paragraphs[2].name).toBe("A");
    expect(sheet.orders).toEqual([
      { type: "name", name: "intro" },
      { type: "name", name: "A" },
      { type: "relative", value: "+2" },
      { type: "name", name: "A" },
    ]);
  });

  it("extracts instrument tracks into a new TMD document", () => {
    const input = `::SCORE::
** Full Band Song **
!= 130
?= G
<4/4>
~ "Composer: Alice"

intro:Piano@|0|{
<4*>
1 2 3 4
}

intro:Bass@|0|{
<4*>
1_ - - -
}

verse:Piano@|0|{
<4*>
3 4 5 6
}

verse:Drums@|0|{
<4*>
XsTt
}

-> intro -> verse ->#
`;

    const extracted = TMDRefactor.extractInstrument(input, "Piano");
    expect(extracted).toContain("** Full Band Song **");
    expect(extracted).toContain("!= 130");
    expect(extracted).toContain("?= G");
    expect(extracted).toContain("<4/4>");
    expect(extracted).toContain("intro:Piano@|0|{");
    expect(extracted).toContain("verse:Piano@|0|{");
    expect(extracted).not.toContain(":Bass@");
    expect(extracted).not.toContain(":Drums@");
    expect(extracted).toContain("-> intro -> verse ->#");

    const sheet = TmdParser.parse(extracted);
    expect(sheet.name).toBe("Full Band Song");
    expect(sheet.paragraphs.length).toBe(2);
    expect(sheet.paragraphs.every((p) => p.instrument === "Piano")).toBe(true);
    expect(sheet.orders).toEqual([
      { type: "name", name: "intro" },
      { type: "name", name: "verse" },
    ]);
  });
});

describe("TMDMeasureChecker (TDD)", () => {
  it("reports no errors for valid measures", () => {
    const input = `::SCORE::
** Valid Song **
!= 120
?= C
<4/4>

verse:Piano@|0|{
    <4*>
    | 1 2 3 4 |
    | 1 2 3 4 |
    | [C] - - - |
}

-> verse ->#
`;

    const issues = TMDMeasureChecker.check(input);
    expect(issues).toHaveLength(0);
  });

  it("reports measure issue with incorrect beats", () => {
    const input = `::SCORE::
** Mismatched Measure Song **
!= 120
?= C
<4/4>

verse:Piano@|0|{
    <4*>
    | 1 2 3 4 |
    | 1 2 3 |
    | 1 2 3 4 5 |
}

-> verse ->#
`;

    const issues = TMDMeasureChecker.check(input);
    expect(issues).toHaveLength(2);

    expect(issues[0].actualUnits).toBe(3);
    expect(issues[0].expectedUnits).toBe(4);
    expect(issues[0].paragraphName).toBe("verse");
    expect(issues[0].instrument).toBe("Piano");
    expect(issues[0].measureIndex).toBe(2);

    expect(issues[1].actualUnits).toBe(5);
    expect(issues[1].expectedUnits).toBe(4);
    expect(issues[1].measureIndex).toBe(3);
  });

  it("allows pickup measure at start with negative start offset", () => {
    const input = `::SCORE::
** Song with Pickup **
!= 120
?= C
<4/4>

verse:Piano@|-1|{
    <4*>
    | 5 |
    | 1 2 3 4 |
    | 1 2 3 4 |
}

-> verse ->#
`;

    const issues = TMDMeasureChecker.check(input);
    expect(issues).toHaveLength(0);
  });

  it("checks sixteenth note grid measure consistency", () => {
    const input = `::SCORE::
** 16th Note Song **
!= 120
?= C
<4/4>

verse:Piano@|0|{
    <16*>
    | 1- 1- 1- 1- 1- 1- 1- 1- |
    | 1 2 3 4 |
}

-> verse ->#
`;

    const issues = TMDMeasureChecker.check(input);
    expect(issues).toHaveLength(1);
    expect(issues[0].expectedUnits).toBe(16);
    expect(issues[0].actualUnits).toBe(4);
    expect(issues[0].measureIndex).toBe(2);
  });

  it("reports section instrument length mismatch", () => {
    const input = `::SCORE::
** Mismatched Section Length Song **
!= 120
?= C
<4/4>

verse:Piano@|0|{
    <4*>
    | 1 2 3 4 |
    | 1 2 3 4 |
    | 1 2 3 4 |
    | 1 2 3 4 |
}

verse:Bass@|0|{
    <4*>
    | 1 - - - |
    | 1 - - - |
}

-> verse ->#
`;

    const issues = TMDMeasureChecker.check(input);
    const sectionIssues = issues.filter((i) => i.measureIndex === 0);
    expect(sectionIssues).toHaveLength(1);
    const issue = sectionIssues[0];
    expect(issue.paragraphName).toBe("verse");
    expect(issue.instrument).toBe("Bass");
    expect(issue.expectedUnits).toBe(4);
    expect(issue.actualUnits).toBe(2);
    expect(issue.description).toContain("Expected 4 measures");
    expect(issue.description).toContain("found 2 measures");
  });

  it("handles section instrument length with delayed start", () => {
    const input = `::SCORE::
** Delayed Start Section Song **
!= 120
?= C
<4/4>

verse:Piano@|0|{
    <4*>
    | 1 2 3 4 |
    | 1 2 3 4 |
    | 1 2 3 4 |
    | 1 2 3 4 |
}

verse:Chorus@|+2|{
    <4*>
    | 1 2 3 4 |
    | 1 2 3 4 |
}

-> verse ->#
`;

    const issues = TMDMeasureChecker.check(input);
    expect(issues).toHaveLength(0);
  });

  it("handles section instrument length with pickup start", () => {
    const input = `::SCORE::
** Pickup Section Song **
!= 120
?= C
<4/4>

verse:Vocal@|-1|{
    <4*>
    | 5 |
    | 1 2 3 4 |
    | 1 2 3 4 |
    | 1 2 3 4 |
    | 1 2 3 4 |
}

verse:Piano@|0|{
    <4*>
    | 1 2 3 4 |
    | 1 2 3 4 |
    | 1 2 3 4 |
    | 1 2 3 4 |
}

-> verse ->#
`;

    const issues = TMDMeasureChecker.check(input);
    expect(issues).toHaveLength(0);
  });
});

describe("TMD CLI subcommands check, format, and refactor (TDD)", () => {
  it("runs check subcommand on valid and invalid TMD files", async () => {
    const { main } = await import("../src/cli.js");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");

    const tempDir = mkdtempSync(join(tmpdir(), "tmd-cli-check-test-"));
    try {
      const goodFile = join(tempDir, "good.tmd");
      writeFileSync(goodFile, `::SCORE::\n** Good **\n!= 120\n?= C\n<4/4>\nverse:Piano@|0|{\n<4*>\n| 1 2 3 4 |\n}\n-> verse ->#\n`);

      const badFile = join(tempDir, "bad.tmd");
      writeFileSync(badFile, `::SCORE::\n** Bad **\n!= 120\n?= C\n<4/4>\nverse:Piano@|0|{\n<4*>\n| 1 2 3 |\n}\n-> verse ->#\n`);

      expect(main(["check", goodFile])).toBe(0);
      expect(main(["check", badFile])).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("runs format subcommand with output option and in-place flag", async () => {
    const { main } = await import("../src/cli.js");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");

    const tempDir = mkdtempSync(join(tmpdir(), "tmd-cli-format-test-"));
    try {
      const file = join(tempDir, "score.tmd");
      const out = join(tempDir, "formatted.tmd");
      const unformatted = `::SCORE::\n** Subcommand Test **\n!=   100\n?=  D\n<4/4>\nverse:Violin@|0|{\n<4*>\n1   2   3   4\n}\n-> verse ->#\n`;
      writeFileSync(file, unformatted);

      expect(main(["format", file, "-o", out])).toBe(0);
      const formatted = readFileSync(out, "utf-8");
      expect(formatted).toContain("!= 100");
      expect(formatted).toContain("1 2 3 4");

      expect(main(["format", file, "-i"])).toBe(0);
      const inPlace = readFileSync(file, "utf-8");
      expect(inPlace).toContain("!= 100");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("runs refactor subcommands: rename-instrument, rename-section, extract-instrument", async () => {
    const { main } = await import("../src/cli.js");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");

    const tempDir = mkdtempSync(join(tmpdir(), "tmd-cli-refactor-test-"));
    try {
      const file = join(tempDir, "score.tmd");
      const outExtract = join(tempDir, "extracted.tmd");
      const score = `::SCORE::\n** Song **\n!= 120\n?= C\n<4/4>\nverse:Violin@|0|{\n<4*>\n1 2 3 4\n}\nverse:Cello@|0|{\n<4*>\n1_ - - -\n}\n-> verse ->#\n`;
      writeFileSync(file, score);

      // rename-instrument
      expect(main(["refactor", "rename-instrument", file, "--from", "Violin", "--to", "Fiddle", "-i"])).toBe(0);
      let content = readFileSync(file, "utf-8");
      expect(content).toContain("verse:Fiddle@|0|{");
      expect(content).not.toContain("verse:Violin@");

      // rename-section
      expect(main(["refactor", "rename-section", file, "--from", "verse", "--to", "Chorus", "-i"])).toBe(0);
      content = readFileSync(file, "utf-8");
      expect(content).toContain("Chorus:Fiddle@|0|{");
      expect(content).toContain("Chorus:Cello@|0|{");
      expect(content).toContain("-> Chorus ->#");

      // extract-instrument
      expect(main(["refactor", "extract-instrument", file, "--instrument", "Cello", "-o", outExtract])).toBe(0);
      const extracted = readFileSync(outExtract, "utf-8");
      expect(extracted).toContain("Chorus:Cello@|0|{");
      expect(extracted).not.toContain("Fiddle");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

