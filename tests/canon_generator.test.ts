import { describe, it, expect } from "vitest";
import { TMDCanonGenerator } from "../src/core/canon_gen.js";
import { TmdParser } from "../src/core/parser.js";
import { TMDMeasureChecker } from "../src/core/measure_check.js";
import { TMDPlaybackRenderer } from "../src/core/playback.js";

describe("TMDCanonGenerator (TDD port from canon_gen.py)", () => {
  it("generates a valid macro-based canon in D major", () => {
    const generator = new TMDCanonGenerator({
      title: "My Algorithmic Canon",
      tempo: 64,
      key: "D",
      numVoices: 3,
      offsetBars: 2,
      numVariations: 3,
      mode: "tonal",
      canonType: "standard",
      useMacro: true,
      seed: 42,
    });

    const tmdScore = generator.generate();
    expect(tmdScore).toContain("::SCORE::");
    expect(tmdScore).toContain("** My Algorithmic Canon **");
    expect(tmdScore).toContain("!= 64");
    expect(tmdScore).toContain("?= D");
    expect(tmdScore).toContain("(canon (Theme Var1 Var2) (Violin1 Violin2 Violin3) 2)");

    // Must parse without syntax errors
    const sheet = TmdParser.parse(tmdScore);
    expect(sheet).not.toBeNull();
    expect(sheet.name).toBe("My Algorithmic Canon");

    // Zero measure length errors
    const issues = TMDMeasureChecker.check(tmdScore);
    expect(issues).toEqual([]);

    // Can render playback timeline for voices
    const timelineV1 = TMDPlaybackRenderer.render(sheet, "Violin1");
    expect(timelineV1.events.length).toBeGreaterThan(0);
    const timelineCello = TMDPlaybackRenderer.render(sheet, "Cello");
    expect(timelineCello.events.length).toBeGreaterThan(0);
  });

  it("generates unrolled canon compatible with standard compiler", () => {
    const generator = new TMDCanonGenerator({
      title: "Unrolled Canon",
      tempo: 72,
      key: "Am",
      numVoices: 2,
      offsetBars: 2,
      numVariations: 2,
      mode: "pentatonic",
      useMacro: false,
      seed: 123,
    });

    const tmdScore = generator.generate();
    expect(tmdScore).toContain("canon:Violin1@|+0|{");
    expect(tmdScore).toContain("canon:Violin2@|+2|{");
    expect(tmdScore).toContain("-> intro -> canon -> outro ->#");

    const sheet = TmdParser.parse(tmdScore);
    expect(sheet).not.toBeNull();

    const issues = TMDMeasureChecker.check(tmdScore);
    expect(issues).toEqual([]);
  });

  it("supports crab canon, mirror canon, and table canon forms", () => {
    const crabGen = new TMDCanonGenerator({
      canonType: "crab",
      numVariations: 1,
      seed: 99,
    });
    expect(crabGen.generate()).toContain("(play (reverse Theme) Violin2)");

    const mirrorGen = new TMDCanonGenerator({
      canonType: "mirror",
      numVariations: 1,
      seed: 99,
    });
    expect(mirrorGen.generate()).toContain("(play (flip Theme) Violin2)");

    const tableGen = new TMDCanonGenerator({
      canonType: "table",
      numVariations: 1,
      seed: 99,
    });
    expect(tableGen.generate()).toContain("(play (flip (reverse Theme)) Violin2)");
  });
});
