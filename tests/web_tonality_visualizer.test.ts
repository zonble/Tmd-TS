import { describe, expect, it } from "vitest";
import { TmdParser } from "../src/core/parser.js";
import { TMDSongInspector } from "../src/core/inspector.js";
import { renderTonalityProfileHtml } from "../web/src/ui/tonality.js";

describe("Web Studio tonality visualization", () => {
  it("renders the same inspector-level tonality details as the VSCode view", () => {
    const sheet = TmdParser.parse(`::SCORE::
** Tonality UI **
!= 120
?= C
<4/4>

verse:Piano@|0|{
    <4*>
    1 3 5 1^
    [C] - [G] -
}

-> verse ->#
`);
    const profile = TMDSongInspector.inspect(sheet!, undefined, "en");
    const html = renderTonalityProfileHtml(profile.tonality!, "en", profile.timing.sections);

    expect(html).toContain("tonality-stability-badge");
    expect(html).toContain("Clean major tonality");
    expect(html).toContain("Modulation Journey");
    expect((html.match(/class=\"pitch-bar-col\"/g) || []).length).toBe(12);
    expect(html).toContain("Do");
    expect(html).toContain("Best Fit Keys (K-S)");
    expect(html).toContain("Circle of Fifths Trajectory");
    expect(html).toContain("Detailed Theoretical Analysis");
    expect(html).toContain("tonality-timeline");
    expect((html.match(/class=\"timeline-segment\"/g) || []).length).toBe(1);
    expect(html).toContain("verse");
  });
});
