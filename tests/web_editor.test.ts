import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { zhTW } from "../web/src/locales/zh-TW.js";
import { en } from "../web/src/locales/en.js";

describe("Web Studio Editor Configuration (TDD)", () => {
  it("allows typing tab by binding indentWithTab in keymap", () => {
    const editorPath = path.join(__dirname, "../web/src/editor.ts");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // Must import indentWithTab
    expect(editorContent).toMatch(/import\s*\{[^}]*indentWithTab[^}]*\}\s*from\s*["']@codemirror\/commands["']/);

    // Must include indentWithTab in keymap extensions
    expect(editorContent).toMatch(/indentWithTab/);
  });

  it("supports highlighting problematic measures with custom styles in editor", () => {
    const editorPath = path.join(__dirname, "../web/src/editor.ts");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // Must expose setMeasureIssues method or decoration effect
    expect(editorContent).toContain("setMeasureIssues");
    expect(editorContent).toContain("cm-measure-issue");

    // Check CSS styling in styles.css
    const cssPath = path.join(__dirname, "../web/src/styles.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    expect(cssContent).toContain(".cm-measure-issue");
  });

  it("displays hover tooltip with error description when hovering over problematic line", () => {
    const editorPath = path.join(__dirname, "../web/src/editor.ts");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // Must import hoverTooltip from @codemirror/view
    expect(editorContent).toMatch(/import\s*\{[^}]*hoverTooltip[^}]*\}\s*from\s*["']@codemirror\/view["']/);

    // Must configure hoverTooltip in editor extensions
    expect(editorContent).toContain("hoverTooltip");
    expect(editorContent).toContain("cm-issue-tooltip");

    // Must define CSS styles for error tooltip in styles.css
    const cssPath = path.join(__dirname, "../web/src/styles.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    expect(cssContent).toContain(".cm-issue-tooltip");
  });

  it("includes comprehensive syntax help for accidentals (1', 2,) and tuplets (1 2)%(-) in Help modal and locales", () => {
    const htmlPath = path.join(__dirname, "../web/index.html");
    const html = fs.readFileSync(htmlPath, "utf-8");

    expect(html).toContain('id="help-modal"');
    expect(html).toContain('data-i18n="helpLiAccidentals"');
    expect(html).toContain('data-i18n="helpLiTuplets"');

    // Check zh-TW
    expect((zhTW as any).helpLiAccidentals).toBeDefined();
    expect((zhTW as any).helpLiAccidentals).toContain("1'");
    expect((zhTW as any).helpLiAccidentals).toContain("2,");
    expect((zhTW as any).helpLiTuplets).toBeDefined();
    expect((zhTW as any).helpLiTuplets).toContain("(1 2)%(-)");
    expect((zhTW as any).helpLiTuplets).toContain("(1 2 3)%(-)");

    // Check en
    expect((en as any).helpLiAccidentals).toBeDefined();
    expect((en as any).helpLiAccidentals).toContain("1'");
    expect((en as any).helpLiAccidentals).toContain("2,");
    expect((en as any).helpLiTuplets).toBeDefined();
    expect((en as any).helpLiTuplets).toContain("(1 2)%(-)");
    expect((en as any).helpLiTuplets).toContain("(1 2 3)%(-)");
  });

  it("binds browser-safe Mod-Shift-F for format hotkey and updates UI labels", () => {
    const editorPath = path.join(__dirname, "../web/src/editor.ts");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // CodeMirror keymap must bind Mod-Shift-f
    expect(editorContent).toContain('"Mod-Shift-f"');

    // Locales must reflect Cmd+Shift+F or Ctrl+Shift+F
    expect((zhTW as any).toolFormatDocument).toContain("Shift+F");
    expect((en as any).toolFormatDocument).toContain("Shift+F");
  });

  it("supports syntax highlighting for abstract paragraphs and S-Expression macros", async () => {
    const { tmdStreamParser } = await import("../web/src/syntax.js");

    const tokenize = (line: string) => {
      const state = tmdStreamParser.startState();
      const tokens: { text: string; type: string | null }[] = [];
      let pos = 0;
      while (pos < line.length) {
        const stream = {
          string: line,
          pos,
          start: pos,
          eatSpace: () => {
            const m = line.slice(pos).match(/^[ \t]+/);
            if (m) {
              pos += m[0].length;
              return true;
            }
            return false;
          },
          match: (pattern: RegExp | string) => {
            const rest = line.slice(pos);
            if (typeof pattern === "string") {
              if (rest.startsWith(pattern)) {
                pos += pattern.length;
                return [pattern];
              }
              return null;
            }
            const m = rest.match(pattern);
            if (m && m.index === 0) {
              pos += m[0].length;
              return m;
            }
            return null;
          },
          next: () => {
            if (pos < line.length) {
              const ch = line[pos];
              pos++;
              return ch;
            }
            return null;
          },
        };
        const before = pos;
        const type = tmdStreamParser.token(stream as any, state as any);
        if (pos > before) {
          tokens.push({ text: line.slice(before, pos), type });
        } else {
          break;
        }
      }
      return tokens;
    };

    // Test 1: Abstract paragraph header `Theme {`
    const pTokens = tokenize("Theme {");
    expect(pTokens.some(t => t.text.includes("Theme") && t.type === "def")).toBe(true);

    // Test 2: S-Expression macro `(canon Theme (V1 V2) 2)`
    const mTokens = tokenize("(canon Theme (V1 V2) 2)");
    expect(mTokens.some(t => t.text === "(" && t.type === "bracket")).toBe(true);
    expect(mTokens.some(t => t.text === "canon" && (t.type === "keyword" || t.type === "builtin"))).toBe(true);
    expect(mTokens.some(t => t.text === "Theme" && t.type === "variableName")).toBe(true);
    expect(mTokens.some(t => t.text === "2" && t.type === "number")).toBe(true);
  });

  it("supports gutter play button and cursor context for default track without instrument", () => {
    const editorPath = path.join(__dirname, "../web/src/editor.ts");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // Gutter marker should support abstract/default paragraphs
    expect(editorContent).toContain("abstractMatch");
    expect(editorContent).toContain("DEFAULT_INSTRUMENT");

    // Cursor context should resolve default track to DEFAULT_INSTRUMENT
    expect(editorContent).toMatch(/instrument\s*=\s*DEFAULT_INSTRUMENT/);
  });
});
