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
    const domPath = path.join(__dirname, "../web/src/ui/dom.ts");
    const domContent = fs.existsSync(domPath) ? fs.readFileSync(domPath, "utf-8") : "";
    const toolsPath = path.join(__dirname, "../web/src/ui/toolsMenu.ts");
    const toolsContent = fs.existsSync(toolsPath) ? fs.readFileSync(toolsPath, "utf-8") : "";
    const problemsPath = path.join(__dirname, "../web/src/ui/problemsPanel.ts");
    const problemsContent = fs.existsSync(problemsPath) ? fs.readFileSync(problemsPath, "utf-8") : "";
    const fullContent = [mainContent, domContent, toolsContent, problemsContent].join("\n");

    expect(fullContent).toContain("TMDRefactor");
    expect(fullContent).toContain("TMDMeasureChecker");

    // Events bound
    expect(fullContent).toContain("tool-format-document");
    expect(fullContent).toContain("tool-double-grid");
    expect(fullContent).toContain("tool-halve-grid");
    expect(fullContent).toContain("tool-duplicate-track");
    expect(fullContent).toContain("tool-generate-harmony");
    expect(fullContent).toContain("tool-inline-orders");
    expect(fullContent).toContain("tool-rename-instrument");
    expect(fullContent).toContain("tool-rename-section");
    expect(fullContent).toContain("tool-extract-instrument");

    // Problems panel logic
    expect(fullContent).toContain("problems-panel");
    expect(fullContent).toContain("problems-list");
  });

  it("editor.ts supports onFormat hotkey extension, toggleComment (Mod-/ and Shift-Alt-A), and getCursorContext()", () => {
    const editorPath = path.join(__dirname, "../web/src/editor.ts");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    expect(editorContent).toContain("onFormat");
    expect(editorContent).toContain("getCursorContext");
    expect(editorContent).toContain("toggleComment");
    expect(editorContent).toContain("commentTokens");
  });

  it("includes editor context menu element in web/index.html", () => {
    const htmlPath = path.join(__dirname, "../web/index.html");
    const html = fs.readFileSync(htmlPath, "utf-8");

    expect(html).toContain('id="editor-context-menu"');
    expect(html).toContain('id="ctx-format"');
    expect(html).toContain('id="ctx-comment"');
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
    const domPath = path.join(__dirname, "../web/src/ui/dom.ts");
    const domContent = fs.existsSync(domPath) ? fs.readFileSync(domPath, "utf-8") : "";
    const toolsPath = path.join(__dirname, "../web/src/ui/toolsMenu.ts");
    const toolsContent = fs.existsSync(toolsPath) ? fs.readFileSync(toolsPath, "utf-8") : "";
    const refactorModalPath = path.join(__dirname, "../web/src/ui/modals/refactorModals.ts");
    const refactorModalContent = fs.existsSync(refactorModalPath) ? fs.readFileSync(refactorModalPath, "utf-8") : "";
    const insertModalPath = path.join(__dirname, "../web/src/ui/modals/insertSectionModal.ts");
    const insertModalContent = fs.existsSync(insertModalPath) ? fs.readFileSync(insertModalPath, "utf-8") : "";
    const fullContent = [mainContent, domContent, toolsContent, refactorModalContent, insertModalContent].join("\n");

    expect(fullContent).toContain("editor-context-menu");
    expect(fullContent).toContain("getCursorContext");
    expect(fullContent).toContain("contextmenu");
    expect(fullContent).toContain("ctx-comment");
    expect(fullContent).toContain("toggleComment");
    expect(fullContent).toContain("refactor-dup-scope-section");
    expect(fullContent).toContain("refactor-harm-scope-section");
    expect(fullContent).toContain("ctx-insert-section");
    expect(fullContent).toContain("insert-section-modal");
  });

  it("supports playing individual section/track from editor line gutter and outline items in web/src/editor.ts and main.ts", () => {
    const editorPath = path.join(__dirname, "../web/src/editor.ts");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // editor should support onPlaySection callback and section play gutter
    expect(editorContent).toContain("onPlaySection");
    expect(editorContent).toContain("cm-section-play-btn");

    const mainPath = path.join(__dirname, "../web/src/main.ts");
    const mainContent = fs.readFileSync(mainPath, "utf-8");
    const inspectorPath = path.join(__dirname, "../web/src/ui/inspector.ts");
    const inspectorContent = fs.existsSync(inspectorPath) ? fs.readFileSync(inspectorPath, "utf-8") : "";
    const playerPath = path.join(__dirname, "../web/src/ui/playerBar.ts");
    const playerContent = fs.existsSync(playerPath) ? fs.readFileSync(playerPath, "utf-8") : "";
    const uiContent = [mainContent, inspectorContent, playerContent].join("\n");

    // main/playerController should handle onPlaySection and generate/play scoped MIDI
    expect(uiContent).toContain("playSectionOrTrack");
    // outline section and track items should have play buttons
    expect(uiContent).toContain("outline-play-btn");
    expect(uiContent).toContain("data-play-section");
    expect(uiContent).toContain("data-play-instrument");
    // inspector playback orders should have play buttons to play from that order index
    expect(uiContent).toContain("order-play-btn");
    expect(uiContent).toContain("data-play-order-index");
    expect(uiContent).toContain("playFromOrderIndex");
  });

  it("supports Humming to TMD section (Spotify Basic Pitch) in web UI and i18n", () => {
    // i18n translations
    expect((zhTW as any).toolHumToTmd).toBeDefined();
    expect((en as any).toolHumToTmd).toBeDefined();
    expect((zhTW as any).humModalTitle).toBeDefined();
    expect((en as any).humModalTitle).toBeDefined();

    expect((zhTW as any).humKeyAuto).toBeDefined();
    expect((en as any).humKeyAuto).toBeDefined();

    // index.html modal, metronome controls, and menu buttons
    const htmlPath = path.join(__dirname, "../web/index.html");
    const html = fs.readFileSync(htmlPath, "utf-8");
    expect(html).toContain('id="tool-hum-recording"');
    expect(html).toContain('id="ctx-hum-recording"');
    expect(html).toContain('id="hum-modal"');
    expect(html).toContain('id="hum-btn-record"');
    expect(html).toContain('id="hum-btn-apply"');
    expect(html).toContain('id="hum-enable-metronome"');
    expect(html).toContain('id="hum-enable-countin"');
    expect(html).toContain('value="AUTO"');

    // main.ts audio module, metronome, and quantizer wiring
    const mainPath = path.join(__dirname, "../web/src/main.ts");
    const mainContent = fs.readFileSync(mainPath, "utf-8");
    const domPath = path.join(__dirname, "../web/src/ui/dom.ts");
    const domContent = fs.existsSync(domPath) ? fs.readFileSync(domPath, "utf-8") : "";
    const humPath = path.join(__dirname, "../web/src/ui/modals/humModal.ts");
    const humContent = fs.existsSync(humPath) ? fs.readFileSync(humPath, "utf-8") : "";
    const fullAudioUi = [mainContent, domContent, humContent].join("\n");

    expect(fullAudioUi).toContain("quantizeNoteEventsToTmdSection");
    expect(fullAudioUi).toContain("detectTonicAndScale");
    expect(fullAudioUi).toContain("hum-modal");
    expect(fullAudioUi).toContain("startMetronomeClicks");
    expect(fullAudioUi).toContain("playClickSound");
  });

  it("persists and restores collapsed/hidden state of panels (lib, ai, inspector, problems) in localStorage", () => {
    const mainPath = path.join(__dirname, "../web/src/main.ts");
    const mainContent = fs.readFileSync(mainPath, "utf-8");
    const panelStatePath = path.join(__dirname, "../web/src/ui/panelState.ts");
    const panelStateContent = fs.existsSync(panelStatePath) ? fs.readFileSync(panelStatePath, "utf-8") : "";
    const fullContent = [mainContent, panelStateContent].join("\n");

    // Keys or storage handling for panel states
    expect(fullContent).toContain("tmd-panels-state");
    expect(fullContent).toContain("savePanelsState");
    expect(fullContent).toContain("loadPanelsState");
  });

  it("supports 'Fix with AI' in Problems Panel and displays real-time Problems diagnostics in AI Drawer preview", () => {
    // index.html should contain Fix All with AI button and AI Preview Problems badge/details
    const htmlPath = path.join(__dirname, "../web/index.html");
    const html = fs.readFileSync(htmlPath, "utf-8");
    expect(html).toContain('id="btn-fix-problems-ai"');
    expect(html).toContain('id="ai-preview-problems-badge"');
    expect(html).toContain('id="ai-preview-problems-list"');

    // problemsPanel.ts should handle fix-with-ai clicks and emit callbacks
    const problemsPanelPath = path.join(__dirname, "../web/src/ui/problemsPanel.ts");
    const problemsPanelContent = fs.readFileSync(problemsPanelPath, "utf-8");
    expect(problemsPanelContent).toContain("btn-fix-problems-ai");
    expect(problemsPanelContent).toContain("data-action=\"fix-ai\"");

    // aiDrawer.ts should render preview problems and support launchProblemFix
    const aiDrawerPath = path.join(__dirname, "../web/src/ui/aiDrawer.ts");
    const aiDrawerContent = fs.readFileSync(aiDrawerPath, "utf-8");
    expect(aiDrawerContent).toContain("validateTmdCodeWithIssues");
    expect(aiDrawerContent).toContain("launchProblemFix");
    expect(aiDrawerContent).toContain("ai-preview-problems-badge");
  });

  it("ensures library drawer auto-refreshes and syncs active score state when opened or resumed open", () => {
    const libPath = path.join(__dirname, "../web/src/ui/libraryDrawer.ts");
    const libContent = fs.readFileSync(libPath, "utf-8");
    expect(libContent).toContain("setActiveScore");

    const mainPath = path.join(__dirname, "../web/src/main.ts");
    const mainContent = fs.readFileSync(mainPath, "utf-8");
    expect(mainContent).toContain("libraryController.setActiveScore");
    expect(mainContent).toContain("libraryController.refreshLibraryScores");
  });

  it("provides jump to edit playback order link in inspector", () => {
    // Check i18n
    expect((zhTW as any).jumpToOrders).toBeDefined();
    expect((en as any).jumpToOrders).toBeDefined();

    // Check inspector.ts contains order link / jump range attributes
    const inspectorPath = path.join(__dirname, "../web/src/ui/inspector.ts");
    const inspectorContent = fs.readFileSync(inspectorPath, "utf-8");
    expect(inspectorContent).toContain("btn-jump-orders");
    expect(inspectorContent).toContain("jumpToOrders");
  });
});


