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
});
