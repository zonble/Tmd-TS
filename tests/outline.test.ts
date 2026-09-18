import { describe, it, expect } from "vitest";
import { TMDOutlineGenerator, TMDOutlineNode } from "../src/core/outline.js";

describe("TMDOutlineGenerator (TDD)", () => {
  it("generates nested outline symbols with sections, tracks, and measures", () => {
    const input = `::SCORE::
** Nested Song **
!= 128
?= G
<4/4>

intro:CHORD@|0|{
    <4*>
    [G] [D] [Em] [C] |
}

intro:Piano@|0|{
    <4*>
    1 2 3 4 |
}

verse:CHORD@|0|{
    <4*>
    [G] - [D] - |
}

-> intro -> verse ->#
`;

    const nodes = TMDOutlineGenerator.generate(input);

    expect(nodes.length).toBe(3);

    // 1. Score node
    const scoreNode = nodes[0];
    expect(scoreNode.name).toBe("Score: Nested Song");
    expect(scoreNode.kind).toBe("class");
    expect(scoreNode.detail).toContain("!= 128");
    expect(scoreNode.detail).toContain("?= G");
    expect(scoreNode.detail).toContain("<4/4>");

    // 2. Sections node
    const sectionsNode = nodes[1];
    expect(sectionsNode.name).toBe("Sections");
    expect(sectionsNode.kind).toBe("namespace");
    expect(sectionsNode.children).toBeDefined();
    expect(sectionsNode.children!.length).toBe(2); // intro, verse

    // Intro section
    const introNode = sectionsNode.children![0];
    expect(introNode.name).toBe("intro");
    expect(introNode.kind).toBe("namespace");
    expect(introNode.children!.length).toBe(2); // CHORD, Piano

    // Track 1: CHORD
    const chordTrack = introNode.children![0];
    expect(chordTrack.name).toBe("CHORD");
    expect(chordTrack.kind).toBe("field");
    expect(chordTrack.children).toBeDefined();
    expect(chordTrack.children!.length).toBe(1);
    expect(chordTrack.children![0].name).toBe("Measure 1");
    expect(chordTrack.children![0].detail).toBe("[G] [D] [Em] [C]");

    // Track 2: Piano
    const pianoTrack = introNode.children![1];
    expect(pianoTrack.name).toBe("Piano");
    expect(pianoTrack.kind).toBe("field");
    expect(pianoTrack.children).toBeDefined();
    expect(pianoTrack.children!.length).toBe(1);
    expect(pianoTrack.children![0].name).toBe("Measure 1");
    expect(pianoTrack.children![0].detail).toBe("1 2 3 4");

    // Verse section
    const verseNode = sectionsNode.children![1];
    expect(verseNode.name).toBe("verse");
    expect(verseNode.children!.length).toBe(1); // CHORD
    const verseChord = verseNode.children![0];
    expect(verseChord.name).toBe("CHORD");
    expect(verseChord.children!.length).toBe(1);
    expect(verseChord.children![0].name).toBe("Measure 1");
    expect(verseChord.children![0].detail).toBe("[G] - [D] -");

    // 3. Orders node
    const ordersNode = nodes[2];
    expect(ordersNode.name).toBe("Orders");
    expect(ordersNode.kind).toBe("event");
    expect(ordersNode.children!.length).toBe(2);
    expect(ordersNode.children![0].name).toBe("intro");
    expect(ordersNode.children![1].name).toBe("verse");
  });

  it("supports CLI outline subcommand with --json", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { main } = await import("../src/cli.js");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmd-outline-test-"));
    const tmpFile = path.join(tmpDir, "test.tmd");
    fs.writeFileSync(
      tmpFile,
      `::SCORE::
** CLI Outline **
!= 120
?= C
<4/4>

intro:Piano@|0|{
<4*>
1 2 3 4 |
}
-> intro ->#
`,
      "utf-8"
    );

    let output = "";
    const originalLog = console.log;
    console.log = (msg: any) => {
      output += msg + "\n";
    };

    try {
      const exitCode = main(["outline", "--json", tmpFile]);
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(output);
      expect(parsed.length).toBe(3);
      expect(parsed[0].name).toBe("Score: CLI Outline");
    } finally {
      console.log = originalLog;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
