import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

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
});
