import { describe, expect, it } from "vitest";
import { TmdParser } from "../src/core/parser.js";
import { formatSheet } from "../src/core/format.js";
import { TMDPlaybackRenderer } from "../src/core/playback.js";

describe("Swift playback parity", () => {
  it("parses and plays + connected notes at the same position", () => {
    const sheet = TmdParser.parse(`::SCORE::
** Multi-note **
!= 120
?= C
<4/4>

A:Piano@|0|{
<4*>
| 1+3 2+4 5 0 |
}

-> A ->#
`);

    const units = sheet.paragraphs[0].sections[0].unitGroups.map((g) => g.units);
    expect(units[0]).toHaveLength(1);
    expect(units[0][0]).toMatchObject({ type: "multiNote" });
    expect(formatSheet(sheet)).toContain("1+3");

    const timeline = TMDPlaybackRenderer.render(sheet, "Piano");
    const notes = timeline.events.filter((event) => event.content.type === "note");
    expect(notes).toHaveLength(5);
    expect(notes.filter((event) => event.position === 0)).toHaveLength(2);
    expect(notes.filter((event) => event.position === 1)).toHaveLength(2);
  });

  it("merges all same-section paragraphs and preserves staggered starts", () => {
    const sheet = TmdParser.parse(`::SCORE::
** Merged sections **
!= 120
?= C
<4/4>

A:Piano@|0|{
<4*>
| 1 1 1 1 |
}

A:Piano@|1|{
<4*>
| 5 5 5 5 |
}

-> A ->#
`);

    const timeline = TMDPlaybackRenderer.render(sheet, "Piano");
    const notes = timeline.events.filter((event) => event.content.type === "note");
    expect(notes).toHaveLength(8);
    expect(notes.slice(0, 4).map((event) => event.position)).toEqual([0, 1, 2, 3]);
    expect(notes.slice(4).map((event) => event.position)).toEqual([4, 5, 6, 7]);
  });

  it("normalizes a negative pickup globally while retaining later section content", () => {
    const sheet = TmdParser.parse(`::SCORE::
** Pickup **
!= 120
?= C
<4/4>

A:Piano@|-1|{
<4*>
| 1 1 1 1 |
}

A:Piano@|0|{
<4*>
| 5 5 5 5 |
}

-> A ->#
`);

    const timeline = TMDPlaybackRenderer.render(sheet, "Piano");
    const notes = timeline.events.filter((event) => event.content.type === "note");
    expect(notes).toHaveLength(8);
    expect(notes.slice(0, 4).map((event) => event.position)).toEqual([0, 1, 2, 3]);
    expect(notes.slice(4).map((event) => event.position)).toEqual([4, 5, 6, 7]);
  });
});
