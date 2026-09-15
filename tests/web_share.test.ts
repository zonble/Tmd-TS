import { describe, it, expect } from "vitest";
import { encodeShareHash, decodeShareHash, MAX_SHARED_CHARS } from "../web/src/share.js";
import { escapeHtml } from "../web/src/html.js";

const ZELDA = `::SCORE::
** Zelda's Lullaby **
!= 100
?= C
<4/4>

lullaby:ocarina@|0|{
    <4*>
    7_ - 2 6_ - (5_6_)%(-) 7_ - 2 6_ - 0
    2^ - (1^ 7 1^ 7)%(--) 5 -
}

-> lullaby -> lullaby ->#
`;

describe("Share by URL hash", () => {
  it("round-trips a score, including CJK text, through a URL-safe hash", async () => {
    for (const text of [ZELDA, "::SCORE::\n** 三天三夜 **\n", ""]) {
      const hash = await encodeShareHash(text);
      expect(hash).toMatch(/^#tmd=[A-Za-z0-9_-]*$/);
      expect(await decodeShareHash(hash)).toBe(text);
    }
  });

  it("returns null when the hash is not a share link", async () => {
    expect(await decodeShareHash("")).toBeNull();
    expect(await decodeShareHash("#")).toBeNull();
    expect(await decodeShareHash("#section-2")).toBeNull();
  });

  it("rejects a damaged payload", async () => {
    await expect(decodeShareHash("#tmd=bm90LWRlZmxhdGU")).rejects.toThrow();
    await expect(decodeShareHash("#tmd=***")).rejects.toThrow();
  });

  it("rejects a payload that expands past the size limit", async () => {
    const hash = await encodeShareHash("a".repeat(MAX_SHARED_CHARS + 1));
    expect(hash.length).toBeLessThan(5000);
    await expect(decodeShareHash(hash)).rejects.toThrow(/too large/);
  });
});

describe("escapeHtml", () => {
  it("escapes characters that can start markup or leave an attribute", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;"
    );
    expect(escapeHtml(42)).toBe("42");
  });
});
