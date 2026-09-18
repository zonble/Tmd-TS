import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { zhTW } from "../web/src/locales/zh-TW.js";
import { en } from "../web/src/locales/en.js";

describe("Web UI Tools, Refactoring & Problems Panel (TDD)", () => {
  it("defines i18n labels for Tools menu, modals, and problems panel in zh-TW and en", () => {
    // Tools dropdown
    expect((zhTW as any).btnToolsMenuTitle).toBeDefined();
    expect((zhTW as any).btnToolsText).toBeDefined();
    expect((en as any).btnToolsMenuTitle).toBeDefined();
    expect((en as any).btnToolsText).toBeDefined();

    // Tool actions
    expect((zhTW as any).toolFormatDocument).toBeDefined();
    expect((en as any).toolFormatDocument).toBeDefined();
    expect((zhTW as any).toolDoubleGrid).toBeDefined();
    expect((en as any).toolDoubleGrid).toBeDefined();
    expect((zhTW as any).toolHalveGrid).toBeDefined();
    expect((en as any).toolHalveGrid).toBeDefined();
    expect((zhTW as any).toolRenameInstrument).toBeDefined();
    expect((en as any).toolRenameInstrument).toBeDefined();
    expect((zhTW as any).toolRenameSection).toBeDefined();
    expect((en as any).toolRenameSection).toBeDefined();
    expect((zhTW as any).toolExtractInstrument).toBeDefined();
    expect((en as any).toolExtractInstrument).toBeDefined();
    expect((zhTW as any).toolDuplicateTrack).toBeDefined();
    expect((en as any).toolDuplicateTrack).toBeDefined();
    expect((zhTW as any).toolGenerateHarmony).toBeDefined();
    expect((en as any).toolGenerateHarmony).toBeDefined();
    expect((zhTW as any).toolInlineOrders).toBeDefined();
    expect((en as any).toolInlineOrders).toBeDefined();

    // Problems Panel
    expect((zhTW as any).problemsPanelTitle).toBeDefined();
    expect((zhTW as any).problemsAllValid).toBeDefined();
    expect((zhTW as any).problemsCount).toBeDefined();
    expect((en as any).problemsPanelTitle).toBeDefined();
    expect((en as any).problemsAllValid).toBeDefined();
    expect((en as any).problemsCount).toBeDefined();
  });

  it("includes Tools dropdown and Problems panel in web/index.html", () => {
    const htmlPath = path.join(__dirname, "../web/index.html");
    const html = fs.readFileSync(htmlPath, "utf-8");

    // Tools dropdown
    expect(html).toContain('id="tools-dropdown"');
    expect(html).toContain('id="btn-tools-menu"');
    expect(html).toContain('id="tool-format-document"');
    expect(html).toContain('id="tool-double-grid"');
    expect(html).toContain('id="tool-halve-grid"');
    expect(html).toContain('id="tool-duplicate-track"');
    expect(html).toContain('id="tool-generate-harmony"');
    expect(html).toContain('id="tool-inline-orders"');
    expect(html).toContain('id="tool-rename-instrument"');
    expect(html).toContain('id="tool-rename-section"');
    expect(html).toContain('id="tool-extract-instrument"');

    // Problems panel
    expect(html).toContain('id="problems-panel"');
    expect(html).toContain('id="problems-list"');
    expect(html).toContain('id="problems-count-badge"');
    expect(html).toContain('id="btn-toggle-problems"');

    // Modals for refactoring
    expect(html).toContain('id="refactor-instrument-modal"');
    expect(html).toContain('id="refactor-section-modal"');
    expect(html).toContain('id="refactor-extract-modal"');
    expect(html).toContain('id="refactor-duplicate-modal"');
    expect(html).toContain('id="refactor-harmony-modal"');
  });

  it("binds Tools actions, keyboard shortcut, and problems check in web/src/main.ts", () => {
    const mainPath = path.join(__dirname, "../web/src/main.ts");
    const mainContent = fs.readFileSync(mainPath, "utf-8");

    // TMDRefactor and TMDMeasureChecker imported
    expect(mainContent).toContain("TMDRefactor");
    expect(mainContent).toContain("TMDMeasureChecker");

    // Events bound
    expect(mainContent).toContain("tool-format-document");
    expect(mainContent).toContain("tool-double-grid");
    expect(mainContent).toContain("tool-halve-grid");
    expect(mainContent).toContain("tool-duplicate-track");
    expect(mainContent).toContain("tool-generate-harmony");
    expect(mainContent).toContain("tool-inline-orders");
    expect(mainContent).toContain("tool-rename-instrument");
    expect(mainContent).toContain("tool-rename-section");
    expect(mainContent).toContain("tool-extract-instrument");

    // Problems panel logic
    expect(mainContent).toContain("problems-panel");
    expect(mainContent).toContain("problems-list");
  });

  it("editor.ts supports onFormat hotkey extension (Shift-Alt-F / Shift-Option-F) and getCursorContext()", () => {
    const editorPath = path.join(__dirname, "../web/src/editor.ts");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    expect(editorContent).toContain("onFormat");
    expect(editorContent).toContain("getCursorContext");
  });

  it("includes editor context menu element in web/index.html", () => {
    const htmlPath = path.join(__dirname, "../web/index.html");
    const html = fs.readFileSync(htmlPath, "utf-8");

    expect(html).toContain('id="editor-context-menu"');
    expect(html).toContain('id="ctx-format"');
    expect(html).toContain('id="ctx-double-grid"');
    expect(html).toContain('id="ctx-halve-grid"');
    expect(html).toContain('id="ctx-duplicate-track"');
    expect(html).toContain('id="ctx-generate-harmony"');
    expect(html).toContain('id="ctx-extract-instrument"');
    expect(html).toContain('id="ctx-insert-section"');
    expect(html).toContain('id="ctx-rename-instrument"');
    expect(html).toContain('id="ctx-rename-section"');

    // Section scope controls in duplicate & harmony modals
    expect(html).toContain('id="refactor-dup-scope-section"');
    expect(html).toContain('id="refactor-dup-scope-global"');
    expect(html).toContain('id="refactor-harm-scope-section"');
    expect(html).toContain('id="refactor-harm-scope-global"');
    expect(html).toContain('id="insert-section-modal"');
  });

  it("binds context menu events, snippet insertion, and section-scoped refactor in web/src/main.ts", () => {
    const mainPath = path.join(__dirname, "../web/src/main.ts");
    const mainContent = fs.readFileSync(mainPath, "utf-8");

    expect(mainContent).toContain("editor-context-menu");
    expect(mainContent).toContain("getCursorContext");
    expect(mainContent).toContain("contextmenu");
    expect(mainContent).toContain("refactor-dup-scope-section");
    expect(mainContent).toContain("refactor-harm-scope-section");
    expect(mainContent).toContain("ctx-insert-section");
    expect(mainContent).toContain("insert-section-modal");
  });

  it("supports playing individual section/track from editor line gutter in web/src/editor.ts and main.ts", () => {
    const editorPath = path.join(__dirname, "../web/src/editor.ts");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // editor should support onPlaySection callback and section play gutter
    expect(editorContent).toContain("onPlaySection");
    expect(editorContent).toContain("cm-section-play-btn");

    const mainPath = path.join(__dirname, "../web/src/main.ts");
    const mainContent = fs.readFileSync(mainPath, "utf-8");

    // main.ts should handle onPlaySection and generate/play scoped MIDI
    expect(mainContent).toContain("playSectionOrTrack");
  });
});
