import { TmdParser } from "../../src/core/parser.js";
import { Sheet, scaleDegreeLetter, accidentalToSemitone } from "../../src/core/types.js";
import { TMDRefactor } from "../../src/core/refactor.js";
import { TMDMeasureChecker, TMDMeasureIssue } from "../../src/core/measure_check.js";
import { TMDOutlineGenerator, TMDOutlineNode } from "../../src/core/outline.js";
import {
  TMDMIDIGenerator,
  TMDMusicXMLGenerator,
  TMDLilyPondGenerator,
  TMDABCGenerator,
  TMDReaperGenerator,
  TMDVSQGenerator,
  TMDVSQXGenerator,
} from "../../src/exporters/index.js";
import { TMDWAVRenderer } from "../../src/audio.js";
import { TmdSkill } from "../../src/skill.js";
import JSZip from "jszip";

import { createTmdEditor, TMDWebEditor } from "./editor.js";
import { tmdPlayer, TMDMidiSynthType } from "./midi-player.js";
import { SAMPLES } from "./samples.js";
import {
  applyI18n,
  detectLanguage,
  getCurrentLocale,
  t,
  onLanguageChange,
  Locale,
} from "./i18n.js";

import {
  loadAISettings,
  saveAISettings,
  looksLikeApiKey,
  callAI,
  extractTmdCode,
  buildRepairPrompt,
  validateTmdCode,
  MODEL_PRESETS,
  DEFAULT_MODELS,
  AIProviderType,
  AISettingsState,
} from "./ai/index.js";
import { initTmdWebMcp } from "./mcp/webmcpIntegration.js";
import { TmdStorage, SavedScore, extractTmdTitle } from "./storage/db.js";
import { encodeShareHash, decodeShareHash } from "./share.js";
import { escapeHtml } from "./html.js";
import { quantizeNoteEventsToTmdSection, resampleAudioBuffer, TmdNoteEventTime } from "./audio/quantizer.js";

let editor: TMDWebEditor;
let currentSheet: Sheet | null = null;
let isSeeking = false;
let aiAbortController: AbortController | null = null;
let aiCurrentGeneratedCode: string = "";
let currentScoreId: string | null = null; // null means viewing a read-only template
let isTemplateScore: boolean = false;
let activeTemplateId: string | null = null;
let autoSaveTimer: any = null;
let refreshLibraryScoresHandler: (() => Promise<void>) | null = null;

// DOM Elements
const btnToggleLibrary = document.getElementById("btn-toggle-library") as HTMLButtonElement;
const libraryDrawer = document.getElementById("library-drawer") as HTMLElement;
const btnCloseLibrary = document.getElementById("btn-close-library") as HTMLButtonElement;
const btnLibraryNew = document.getElementById("btn-library-new") as HTMLButtonElement;
const btnBackupZip = document.getElementById("btn-backup-zip") as HTMLButtonElement;
const inputImportTmd = document.getElementById("input-import-tmd") as HTMLInputElement;
const libraryScoresList = document.getElementById("library-scores-list") as HTMLElement;
const librarySamplesList = document.getElementById("library-samples-list") as HTMLElement;
const libraryScoresCount = document.getElementById("library-scores-count") as HTMLElement;

const btnNewSong = document.getElementById("btn-new-song") as HTMLButtonElement;
const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
const exportDropdown = document.getElementById("export-dropdown") as HTMLElement;
const btnExportMenu = document.getElementById("btn-export-menu") as HTMLButtonElement;
const btnLangToggle = document.getElementById("btn-lang-toggle") as HTMLButtonElement;
const btnToggleAi = document.getElementById("btn-toggle-ai") as HTMLButtonElement;
const btnShare = document.getElementById("btn-share") as HTMLButtonElement;

// Export items
const btnExportTmd = document.getElementById("export-tmd") as HTMLButtonElement;
const btnExportLibraryZip = document.getElementById("export-library-zip") as HTMLButtonElement;
const btnExportMidi = document.getElementById("export-midi") as HTMLButtonElement;
const btnExportReaper = document.getElementById("export-reaper") as HTMLButtonElement;
const btnExportMusicXML = document.getElementById("export-musicxml") as HTMLButtonElement;
const btnExportLilyPond = document.getElementById("export-lilypond") as HTMLButtonElement;
const btnExportABC = document.getElementById("export-abc") as HTMLButtonElement;
const btnExportVsq = document.getElementById("export-vsq") as HTMLButtonElement;
const btnExportVsqx = document.getElementById("export-vsqx") as HTMLButtonElement;
const btnExportWAV = document.getElementById("export-wav") as HTMLButtonElement;
const btnExportSkill = document.getElementById("export-skill") as HTMLButtonElement;

// Inspector elements
const inspectorPanel = document.getElementById("inspector-panel") as HTMLElement;
const btnToggleInspector = document.getElementById("btn-toggle-inspector") as HTMLButtonElement;
const btnCloseInspector = document.getElementById("btn-close-inspector") as HTMLButtonElement;
const inspectorStatus = document.getElementById("inspector-status") as HTMLElement;
const statTitle = document.getElementById("stat-title") as HTMLElement;
const statTempo = document.getElementById("stat-tempo") as HTMLElement;
const statKey = document.getElementById("stat-key") as HTMLElement;
const statMeter = document.getElementById("stat-meter") as HTMLElement;
const inspectorOrders = document.getElementById("inspector-orders") as HTMLElement;
const inspectorTracks = document.getElementById("inspector-tracks") as HTMLElement;

// Status bar
const sbStatus = document.getElementById("sb-status") as HTMLElement;
const sbSummary = document.getElementById("sb-summary") as HTMLElement;
const sbCursor = document.getElementById("sb-cursor") as HTMLElement;

// Help Modal
const btnHelp = document.getElementById("btn-help") as HTMLButtonElement;
const helpModal = document.getElementById("help-modal") as HTMLDialogElement;
const btnCloseHelp = document.getElementById("btn-close-help") as HTMLButtonElement;
const btnDismissHelp = document.getElementById("btn-dismiss-help") as HTMLButtonElement;

// AI Drawer
const aiDrawer = document.getElementById("ai-drawer") as HTMLElement;
const btnCloseAiDrawer = document.getElementById("btn-close-ai-drawer") as HTMLButtonElement;
const btnOpenAiSettings = document.getElementById("btn-open-ai-settings") as HTMLButtonElement;
const aiBtnDownload = document.getElementById("ai-btn-download") as HTMLButtonElement;
const aiBtnCopySkill = document.getElementById("ai-btn-copy-skill") as HTMLButtonElement;
const aiPromptInput = document.getElementById("ai-prompt-input") as HTMLTextAreaElement;
const btnAiGenerate = document.getElementById("btn-ai-generate") as HTMLButtonElement;
const btnAiStop = document.getElementById("btn-ai-stop") as HTMLButtonElement;
const aiStatusText = document.getElementById("ai-status-text") as HTMLElement;
const aiResultContainer = document.getElementById("ai-result-container") as HTMLElement;
const aiResultOutput = document.getElementById("ai-result-output") as HTMLElement;
const btnAiPreviewPlay = document.getElementById("btn-ai-preview-play") as HTMLButtonElement;
const btnAiCopyCode = document.getElementById("btn-ai-copy-code") as HTMLButtonElement;
const btnAiApplyReplace = document.getElementById("btn-ai-apply-replace") as HTMLButtonElement;
const btnAiApplyInsert = document.getElementById("btn-ai-apply-insert") as HTMLButtonElement;
const aiValidationBanner = document.getElementById("ai-validation-banner") as HTMLElement;
const aiValidationMsg = document.getElementById("ai-validation-msg") as HTMLElement;
const btnAiRetryRepair = document.getElementById("btn-ai-retry-repair") as HTMLButtonElement;

// AI Settings Modal
const aiSettingsModal = document.getElementById("ai-settings-modal") as HTMLDialogElement;
const btnCloseAiSettings = document.getElementById("btn-close-ai-settings") as HTMLButtonElement;
const btnDismissAiSettings = document.getElementById("btn-dismiss-ai-settings") as HTMLButtonElement;
const btnSaveAiSettings = document.getElementById("btn-save-ai-settings") as HTMLButtonElement;
const aiSettingsProvider = document.getElementById("ai-settings-provider") as HTMLSelectElement;
const aiSettingsModelPreset = document.getElementById("ai-settings-model-preset") as HTMLSelectElement;
const aiSettingsModelCustom = document.getElementById("ai-settings-model-custom") as HTMLInputElement;
const aiSettingsKey = document.getElementById("ai-settings-key") as HTMLInputElement;
const aiKeyOfficialLink = document.getElementById("ai-key-official-link") as HTMLAnchorElement;
const aiKeyAskAiLink = document.getElementById("ai-key-ask-ai-link") as HTMLAnchorElement;
const aiSettingsBaseUrl = document.getElementById("ai-settings-baseurl") as HTMLInputElement;

// Tools Dropdown
const toolsDropdown = document.getElementById("tools-dropdown") as HTMLElement;
const btnToolsMenu = document.getElementById("btn-tools-menu") as HTMLButtonElement;
const toolFormatDocument = document.getElementById("tool-format-document") as HTMLButtonElement;
const toolDoubleGrid = document.getElementById("tool-double-grid") as HTMLButtonElement;
const toolHalveGrid = document.getElementById("tool-halve-grid") as HTMLButtonElement;
const toolDuplicateTrack = document.getElementById("tool-duplicate-track") as HTMLButtonElement;
const toolGenerateHarmony = document.getElementById("tool-generate-harmony") as HTMLButtonElement;
const toolInlineOrders = document.getElementById("tool-inline-orders") as HTMLButtonElement;
const toolRenameInstrument = document.getElementById("tool-rename-instrument") as HTMLButtonElement;
const toolRenameSection = document.getElementById("tool-rename-section") as HTMLButtonElement;
const toolExtractInstrument = document.getElementById("tool-extract-instrument") as HTMLButtonElement;
const toolInsertSection = document.getElementById("tool-insert-section") as HTMLButtonElement;

// Problems Panel elements
const problemsPanel = document.getElementById("problems-panel") as HTMLElement;
const btnToggleProblems = document.getElementById("btn-toggle-problems") as HTMLButtonElement;
const problemsCountBadge = document.getElementById("problems-count-badge") as HTMLElement;
const problemsList = document.getElementById("problems-list") as HTMLElement;

// Refactor Modals
const refactorInstrumentModal = document.getElementById("refactor-instrument-modal") as HTMLDialogElement;
const refactorOldInst = document.getElementById("refactor-old-inst") as HTMLSelectElement;
const refactorNewInst = document.getElementById("refactor-new-inst") as HTMLInputElement;
const btnConfirmRenameInst = document.getElementById("btn-confirm-rename-inst") as HTMLButtonElement;

const refactorSectionModal = document.getElementById("refactor-section-modal") as HTMLDialogElement;
const refactorOldSec = document.getElementById("refactor-old-sec") as HTMLSelectElement;
const refactorNewSec = document.getElementById("refactor-new-sec") as HTMLInputElement;
const btnConfirmRenameSec = document.getElementById("btn-confirm-rename-sec") as HTMLButtonElement;

const refactorExtractModal = document.getElementById("refactor-extract-modal") as HTMLDialogElement;
const refactorExtractInst = document.getElementById("refactor-extract-inst") as HTMLSelectElement;
const btnConfirmExtract = document.getElementById("btn-confirm-extract") as HTMLButtonElement;

const refactorDuplicateModal = document.getElementById("refactor-duplicate-modal") as HTMLDialogElement;
const refactorDupSource = document.getElementById("refactor-dup-source") as HTMLSelectElement;
const refactorDupTarget = document.getElementById("refactor-dup-target") as HTMLInputElement;
const refactorDupOctave = document.getElementById("refactor-dup-octave") as HTMLSelectElement;
const refactorDupScopeGroup = document.getElementById("refactor-dup-scope-group") as HTMLElement;
const refactorDupScopeSection = document.getElementById("refactor-dup-scope-section") as HTMLInputElement;
const refactorDupScopeGlobal = document.getElementById("refactor-dup-scope-global") as HTMLInputElement;
const refactorDupScopeSectionLabel = document.getElementById("refactor-dup-scope-section-label") as HTMLElement;
const btnConfirmDuplicate = document.getElementById("btn-confirm-duplicate") as HTMLButtonElement;

const refactorHarmonyModal = document.getElementById("refactor-harmony-modal") as HTMLDialogElement;
const refactorHarmSource = document.getElementById("refactor-harm-source") as HTMLSelectElement;
const refactorHarmTarget = document.getElementById("refactor-harm-target") as HTMLInputElement;
const refactorHarmInterval = document.getElementById("refactor-harm-interval") as HTMLSelectElement;
const refactorHarmScopeGroup = document.getElementById("refactor-harm-scope-group") as HTMLElement;
const refactorHarmScopeSection = document.getElementById("refactor-harm-scope-section") as HTMLInputElement;
const refactorHarmScopeGlobal = document.getElementById("refactor-harm-scope-global") as HTMLInputElement;
const refactorHarmScopeSectionLabel = document.getElementById("refactor-harm-scope-section-label") as HTMLElement;
const btnConfirmHarmony = document.getElementById("btn-confirm-harmony") as HTMLButtonElement;

// Insert Section Modal
const insertSectionModal = document.getElementById("insert-section-modal") as HTMLDialogElement;
const insertSecName = document.getElementById("insert-sec-name") as HTMLInputElement;
const insertSecInst = document.getElementById("insert-sec-inst") as HTMLInputElement;
const insertSecTemplate = document.getElementById("insert-sec-template") as HTMLSelectElement;
const insertSecMeasures = document.getElementById("insert-sec-measures") as HTMLSelectElement;
const btnConfirmInsertSec = document.getElementById("btn-confirm-insert-sec") as HTMLButtonElement;

// Context Menu elements
const editorContextMenu = document.getElementById("editor-context-menu") as HTMLElement;
const ctxHeaderInfo = document.getElementById("ctx-header-info") as HTMLElement;
const ctxFormat = document.getElementById("ctx-format") as HTMLButtonElement;
const ctxFormatLabel = document.getElementById("ctx-format-label") as HTMLElement;
const ctxInsertSection = document.getElementById("ctx-insert-section") as HTMLButtonElement;
const ctxDoubleGrid = document.getElementById("ctx-double-grid") as HTMLButtonElement;
const ctxHalveGrid = document.getElementById("ctx-halve-grid") as HTMLButtonElement;
const ctxDuplicateTrack = document.getElementById("ctx-duplicate-track") as HTMLButtonElement;
const ctxGenerateHarmony = document.getElementById("ctx-generate-harmony") as HTMLButtonElement;
const ctxExtractInstrument = document.getElementById("ctx-extract-instrument") as HTMLButtonElement;
const ctxRenameInstrument = document.getElementById("ctx-rename-instrument") as HTMLButtonElement;
const ctxRenameSection = document.getElementById("ctx-rename-section") as HTMLButtonElement;
const aiSettingsBaseUrlGroup = document.getElementById("ai-settings-baseurl-group") as HTMLElement;

// Hum to TMD elements
const btnHumRecording = document.getElementById("btn-hum-recording") as HTMLButtonElement;
const toolHumRecording = document.getElementById("tool-hum-recording") as HTMLButtonElement;
const humModal = document.getElementById("hum-modal") as HTMLDialogElement;
const humBtnRecord = document.getElementById("hum-btn-record") as HTMLButtonElement;
const humRecordIcon = document.getElementById("hum-record-icon") as HTMLElement;
const humRecordText = document.getElementById("hum-record-text") as HTMLElement;
const humStatusIndicator = document.getElementById("hum-status-indicator") as HTMLElement;
const humSectionName = document.getElementById("hum-section-name") as HTMLInputElement;
const humInstrument = document.getElementById("hum-instrument") as HTMLInputElement;
const humKey = document.getElementById("hum-key") as HTMLSelectElement;
const humBpm = document.getElementById("hum-bpm") as HTMLInputElement;
const humGrid = document.getElementById("hum-grid") as HTMLSelectElement;
const humResultCode = document.getElementById("hum-result-code") as HTMLTextAreaElement;
const humBtnPlayPreview = document.getElementById("hum-btn-play-preview") as HTMLButtonElement;
const humBtnApply = document.getElementById("hum-btn-apply") as HTMLButtonElement;

// Player Bar (Matching zago)
const tmdPlayerBar = document.getElementById("tmd-player-bar") as HTMLElement;
const playerTitle = document.getElementById("player-title") as HTMLElement;
const playerTime = document.getElementById("player-time") as HTMLElement;
const playerProgress = document.getElementById("player-progress") as HTMLInputElement;
const synthSelect = document.getElementById("synth-select") as HTMLSelectElement;
const playerBtnPause = document.getElementById("player-btn-pause") as HTMLButtonElement;
const playerBtnClose = document.getElementById("player-btn-close") as HTMLButtonElement;

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getSafeFilename(title?: string, ext: string = "mid"): string {
  const safe = (title || "untitled")
    .replace(/[^\w\u4e00-\u9fa5-_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "score";
  return `${safe}.${ext}`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearShareHash() {
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

// Toast notification helper
function showToast(message: string, type: "success" | "error" = "success") {
  let container = document.querySelector(".toast-container") as HTMLElement | null;
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function updateProblems(text: string) {
  if (!problemsPanel || !problemsList || !problemsCountBadge) return;

  // First check if parse fails
  let syntaxError = false;
  try {
    TmdParser.parse(text);
  } catch (err: any) {
    syntaxError = true;
    problemsCountBadge.className = "problems-badge error";
    problemsCountBadge.textContent = "1";
    problemsList.innerHTML = `
      <div class="problem-item error" data-line="1">
        <span class="problem-item-line">Ln 1</span>
        <span class="problem-item-msg">${escapeHtml(err.message || "Syntax Error")}</span>
      </div>
    `;
    return;
  }

  // If syntax is valid, run TMDMeasureChecker
  const issues: TMDMeasureIssue[] = TMDMeasureChecker.check(text);
  if (issues.length === 0) {
    problemsCountBadge.className = "problems-badge valid";
    problemsCountBadge.textContent = "0";
    problemsList.innerHTML = `<div class="problem-empty-hint">${escapeHtml(t("problemsAllValid"))}</div>`;
  } else {
    problemsCountBadge.className = "problems-badge warning";
    problemsCountBadge.textContent = issues.length.toString();
    problemsList.innerHTML = issues
      .map((issue) => {
        const line = issue.lineNumber || 1;
        const msg = issue.description || `${issue.paragraphName}:${issue.instrument} measure issue`;
        return `
          <div class="problem-item warning" data-line="${line}">
            <span class="problem-item-line">Ln ${line}</span>
            <span class="problem-item-msg">${escapeHtml(msg)}</span>
          </div>
        `;
      })
      .join("");
  }
}

// Saves the score of a "#tmd=..." link to the library and removes the hash,
// so a reload does not import it again. A saved score with the same content is
// reused, so opening one link twice does not add a copy.
// Returns null when the URL has no share link.
async function importSharedScore(): Promise<SavedScore | null> {
  let text: string | null;
  try {
    text = await decodeShareHash(window.location.hash);
  } catch (err) {
    console.warn("Invalid share link:", err);
    clearShareHash();
    alert(t("shareInvalidLink"));
    return null;
  }
  if (text === null) return null;
  let score: SavedScore;
  try {
    score = (await TmdStorage.findScoreByContent(text)) ?? (await TmdStorage.saveScore({ content: text }));
  } catch (err) {
    // Keep the hash, so a reload tries the import again.
    // This app has no toast component, so the message uses alert().
    // If a toast component is added later, show this message as a toast instead.
    console.error("Could not save the shared score:", err);
    alert(t("shareSaveFailed"));
    return null;
  }
  clearShareHash();
  return score;
}

function updateInspector(text: string) {
  try {
    currentSheet = TmdParser.parse(text);
  } catch (err: any) {
    currentSheet = null;
    inspectorStatus.className = "status-badge error";
    inspectorStatus.textContent = `${t("statusError")}: ${err.message || ""}`;
    sbStatus.textContent = "Syntax Error";
    sbSummary.textContent = err.message || "";
    return;
  }

  if (!currentSheet) {
    inspectorStatus.className = "status-badge error";
    inspectorStatus.textContent = t("missingScoreHeader");
    sbStatus.textContent = "Invalid TMD";
    sbSummary.textContent = "Missing ::SCORE:: root header";
    return;
  }

  inspectorStatus.className = "status-badge success";
  inspectorStatus.textContent = t("statusValid");

  // Metadata
  statTitle.textContent = currentSheet.name || t("defaultTitle");
  statTempo.textContent = currentSheet.speed ? `${currentSheet.speed}` : t("defaultTempo");

  if (currentSheet.keySignature) {
    const letter = scaleDegreeLetter(currentSheet.keySignature.tonic);
    const semitone = accidentalToSemitone(currentSheet.keySignature.accidental);
    const acc = semitone === 1 ? "#" : semitone === -1 ? "b" : "";
    statKey.textContent = `${letter}${acc}`;
  } else {
    statKey.textContent = "C";
  }

  statMeter.textContent = currentSheet.beat ? `${currentSheet.beat.count}/${currentSheet.beat.noteValue}` : "4/4";

  // Orders
  if (currentSheet.orders && currentSheet.orders.length > 0) {
    inspectorOrders.innerHTML = currentSheet.orders
      .map((ord) => {
        if (ord.type === "name") {
          return `<span class="order-tag">${escapeHtml(ord.name)}</span>`;
        } else if (ord.type === "relative") {
          return `<span class="order-tag" style="color: var(--accent-purple); border-color: rgba(188, 140, 255, 0.3);">{${escapeHtml(ord.value)}}</span>`;
        } else if (ord.type === "absolute") {
          return `<span class="order-tag" style="color: var(--accent-yellow); border-color: rgba(210, 153, 34, 0.3);">{${escapeHtml(ord.value)}}</span>`;
        }
        return "";
      })
      .filter(Boolean)
      .join("");
  } else {
    inspectorOrders.innerHTML = `<span class="stat-label">${t("noOrders")}</span>`;
  }

  // Tracks / Outline Hierarchy (Sections -> Tracks -> Measures)
  const outlineNodes = TMDOutlineGenerator.generate(text);
  const sectionsNode = outlineNodes.find((n) => n.name === "Sections");

  if (sectionsNode && sectionsNode.children && sectionsNode.children.length > 0) {
    inspectorTracks.innerHTML = `
      <div class="outline-tree">
        ${sectionsNode.children
          .map((secNode) => {
            const secRangeAttrs = `data-start-line="${secNode.range.startLine}" data-start-col="${secNode.range.startColumn}" data-end-line="${secNode.range.endLine}" data-end-col="${secNode.range.endColumn}"`;
            const trackChildren = secNode.children || [];

            const tracksHtml = trackChildren
              .map((trkNode) => {
                const trkRangeAttrs = `data-start-line="${trkNode.range.startLine}" data-start-col="${trkNode.range.startColumn}" data-end-line="${trkNode.range.endLine}" data-end-col="${trkNode.range.endColumn}"`;
                return `
                  <div class="track-item outline-track-item" ${trkRangeAttrs} title="L${trkNode.range.startLine}:C${trkNode.range.startColumn}">
                    <span class="track-name">${escapeHtml(trkNode.name)}</span>
                    ${trkNode.detail ? `<span class="track-meta">${escapeHtml(trkNode.detail)}</span>` : ""}
                  </div>
                `;
              })
              .join("");

            return `
              <details class="outline-section-node" open>
                <summary class="outline-section-summary" ${secRangeAttrs} title="L${secNode.range.startLine}:C${secNode.range.startColumn}">
                  <span class="outline-node-title">
                    <span class="outline-chevron">▶</span>
                    <span>${escapeHtml(secNode.name)}</span>
                  </span>
                  <span class="outline-badge">${trackChildren.length} track${trackChildren.length === 1 ? "" : "s"}</span>
                </summary>
                <div class="outline-tracks-container">
                  ${tracksHtml}
                </div>
              </details>
            `;
          })
          .join("")}
      </div>
    `;
  } else if (currentSheet.paragraphs && currentSheet.paragraphs.length > 0) {
    // Fallback if AST has paragraphs but outline nodes failed
    inspectorTracks.innerHTML = currentSheet.paragraphs
      .map((p) => {
        const offset = p.start ? (p.start > 0 ? `+${p.start}` : `${p.start}`) : "0";
        const totalUnits = p.sections.reduce((acc, s) => acc + s.unitGroups.reduce((uAcc, g) => uAcc + g.units.length, 0), 0);
        const lineAttr = p.line ? `data-start-line="${p.line}" data-start-col="1" data-end-line="${p.line}" data-end-col="1"` : "";
        return `
          <div class="track-item" ${lineAttr}>
            <span class="track-name">${escapeHtml(p.name)}:${escapeHtml(p.instrument)}</span>
            <span class="track-meta">@|${offset}| · ${totalUnits} notes</span>
          </div>
        `;
      })
      .join("");
  } else {
    inspectorTracks.innerHTML = `<span class="stat-label">${t("noTracks")}</span>`;
  }

  // Status bar summary
  const trackCount = new Set(currentSheet.paragraphs.map((p) => p.instrument)).size;
  sbStatus.textContent = "Valid TMD";
  sbSummary.textContent = `${currentSheet.paragraphs.length} paragraphs · ${trackCount} instruments · BPM ${currentSheet.speed || 120}`;
}

let parseDebounceTimer: any = null;
function handleEditorChange(text: string) {
  clearTimeout(parseDebounceTimer);
  parseDebounceTimer = setTimeout(() => {
    updateInspector(text);
    updateProblems(text);
  }, 200);

  // Auto-save to IndexedDB (Debounced 500ms)
  // Known gap, not fixed: each switch to another score (a library item, a sample, New,
  // an import, or a share link) calls editor.setContent(), which runs this function.
  // The clearTimeout below then cancels the pending save of the previous score, so edits
  // from the last 500 ms before the switch are lost. Fix this for all switch actions
  // together, for example by saving the pending text before the switch.
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    try {
      if (isTemplateScore) {
        // If the user hasn't actually modified the template content, do NOT create a copy!
        const activeSample = SAMPLES.find((s) => s.id === activeTemplateId);
        if (activeSample && text.trim() === activeSample.content.trim()) {
          return;
        }

        // Copy-on-write: When modifying a template, create a user draft in IndexedDB
        const title = extractTmdTitle(text);
        const newScore = await TmdStorage.saveScore({
          title,
          content: text,
        });
        currentScoreId = newScore.id;
        isTemplateScore = false;
        activeTemplateId = null;
        TmdStorage.setActiveScoreId(newScore.id);
        if (refreshLibraryScoresHandler) await refreshLibraryScoresHandler();
      } else if (currentScoreId) {
        const title = extractTmdTitle(text);
        await TmdStorage.saveScore({
          id: currentScoreId,
          title,
          content: text,
        });
        TmdStorage.setActiveScoreId(currentScoreId);
        if (refreshLibraryScoresHandler) await refreshLibraryScoresHandler();
      }

      // Visual auto-save feedback in status bar
      if (sbStatus) {
        const prevText = sbStatus.textContent;
        sbStatus.textContent = t("savedAutoNotice");
        setTimeout(() => {
          if (sbStatus && sbStatus.textContent === t("savedAutoNotice")) {
            sbStatus.textContent = prevText;
          }
        }, 1500);
      }
    } catch (e) {
      console.error("Auto-save error:", e);
    }
  }, 500);
}

// Playback handling
async function playSectionOrTrack(sectionName: string, instrumentName?: string) {
  const text = editor.getContent();
  let sheet: Sheet | null = null;
  try {
    sheet = TmdParser.parse(text);
  } catch (err: any) {
    alert(`${t("alertCannotPlaySyntax")}\n${err.message}`);
    return;
  }

  if (!sheet) {
    alert(t("alertCannotPlayMissingHeader"));
    return;
  }

  const title = instrumentName
    ? `${sheet.name || "score"} - ${sectionName} (${instrumentName})`
    : `${sheet.name || "score"} - ${sectionName}`;

  let midiBytes: Uint8Array;
  try {
    midiBytes = TMDMIDIGenerator.generateMIDI(sheet, undefined, {
      targetParagraph: sectionName,
      targetInstrument: instrumentName,
    });
  } catch (err: any) {
    alert(`${t("alertMidiFailed")}: ${err.message}`);
    return;
  }

  if (playerTitle) playerTitle.textContent = title;
  if (playerTime) playerTime.textContent = "00:00 / 00:00";
  if (playerProgress) {
    playerProgress.value = "0";
    playerProgress.max = "100";
  }
  if (tmdPlayerBar) tmdPlayerBar.style.display = "flex";
  if (playerBtnPause) playerBtnPause.textContent = "⏸";

  await tmdPlayer.play(midiBytes, title, {
    onStart: (_title, durationSec) => {
      if (playerProgress) {
        playerProgress.max = Math.max(1, durationSec).toString();
        playerProgress.value = "0";
      }
      if (playerTime) {
        playerTime.textContent = `00:00 / ${formatTime(durationSec)}`;
      }
    },
    onProgress: (currentSec, totalSec) => {
      if (playerTime) {
        playerTime.textContent = `${formatTime(currentSec)} / ${formatTime(totalSec)}`;
      }
      if (playerProgress && !isSeeking) {
        if (playerProgress.max !== totalSec.toString()) {
          playerProgress.max = Math.max(1, totalSec).toString();
        }
        playerProgress.value = currentSec.toString();
      }
    },
    onPause: () => {
      if (playerBtnPause) playerBtnPause.textContent = "▶";
    },
    onResume: () => {
      if (playerBtnPause) playerBtnPause.textContent = "⏸";
    },
    onLoadingStatus: (status) => {
      if (status && playerTime) {
        playerTime.textContent = status;
      }
    },
    onStop: () => {
      if (tmdPlayerBar) tmdPlayerBar.style.display = "none";
      if (playerBtnPause) playerBtnPause.textContent = "⏸";
      if (playerProgress) playerProgress.value = "0";
    },
    onEnd: () => {
      if (tmdPlayerBar) tmdPlayerBar.style.display = "none";
      if (playerBtnPause) playerBtnPause.textContent = "⏸";
      if (playerProgress) playerProgress.value = "0";
    },
  });
}

async function startPlayback(customText?: string) {
  const text = customText !== undefined ? customText : editor.getContent();
  let sheet: Sheet | null = null;
  try {
    sheet = TmdParser.parse(text);
  } catch (err: any) {
    alert(`${t("alertCannotPlaySyntax")}\n${err.message}`);
    return;
  }

  if (!sheet) {
    alert(t("alertCannotPlayMissingHeader"));
    return;
  }

  const title = sheet.name || "score.mid";
  let midiBytes: Uint8Array;
  try {
    midiBytes = TMDMIDIGenerator.generateMIDI(sheet);
  } catch (err: any) {
    alert(`${t("alertMidiFailed")}: ${err.message}`);
    return;
  }

  if (playerTitle) playerTitle.textContent = title;
  if (playerTime) playerTime.textContent = "00:00 / 00:00";
  if (playerProgress) {
    playerProgress.value = "0";
    playerProgress.max = "100";
  }
  if (tmdPlayerBar) tmdPlayerBar.style.display = "flex";
  if (playerBtnPause) playerBtnPause.textContent = "⏸";

  await tmdPlayer.play(midiBytes, title, {
    onStart: (_title, durationSec) => {
      if (playerProgress) {
        playerProgress.max = Math.max(1, durationSec).toString();
        playerProgress.value = "0";
      }
      if (playerTime) {
        playerTime.textContent = `00:00 / ${formatTime(durationSec)}`;
      }
    },
    onProgress: (currentSec, totalSec) => {
      if (playerTime) {
        playerTime.textContent = `${formatTime(currentSec)} / ${formatTime(totalSec)}`;
      }
      if (playerProgress && !isSeeking) {
        if (playerProgress.max !== totalSec.toString()) {
          playerProgress.max = Math.max(1, totalSec).toString();
        }
        playerProgress.value = currentSec.toString();
      }
    },
    onPause: () => {
      if (playerBtnPause) playerBtnPause.textContent = "▶";
    },
    onResume: () => {
      if (playerBtnPause) playerBtnPause.textContent = "⏸";
    },
    onLoadingStatus: (status) => {
      if (status && playerTime) {
        playerTime.textContent = status;
      }
    },
    onStop: () => {
      if (tmdPlayerBar) tmdPlayerBar.style.display = "none";
      if (playerBtnPause) playerBtnPause.textContent = "⏸";
      if (playerProgress) playerProgress.value = "0";
    },
    onEnd: () => {
      if (tmdPlayerBar) tmdPlayerBar.style.display = "none";
      if (playerBtnPause) playerBtnPause.textContent = "⏸";
      if (playerProgress) playerProgress.value = "0";
    },
  });
}

function makeDraggable(element: HTMLElement) {
  let isDragging = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startElementX = 0;
  let startElementY = 0;

  element.addEventListener("pointerdown", (e: PointerEvent) => {
    // Ignore clicks on inputs, buttons, selects, or other interactive elements
    const target = e.target as HTMLElement | null;
    if (target && target.closest("button, input, select, a")) {
      return;
    }

    // Only respond to primary mouse click or touch
    if (e.button !== 0 && e.pointerType === "mouse") return;

    isDragging = true;
    startPointerX = e.clientX;
    startPointerY = e.clientY;

    const rect = element.getBoundingClientRect();
    startElementX = rect.left;
    startElementY = rect.top;

    // Reset right/bottom positioning to explicit top/left
    element.style.right = "auto";
    element.style.bottom = "auto";
    element.style.left = `${startElementX}px`;
    element.style.top = `${startElementY}px`;

    element.classList.add("dragging");
    element.setPointerCapture(e.pointerId);
  });

  element.addEventListener("pointermove", (e: PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startPointerX;
    const deltaY = e.clientY - startPointerY;

    const rect = element.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - rect.width);
    const maxY = Math.max(0, window.innerHeight - rect.height);

    const newX = Math.min(Math.max(0, startElementX + deltaX), maxX);
    const newY = Math.min(Math.max(0, startElementY + deltaY), maxY);

    element.style.left = `${newX}px`;
    element.style.top = `${newY}px`;
  });

  const stopDrag = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    element.classList.remove("dragging");
    if (element.hasPointerCapture(e.pointerId)) {
      element.releasePointerCapture(e.pointerId);
    }
  };

  element.addEventListener("pointerup", stopDrag);
  element.addEventListener("pointercancel", stopDrag);
}

function initEvents() {
  if (tmdPlayerBar) {
    makeDraggable(tmdPlayerBar);
  }
  // Play Button
  btnPlay.addEventListener("click", () => {
    startPlayback();
  });

  // Player controls
  playerBtnPause.addEventListener("click", () => {
    tmdPlayer.togglePause();
  });

  playerBtnClose.addEventListener("click", () => {
    tmdPlayer.stop();
    tmdPlayerBar.style.display = "none";
  });

  // Seek slider
  playerProgress.addEventListener("mousedown", () => {
    isSeeking = true;
  });
  playerProgress.addEventListener("touchstart", () => {
    isSeeking = true;
  }, { passive: true });

  playerProgress.addEventListener("input", () => {
    const targetSec = parseFloat(playerProgress.value);
    const totalSec = tmdPlayer.getDuration();
    if (playerTime) {
      playerTime.textContent = `${formatTime(targetSec)} / ${formatTime(totalSec)}`;
    }
  });

  const commitSeek = () => {
    if (isSeeking) {
      const targetSec = parseFloat(playerProgress.value);
      tmdPlayer.seek(targetSec);
      isSeeking = false;
    }
  };

  playerProgress.addEventListener("change", commitSeek);
  playerProgress.addEventListener("mouseup", commitSeek);
  playerProgress.addEventListener("touchend", commitSeek);

  // Synth select
  synthSelect.value = tmdPlayer.getSynthType();
  synthSelect.addEventListener("change", async () => {
    const selected = synthSelect.value as TMDMidiSynthType;
    await tmdPlayer.setSynthType(selected);
  });

  // Language switcher
  btnLangToggle.addEventListener("click", () => {
    const nextLocale: Locale = getCurrentLocale() === "zh-TW" ? "en" : "zh-TW";
    applyI18n(nextLocale);
  });

  const updateWebMcpAskLink = () => {
    const link = document.getElementById("ai-webmcp-ask-link") as HTMLAnchorElement | null;
    if (!link) return;
    const isZh = getCurrentLocale() === "zh-TW";
    const q = isZh
      ? encodeURIComponent("怎樣設定 Web MCP 連線教學")
      : encodeURIComponent("How to setup and connect to Web MCP tutorial");
    const hl = isZh ? "zh-TW" : "en";
    link.href = `https://www.google.com/search?q=${q}&hl=${hl}`;
  };

  onLanguageChange(() => {
    if (editor) {
      updateInspector(editor.getContent());
      updateProblems(editor.getContent());
    }
    const selectedProvider = (aiSettingsProvider?.value as AIProviderType) || aiSettings.activeProvider;
    populateModelPresets(selectedProvider);
    updateWebMcpAskLink();
  });

  // Export dropdown menu
  btnExportMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle("open");
    toolsDropdown?.classList.remove("open");
  });

  // Tools dropdown menu
  btnToolsMenu?.addEventListener("click", (e) => {
    e.stopPropagation();
    toolsDropdown?.classList.toggle("open");
    exportDropdown.classList.remove("open");
  });

  window.addEventListener("click", (e) => {
    if (!exportDropdown.contains(e.target as Node)) {
      exportDropdown.classList.remove("open");
    }
    if (toolsDropdown && !toolsDropdown.contains(e.target as Node)) {
      toolsDropdown.classList.remove("open");
    }
  });

  // Export actions
  btnExportTmd.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    const text = editor.getContent();
    let filename = "score.tmd";
    try {
      const sheet = TmdParser.parse(text);
      if (sheet?.name) {
        filename = getSafeFilename(sheet.name, "tmd");
      }
    } catch {
      // Even if syntax is incomplete, let user download their raw TMD code
    }
    downloadBlob(filename, new Blob([text], { type: "text/plain;charset=utf-8" }));
  });

  btnExportMidi.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    const text = editor.getContent();
    const sheet = TmdParser.parse(text);
    if (!sheet) return alert(t("alertCannotExport"));
    const midi = TMDMIDIGenerator.generateMIDI(sheet);
    downloadBlob(getSafeFilename(sheet.name, "mid"), new Blob([midi as any], { type: "audio/midi" }));
  });

  btnExportReaper.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    const text = editor.getContent();
    const sheet = TmdParser.parse(text);
    if (!sheet) return alert(t("alertCannotExport"));
    const rpp = TMDReaperGenerator.generateRPP(sheet);
    downloadBlob(getSafeFilename(sheet.name, "rpp"), new Blob([rpp], { type: "text/plain;charset=utf-8" }));
  });

  btnExportMusicXML.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    const text = editor.getContent();
    const sheet = TmdParser.parse(text);
    if (!sheet) return alert(t("alertCannotExport"));
    const xml = TMDMusicXMLGenerator.generateMusicXML(sheet);
    downloadBlob(getSafeFilename(sheet.name, "musicxml"), new Blob([xml], { type: "application/vnd.recordare.musicxml+xml;charset=utf-8" }));
  });

  btnExportLilyPond.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    const text = editor.getContent();
    const sheet = TmdParser.parse(text);
    if (!sheet) return alert(t("alertCannotExport"));
    const ly = TMDLilyPondGenerator.generateLilyPond(sheet);
    downloadBlob(getSafeFilename(sheet.name, "ly"), new Blob([ly], { type: "text/plain;charset=utf-8" }));
  });

  btnExportABC.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    const text = editor.getContent();
    const sheet = TmdParser.parse(text);
    if (!sheet) return alert(t("alertCannotExport"));
    const abc = TMDABCGenerator.generateABC(sheet);
    downloadBlob(getSafeFilename(sheet.name, "abc"), new Blob([abc], { type: "text/vnd.abc;charset=utf-8" }));
  });

  btnExportVsq?.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    const text = editor.getContent();
    const sheet = TmdParser.parse(text);
    if (!sheet) return alert(t("alertCannotExport"));
    const vsq = TMDVSQGenerator.generateVSQ(sheet);
    downloadBlob(getSafeFilename(sheet.name, "vsq"), new Blob([vsq as any], { type: "audio/x-vsq" }));
  });

  btnExportVsqx?.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    const text = editor.getContent();
    const sheet = TmdParser.parse(text);
    if (!sheet) return alert(t("alertCannotExport"));
    const vsqx = TMDVSQXGenerator.generateVSQX(sheet);
    downloadBlob(getSafeFilename(sheet.name, "vsqx"), new Blob([vsqx], { type: "application/xml;charset=utf-8" }));
  });

  btnExportWAV.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    const text = editor.getContent();
    const sheet = TmdParser.parse(text);
    if (!sheet) return alert(t("alertCannotExport"));
    const wav = TMDWAVRenderer.renderWAV(sheet);
    downloadBlob(getSafeFilename(sheet.name, "wav"), new Blob([wav as any], { type: "audio/wav" }));
  });

  const downloadSkillFile = () => {
    downloadBlob("SKILL.md", new Blob([TmdSkill.skillMarkdown], { type: "text/markdown;charset=utf-8" }));
  };

  btnExportSkill.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    downloadSkillFile();
  });

  btnShare.addEventListener("click", async () => {
    let url: string;
    try {
      url = window.location.origin + window.location.pathname + (await encodeShareHash(editor.getContent()));
    } catch (err) {
      // The score is too large for a link, or the browser cannot compress it.
      // This app has no toast component, so the message uses alert().
      // If a toast component is added later, show this message as a toast instead.
      console.warn("Could not create a share link:", err);
      alert(t("shareCreateFailed"));
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // The browser can block clipboard access. Let the user copy the link by hand.
      prompt(t("shareCopyPrompt"), url);
      return;
    }
    const icon = btnShare.querySelector(".btn-icon")!;
    const label = btnShare.querySelector(".btn-text")!;
    icon.textContent = "✓";
    label.textContent = t("shareCopied");
    setTimeout(() => {
      icon.textContent = "🔗";
      label.textContent = t("btnShare");
    }, 2000);
  });



  const exportAllScoresZip = async () => {
    try {
      const scores = await TmdStorage.listScores();
      if (!scores || scores.length === 0) {
        alert(t("noScoresToBackup"));
        return;
      }
      const zip = new JSZip();
      const usedFilenames = new Map<string, number>();

      scores.forEach((s) => {
        let baseName = s.title.replace(/[\\/:*?"<>|]/g, "_").trim() || "score";
        let count = usedFilenames.get(baseName) || 0;
        let filename = `${baseName}.tmd`;
        if (count > 0) {
          filename = `${baseName}_(${count}).tmd`;
        }
        usedFilenames.set(baseName, count + 1);
        zip.file(filename, s.content);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadBlob(`tmd-scores-backup-${dateStr}.zip`, blob);
    } catch (e: any) {
      console.error("Backup ZIP failed:", e);
      alert(`備份失敗: ${e.message || String(e)}`);
    }
  };

  btnBackupZip?.addEventListener("click", () => {
    exportAllScoresZip();
  });

  btnExportLibraryZip?.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    exportAllScoresZip();
  });

  // Library Drawer Management
  const loadScoreIntoEditor = (score: SavedScore) => {
    currentScoreId = score.id;
    isTemplateScore = false;
    activeTemplateId = null;
    TmdStorage.setActiveScoreId(score.id);
    editor.setContent(score.content);
    updateInspector(score.content);
    refreshLibraryScores();
  };

  const loadTemplateIntoEditor = (sampleId: string) => {
    const sample = SAMPLES.find((s) => s.id === sampleId);
    if (!sample) return;
    currentScoreId = null;
    isTemplateScore = true;
    activeTemplateId = sample.id;
    TmdStorage.setActiveScoreId(null);
    editor.setContent(sample.content);
    updateInspector(sample.content);
    refreshLibraryScores();
  };

  const createNewSong = async () => {
    const starterSample = SAMPLES.find((s) => s.id === "starter_template") || SAMPLES[0];
    const newScore = await TmdStorage.saveScore({
      title: "未命名新歌",
      content: starterSample.content,
    });
    loadScoreIntoEditor(newScore);
    editor.focus();
  };

  const refreshLibraryScores = async () => {
    try {
      const scores = await TmdStorage.listScores();
      if (libraryScoresCount) {
        libraryScoresCount.textContent = String(scores.length);
      }

      if (libraryScoresList) {
        if (scores.length === 0) {
          libraryScoresList.innerHTML = `<div class="library-empty-hint">${t("emptyScoresHint")}</div>`;
        } else {
          libraryScoresList.innerHTML = scores
            .map((score) => {
              const isActive = currentScoreId === score.id;
              const dateStr = new Date(score.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return `
                <div class="library-item ${isActive ? "active" : ""}" data-id="${escapeHtml(score.id)}">
                  <div class="library-item-content">
                    <div class="library-item-title">${escapeHtml(score.title)}</div>
                    <div class="library-item-meta">
                      <span>🕒 ${dateStr}</span>
                    </div>
                  </div>
                  <div class="library-item-actions">
                    <button class="library-action-btn copy-btn" data-action="copy" title="複製副本">📋</button>
                    <button class="library-action-btn delete-btn delete" data-action="delete" title="刪除">🗑️</button>
                  </div>
                </div>
              `;
            })
            .join("");
        }
      }

      // Render Templates List
      if (librarySamplesList) {
        librarySamplesList.innerHTML = SAMPLES.map((sample) => {
          const isSelected = isTemplateScore && activeTemplateId === sample.id;
          return `
            <div class="library-item ${isSelected ? "active" : ""}" data-sample-id="${sample.id}">
              <div class="library-item-content">
                <div class="library-item-title">${sample.name}</div>
                <div class="library-item-meta">
                  <span>${sample.category}</span>
                </div>
              </div>
            </div>
          `;
        }).join("");
      }
    } catch (e) {
      console.error("Failed to refresh library scores:", e);
    }
  };

  refreshLibraryScoresHandler = refreshLibraryScores;

  // Library Drawer UI events
  btnToggleLibrary?.addEventListener("click", () => {
    libraryDrawer.classList.toggle("hidden");
    if (!libraryDrawer.classList.contains("hidden")) {
      refreshLibraryScores();
    }
  });

  btnCloseLibrary?.addEventListener("click", () => {
    libraryDrawer.classList.add("hidden");
  });

  btnLibraryNew?.addEventListener("click", () => {
    createNewSong();
  });

  // Import TMD file from disk
  inputImportTmd?.addEventListener("change", async (e) => {
    const file = inputImportTmd.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const title = extractTmdTitle(text) || file.name.replace(/\.[^/.]+$/, "");
      const newScore = await TmdStorage.saveScore({
        title,
        content: text,
      });
      loadScoreIntoEditor(newScore);
      inputImportTmd.value = "";
    } catch (err: any) {
      alert(`匯入失敗: ${err.message || String(err)}`);
    }
  });

  // A share link pasted into an open tab changes only the hash, and the page does not reload.
  window.addEventListener("hashchange", () => {
    importSharedScore()
      .then((score) => score && loadScoreIntoEditor(score))
      .catch((err) => console.error("Failed to import shared score:", err));
  });

  // Item clicks inside library list
  libraryScoresList?.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".library-item") as HTMLElement | null;
    if (!item || !item.dataset.id) return;
    const scoreId = item.dataset.id;

    const action = target.closest("[data-action]")?.getAttribute("data-action");
    if (action === "delete") {
      e.stopPropagation();
      const score = await TmdStorage.getScore(scoreId);
      if (!score) return;
      if (confirm(t("confirmDeleteScore").replace("{title}", score.title))) {
        await TmdStorage.deleteScore(scoreId);
        if (currentScoreId === scoreId) {
          // If active score was deleted, fallback to starter template
          loadTemplateIntoEditor("sandiansanye");
        }
        await refreshLibraryScores();
      }
      return;
    }

    if (action === "copy") {
      e.stopPropagation();
      const copy = await TmdStorage.duplicateScore(scoreId);
      loadScoreIntoEditor(copy);
      return;
    }

    // Load score
    const score = await TmdStorage.getScore(scoreId);
    if (score) {
      loadScoreIntoEditor(score);
    }
  });

  librarySamplesList?.addEventListener("click", (e) => {
    const item = (e.target as HTMLElement).closest(".library-item") as HTMLElement | null;
    if (!item || !item.dataset.sampleId) return;
    loadTemplateIntoEditor(item.dataset.sampleId);
  });

  // New Song Button
  btnNewSong?.addEventListener("click", () => {
    createNewSong();
  });

  // Inspector toggle
  btnToggleInspector.addEventListener("click", () => {
    inspectorPanel.classList.toggle("hidden");
  });

  btnCloseInspector.addEventListener("click", () => {
    inspectorPanel.classList.add("hidden");
  });

  // Outline / Track item click -> Jump to editor range or line
  inspectorTracks?.addEventListener("click", (e) => {
    const clickable = (e.target as HTMLElement).closest("[data-start-line]") as HTMLElement | null;
    if (clickable && clickable.dataset.startLine) {
      const sLine = parseInt(clickable.dataset.startLine, 10);
      const sCol = clickable.dataset.startCol ? parseInt(clickable.dataset.startCol, 10) : 1;
      const eLine = clickable.dataset.endLine ? parseInt(clickable.dataset.endLine, 10) : sLine;
      const eCol = clickable.dataset.endCol ? parseInt(clickable.dataset.endCol, 10) : sCol;

      if (!isNaN(sLine) && sLine > 0) {
        if (typeof (editor as any).scrollToRange === "function") {
          editor.scrollToRange(sLine, sCol, eLine, eCol);
        } else {
          editor.scrollToLine(sLine);
        }
      }
    }
  });

  // Help modal
  btnHelp.addEventListener("click", () => {
    helpModal.showModal();
  });

  btnCloseHelp.addEventListener("click", () => {
    helpModal.close();
  });

  btnDismissHelp.addEventListener("click", () => {
    helpModal.close();
  });

  // Tools Actions
  const handleFormatDocument = () => {
    try {
      const current = editor.getContent();
      const formatted = TMDRefactor.format(current);
      editor.setContent(formatted);
      updateInspector(formatted);
      updateProblems(formatted);
      showToast(t("toastFormatted"));
    } catch (err: any) {
      showToast(t("errorRefactor").replace("{error}", err.message || String(err)), "error");
    }
  };

  toolFormatDocument?.addEventListener("click", () => {
    toolsDropdown?.classList.remove("open");
    handleFormatDocument();
  });

  // Grid Subdivision Transform (Double / Halve)
  toolDoubleGrid?.addEventListener("click", () => {
    toolsDropdown?.classList.remove("open");
    const selection = editor.getSelection();
    try {
      if (selection && selection.trim().length > 0) {
        const doubled = TMDRefactor.doubleGrid(selection);
        editor.replaceSelection(doubled);
      } else {
        const full = editor.getContent();
        const doubled = TMDRefactor.doubleGrid(full);
        editor.setContent(doubled);
      }
      const updated = editor.getContent();
      updateInspector(updated);
      updateProblems(updated);
      showToast(t("toastDoubleGrid"));
    } catch (err: any) {
      showToast(t("errorRefactor").replace("{error}", err.message || String(err)), "error");
    }
  });

  toolHalveGrid?.addEventListener("click", () => {
    toolsDropdown?.classList.remove("open");
    const selection = editor.getSelection();
    try {
      if (selection && selection.trim().length > 0) {
        const halved = TMDRefactor.halveGrid(selection);
        editor.replaceSelection(halved);
      } else {
        const full = editor.getContent();
        const halved = TMDRefactor.halveGrid(full);
        editor.setContent(halved);
      }
      const updated = editor.getContent();
      updateInspector(updated);
      updateProblems(updated);
      showToast(t("toastHalveGrid"));
    } catch (err: any) {
      showToast(t("errorRefactor").replace("{error}", err.message || String(err)), "error");
    }
  });

  // Rename Instrument Modal
  toolRenameInstrument?.addEventListener("click", () => {
    toolsDropdown?.classList.remove("open");
    const text = editor.getContent();
    let sheet: Sheet | null = null;
    try {
      sheet = TmdParser.parse(text);
    } catch (e) {
      // ignore
    }
    const instruments = Array.from(new Set(sheet?.paragraphs.map((p) => p.instrument) || []));
    refactorOldInst.innerHTML = instruments
      .map((inst) => `<option value="${escapeHtml(inst)}">${escapeHtml(inst)}</option>`)
      .join("");
    refactorNewInst.value = "";
    refactorInstrumentModal.showModal();
  });

  btnConfirmRenameInst?.addEventListener("click", () => {
    const oldInst = refactorOldInst.value;
    const newInst = refactorNewInst.value.trim();
    if (!oldInst || !newInst) return;
    try {
      const text = editor.getContent();
      const refactored = TMDRefactor.renameInstrument(text, oldInst, newInst);
      editor.setContent(refactored);
      updateInspector(refactored);
      updateProblems(refactored);
      refactorInstrumentModal.close();
      showToast(t("toastRenamedInstrument"));
    } catch (err: any) {
      showToast(t("errorRefactor").replace("{error}", err.message || String(err)), "error");
    }
  });

  // Rename Section Modal
  toolRenameSection?.addEventListener("click", () => {
    toolsDropdown?.classList.remove("open");
    const text = editor.getContent();
    let sheet: Sheet | null = null;
    try {
      sheet = TmdParser.parse(text);
    } catch (e) {
      // ignore
    }
    const sections = Array.from(new Set(sheet?.paragraphs.map((p) => p.name) || []));
    refactorOldSec.innerHTML = sections
      .map((sec) => `<option value="${escapeHtml(sec)}">${escapeHtml(sec)}</option>`)
      .join("");
    refactorNewSec.value = "";
    refactorSectionModal.showModal();
  });

  btnConfirmRenameSec?.addEventListener("click", () => {
    const oldSec = refactorOldSec.value;
    const newSec = refactorNewSec.value.trim();
    if (!oldSec || !newSec) return;
    try {
      const text = editor.getContent();
      const refactored = TMDRefactor.renameSection(text, oldSec, newSec);
      editor.setContent(refactored);
      updateInspector(refactored);
      updateProblems(refactored);
      refactorSectionModal.close();
      showToast(t("toastRenamedSection"));
    } catch (err: any) {
      showToast(t("errorRefactor").replace("{error}", err.message || String(err)), "error");
    }
  });

  // Extract Instrument Modal
  toolExtractInstrument?.addEventListener("click", () => {
    toolsDropdown?.classList.remove("open");
    const text = editor.getContent();
    let sheet: Sheet | null = null;
    try {
      sheet = TmdParser.parse(text);
    } catch (e) {
      // ignore
    }
    const instruments = Array.from(new Set(sheet?.paragraphs.map((p) => p.instrument) || []));
    refactorExtractInst.innerHTML = instruments
      .map((inst) => `<option value="${escapeHtml(inst)}">${escapeHtml(inst)}</option>`)
      .join("");
    refactorExtractModal.showModal();
  });

  btnConfirmExtract?.addEventListener("click", async () => {
    const inst = refactorExtractInst.value;
    if (!inst) return;
    try {
      const text = editor.getContent();
      const extractedTmd = TMDRefactor.extractInstrument(text, inst);
      const title = extractTmdTitle(extractedTmd) || `${inst}_score`;
      const newScore = await TmdStorage.saveScore({
        title,
        content: extractedTmd,
      });
      loadScoreIntoEditor(newScore);
      refactorExtractModal.close();
      showToast(t("toastExtracted"));
    } catch (err: any) {
      showToast(t("errorRefactor").replace("{error}", err.message || String(err)), "error");
    }
  });

  // Context-aware modal openers
  let activeContextSection: string | undefined;

  const openDuplicateModal = (initialSection?: string, initialInstrument?: string) => {
    toolsDropdown?.classList.remove("open");
    closeContextMenu();
    const text = editor.getContent();
    let sheet: Sheet | null = null;
    try {
      sheet = TmdParser.parse(text);
    } catch (e) {
      // ignore
    }
    const instruments = Array.from(new Set(sheet?.paragraphs.map((p) => p.instrument) || []));
    refactorDupSource.innerHTML = instruments
      .map((inst) => `<option value="${escapeHtml(inst)}" ${inst === initialInstrument ? "selected" : ""}>${escapeHtml(inst)}</option>`)
      .join("");
    refactorDupTarget.value = "";
    refactorDupOctave.value = "0";

    activeContextSection = initialSection;
    if (initialSection) {
      refactorDupScopeGroup.style.display = "block";
      refactorDupScopeSection.checked = true;
      refactorDupScopeSectionLabel.textContent = t("scopeSectionOnly").replace("{section}", initialSection);
    } else {
      refactorDupScopeGroup.style.display = "none";
      refactorDupScopeGlobal.checked = true;
    }

    refactorDuplicateModal.showModal();
  };

  const openHarmonyModal = (initialSection?: string, initialInstrument?: string) => {
    toolsDropdown?.classList.remove("open");
    closeContextMenu();
    const text = editor.getContent();
    let sheet: Sheet | null = null;
    try {
      sheet = TmdParser.parse(text);
    } catch (e) {
      // ignore
    }
    const instruments = Array.from(new Set(sheet?.paragraphs.map((p) => p.instrument) || []));
    refactorHarmSource.innerHTML = instruments
      .map((inst) => `<option value="${escapeHtml(inst)}" ${inst === initialInstrument ? "selected" : ""}>${escapeHtml(inst)}</option>`)
      .join("");
    refactorHarmTarget.value = "";
    refactorHarmInterval.value = "2";

    activeContextSection = initialSection;
    if (initialSection) {
      refactorHarmScopeGroup.style.display = "block";
      refactorHarmScopeSection.checked = true;
      refactorHarmScopeSectionLabel.textContent = t("scopeSectionOnly").replace("{section}", initialSection);
    } else {
      refactorHarmScopeGroup.style.display = "none";
      refactorHarmScopeGlobal.checked = true;
    }

    refactorHarmonyModal.showModal();
  };

  // Duplicate Track Modal
  toolDuplicateTrack?.addEventListener("click", () => {
    openDuplicateModal();
  });

  btnConfirmDuplicate?.addEventListener("click", () => {
    const source = refactorDupSource.value;
    const target = refactorDupTarget.value.trim();
    const octaveShift = parseInt(refactorDupOctave.value, 10) || 0;
    const isSectionOnly = refactorDupScopeSection.checked && activeContextSection;
    const section = isSectionOnly ? activeContextSection : undefined;

    if (!source || !target) return;
    try {
      const text = editor.getContent();
      const refactored = TMDRefactor.duplicateTrack(text, source, target, { section, octaveShift });
      editor.setContent(refactored);
      updateInspector(refactored);
      updateProblems(refactored);
      refactorDuplicateModal.close();
      showToast(t("toastDuplicatedTrack"));
    } catch (err: any) {
      showToast(t("errorRefactor").replace("{error}", err.message || String(err)), "error");
    }
  });

  // Generate Harmony Modal
  toolGenerateHarmony?.addEventListener("click", () => {
    openHarmonyModal();
  });

  btnConfirmHarmony?.addEventListener("click", () => {
    const source = refactorHarmSource.value;
    const target = refactorHarmTarget.value.trim();
    const intervalSteps = parseInt(refactorHarmInterval.value, 10) || 0;
    const isSectionOnly = refactorHarmScopeSection.checked && activeContextSection;
    const section = isSectionOnly ? activeContextSection : undefined;

    if (!source || !target) return;
    try {
      const text = editor.getContent();
      const refactored = TMDRefactor.generateHarmony(text, source, target, { section, intervalSteps });
      editor.setContent(refactored);
      updateInspector(refactored);
      updateProblems(refactored);
      refactorHarmonyModal.close();
      showToast(t("toastGeneratedHarmony"));
    } catch (err: any) {
      showToast(t("errorRefactor").replace("{error}", err.message || String(err)), "error");
    }
  });

  // Inline Orders
  toolInlineOrders?.addEventListener("click", () => {
    toolsDropdown?.classList.remove("open");
    if (!confirm(t("confirmInlineOrders"))) return;
    try {
      const text = editor.getContent();
      const inlined = TMDRefactor.inlineOrders(text);
      editor.setContent(inlined);
      updateInspector(inlined);
      updateProblems(inlined);
      showToast(t("toastInlinedOrders"));
    } catch (err: any) {
      showToast(t("errorRefactor").replace("{error}", err.message || String(err)), "error");
    }
  });

  // Close modals on cancel button click
  document.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      refactorInstrumentModal?.close();
      refactorSectionModal?.close();
      refactorExtractModal?.close();
      refactorDuplicateModal?.close();
      refactorHarmonyModal?.close();
      insertSectionModal?.close();
    });
  });

  // Context Menu Handling
  const closeContextMenu = () => {
    if (editorContextMenu) {
      editorContextMenu.style.display = "none";
    }
  };

  window.addEventListener("click", (e) => {
    if (!editorContextMenu.contains(e.target as Node)) {
      closeContextMenu();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeContextMenu();
    }
  });

  const editorContainerEl = document.getElementById("editor-container")!;
  editorContainerEl.addEventListener("contextmenu", (e: MouseEvent) => {
    e.preventDefault();
    const ctx = editor.getCursorContext();

    if (ctx.section && ctx.instrument) {
      ctxHeaderInfo.style.display = "block";
      ctxHeaderInfo.textContent = `📍 [${ctx.section}:${ctx.instrument}]`;
    } else if (ctx.section) {
      ctxHeaderInfo.style.display = "block";
      ctxHeaderInfo.textContent = `📍 Section: [${ctx.section}]`;
    } else {
      ctxHeaderInfo.style.display = "none";
    }

    if (ctx.hasSelection) {
      ctxFormatLabel.textContent = "格式化選取範圍 (Format Selection)";
    } else {
      ctxFormatLabel.textContent = t("toolFormatDocument");
    }

    // Position menu safely inside viewport
    editorContextMenu.style.display = "flex";
    const menuWidth = 220;
    const menuHeight = 280;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = Math.max(10, window.innerWidth - menuWidth - 10);
    }
    if (y + menuHeight > window.innerHeight) {
      y = Math.max(10, window.innerHeight - menuHeight - 10);
    }

    editorContextMenu.style.left = `${x}px`;
    editorContextMenu.style.top = `${y}px`;
  });

  ctxFormat?.addEventListener("click", () => {
    closeContextMenu();
    handleFormatDocument();
  });

  ctxDoubleGrid?.addEventListener("click", () => {
    closeContextMenu();
    toolDoubleGrid.click();
  });

  ctxHalveGrid?.addEventListener("click", () => {
    closeContextMenu();
    toolHalveGrid.click();
  });

  // Insert Section Modal & Snippet Generation
  const openInsertSectionModal = () => {
    toolsDropdown?.classList.remove("open");
    closeContextMenu();
    const ctx = editor.getCursorContext();
    if (ctx.section) {
      insertSecName.value = `${ctx.section}_new`;
    } else {
      insertSecName.value = "verse2";
    }
    if (ctx.instrument) {
      insertSecInst.value = ctx.instrument;
    } else {
      insertSecInst.value = "Lead";
    }
    insertSectionModal.showModal();
  };

  toolInsertSection?.addEventListener("click", () => {
    openInsertSectionModal();
  });

  ctxInsertSection?.addEventListener("click", () => {
    openInsertSectionModal();
  });

  btnConfirmInsertSec?.addEventListener("click", () => {
    const secName = insertSecName.value.trim() || "verse";
    const instName = insertSecInst.value.trim() || "Lead";
    const templateType = insertSecTemplate.value;
    const measures = parseInt(insertSecMeasures.value, 10) || 4;

    let bars = "";
    if (templateType === "melody") {
      const barPatterns = [
        "| 1 2 3 5 |",
        "| 6 5 3 - |",
        "| 2 3 2 1 |",
        "| 2 - - - |",
        "| 1 2 3 5 |",
        "| 6 1^ 6 5 |",
        "| 3 5 2 3 |",
        "| 1 - - - |",
      ];
      bars = Array.from({ length: measures }, (_, i) => barPatterns[i % barPatterns.length]).join("\n  ");
    } else if (templateType === "chords") {
      const chordPatterns = [
        "| [1] - - - |",
        "| [5] - - - |",
        "| [6m] - - - |",
        "| [4] - - - |",
        "| [1] - - - |",
        "| [4] - - - |",
        "| [5] - - - |",
        "| [1] - - - |",
      ];
      bars = Array.from({ length: measures }, (_, i) => chordPatterns[i % chordPatterns.length]).join("\n  ");
    } else if (templateType === "drums") {
      const drumPatterns = [
        "| D - S - |",
        "| D D S - |",
        "| D - S - |",
        "| D - (xxxx) - |",
      ];
      bars = Array.from({ length: measures }, (_, i) => drumPatterns[i % drumPatterns.length]).join("\n  ");
    } else if (templateType === "bass") {
      const bassPatterns = [
        "| 1_ - - - |",
        "| 5_ - - - |",
        "| 6_ - - - |",
        "| 4_ - - - |",
      ];
      bars = Array.from({ length: measures }, (_, i) => bassPatterns[i % bassPatterns.length]).join("\n  ");
    }

    const snippet = `\n${secName}:${instName}@|0|{\n  <4*>\n  ${bars}\n}\n`;

    // Also update order if section not present in order sequence
    let currentScore = editor.getContent();
    editor.insertAtCursor(snippet);
    const updated = editor.getContent();
    updateInspector(updated);
    updateProblems(updated);
    insertSectionModal.close();
    showToast(t("toastInsertedSection"));
  });

  // Hum to TMD Modal & Recording
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let isHumRecording = false;
  let humTranscribedSnippet = "";

  const openHumModal = () => {
    if (currentSheet) {
      if (humBpm) humBpm.value = currentSheet.speed > 0 ? String(currentSheet.speed) : "120";
      if (humKey) humKey.value = currentSheet.keySignature ? currentSheet.keySignature.toString().replace("'", "#") : "C";
    }
    if (humResultCode) humResultCode.value = "";
    if (humBtnApply) humBtnApply.disabled = true;
    if (humBtnPlayPreview) humBtnPlayPreview.style.display = "none";
    if (humStatusIndicator) humStatusIndicator.textContent = t("humStatusIdle");
    humModal?.showModal();
  };

  btnHumRecording?.addEventListener("click", openHumModal);
  toolHumRecording?.addEventListener("click", openHumModal);

  humBtnRecord?.addEventListener("click", async () => {
    if (!isHumRecording) {
      // Start Recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunks.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          // Stop stream tracks
          stream.getTracks().forEach((track) => track.stop());

          if (humStatusIndicator) humStatusIndicator.textContent = t("humStatusProcessing");
          if (humRecordIcon) humRecordIcon.textContent = "⏳";
          if (humRecordText) humRecordText.textContent = t("humStatusProcessing");
          humBtnRecord.disabled = true;

          try {
            const audioBlob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || "audio/webm" });
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const rawBuffer = await audioContext.decodeAudioData(arrayBuffer);
            // Basic Pitch expects 22050 Hz mono audioBuffer
            const audioBuffer = await resampleAudioBuffer(rawBuffer, 22050);

            // Dynamically import @spotify/basic-pitch to avoid loading tensorflow at startup
            const { BasicPitch, noteFramesToTime, outputToNotesPoly } = await import("@spotify/basic-pitch");
            const basicPitch = new BasicPitch("https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json");

            const frames: number[][] = [];
            const onsets: number[][] = [];
            const contours: number[][] = [];

            await basicPitch.evaluateModel(
              audioBuffer,
              (f: number[][], o: number[][], c: number[][]) => {
                frames.push(...f);
                onsets.push(...o);
                contours.push(...c);
              },
              (_pct: number) => {}
            );

            const notes = outputToNotesPoly(frames, onsets, 0.25, 0.25, 5);
            const noteEvents = noteFramesToTime(notes);

            const bpm = parseInt(humBpm?.value || "120", 10) || 120;
            const grid = parseInt(humGrid?.value || "8", 10) || 8;
            const key = humKey?.value || "C";
            const secName = humSectionName?.value.trim() || "hummed";
            const instName = humInstrument?.value.trim() || "Vocal";

            const tmdSnippet = quantizeNoteEventsToTmdSection(noteEvents, {
              sectionName: secName,
              instrument: instName,
              bpm,
              grid,
              key,
              beatsPerMeasure: currentSheet?.beat?.count || 4,
            });

            humTranscribedSnippet = tmdSnippet;
            if (humResultCode) humResultCode.value = tmdSnippet;
            if (humStatusIndicator) humStatusIndicator.textContent = t("humStatusSuccess");
            if (humBtnApply) humBtnApply.disabled = false;
            if (humBtnPlayPreview) humBtnPlayPreview.style.display = "inline-flex";
          } catch (err: any) {
            console.error("Basic Pitch error:", err);
            if (humStatusIndicator) {
              humStatusIndicator.textContent = t("humStatusError").replace("{error}", err.message || String(err));
            }
          } finally {
            humBtnRecord.disabled = false;
            if (humRecordIcon) humRecordIcon.textContent = "🔴";
            if (humRecordText) humRecordText.textContent = t("humBtnRecord");
          }
        };

        mediaRecorder.start();
        isHumRecording = true;
        if (humRecordIcon) humRecordIcon.textContent = "⏹️";
        if (humRecordText) humRecordText.textContent = t("humBtnStop");
        if (humStatusIndicator) humStatusIndicator.textContent = t("humStatusRecording");
      } catch (err: any) {
        alert(`無法存取麥克風: ${err.message}`);
      }
    } else {
      // Stop Recording
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      isHumRecording = false;
    }
  });

  humBtnPlayPreview?.addEventListener("click", () => {
    const code = humResultCode?.value || humTranscribedSnippet;
    if (!code) return;
    const secName = humSectionName?.value.trim() || "hummed";
    const instName = humInstrument?.value.trim() || "Vocal";
    const key = humKey?.value || "C";
    const bpm = humBpm?.value || "120";

    const previewTmd = `::SCORE::\n** Hummed Preview **\n!= ${bpm}\n?= ${key}\n<4/4>\n\n${code}\n\n-> ${secName} ->#\n`;
    startPlayback(previewTmd);
  });

  humBtnApply?.addEventListener("click", () => {
    const code = humResultCode?.value || humTranscribedSnippet;
    if (!code) return;
    editor.insertAtCursor(`\n${code}\n`);
    const updated = editor.getContent();
    updateInspector(updated);
    updateProblems(updated);
    humModal.close();
    showToast(t("toastInsertedSection"));
  });

  ctxDuplicateTrack?.addEventListener("click", () => {
    const ctx = editor.getCursorContext();
    openDuplicateModal(ctx.section, ctx.instrument);
  });

  ctxGenerateHarmony?.addEventListener("click", () => {
    const ctx = editor.getCursorContext();
    openHarmonyModal(ctx.section, ctx.instrument);
  });

  ctxExtractInstrument?.addEventListener("click", () => {
    closeContextMenu();
    toolExtractInstrument.click();
  });

  ctxRenameInstrument?.addEventListener("click", () => {
    closeContextMenu();
    toolRenameInstrument.click();
  });

  ctxRenameSection?.addEventListener("click", () => {
    closeContextMenu();
    toolRenameSection.click();
  });

  // Problems Panel Toggle and Jump
  btnToggleProblems?.addEventListener("click", (e) => {
    e.stopPropagation();
    problemsPanel.classList.toggle("collapsed");
    btnToggleProblems.textContent = problemsPanel.classList.contains("collapsed") ? "▲" : "▼";
  });

  const problemsHeader = problemsPanel?.querySelector(".problems-panel-header");
  problemsHeader?.addEventListener("click", () => {
    problemsPanel.classList.toggle("collapsed");
    if (btnToggleProblems) {
      btnToggleProblems.textContent = problemsPanel.classList.contains("collapsed") ? "▲" : "▼";
    }
  });

  problemsList?.addEventListener("click", (e) => {
    const item = (e.target as HTMLElement).closest(".problem-item") as HTMLElement | null;
    if (item && item.dataset.line) {
      const line = parseInt(item.dataset.line, 10);
      if (!isNaN(line) && line > 0) {
        editor.scrollToLine(line);
      }
    }
  });

  // AI Assistant Drawer & Settings
  let aiSettings = loadAISettings();

  const populateModelPresets = (provider: AIProviderType) => {
    aiSettingsModelPreset.innerHTML = "";
    const presets = MODEL_PRESETS[provider] || [];
    presets.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name}${p.recommended ? " ★" : ""}`;
      aiSettingsModelPreset.appendChild(opt);
    });

    const currentCfg = aiSettings.providers[provider];
    if (presets.some((p) => p.id === currentCfg.model)) {
      aiSettingsModelPreset.value = currentCfg.model;
      aiSettingsModelCustom.value = "";
    } else {
      aiSettingsModelCustom.value = currentCfg.model;
    }

    aiSettingsKey.value = currentCfg.apiKey || "";
    aiSettingsBaseUrl.value = currentCfg.baseUrl || "";
    aiSettingsBaseUrlGroup.style.display = (provider === "custom" || provider === "groq") ? "flex" : "none";

    // Dynamic helper links for API Key
    const providerOfficialUrls: Record<AIProviderType, string> = {
      gemini: "https://aistudio.google.com/app/apikey",
      openai: "https://platform.openai.com/api-keys",
      anthropic: "https://console.anthropic.com/settings/keys",
      groq: "https://console.groq.com/keys",
      custom: "https://platform.deepseek.com/api_keys",
    };

    const providerNames: Record<AIProviderType, string> = {
      gemini: "Google Gemini",
      openai: "OpenAI",
      anthropic: "Anthropic Claude",
      groq: "Groq",
      custom: "DeepSeek / Custom",
    };

    if (aiKeyOfficialLink) {
      aiKeyOfficialLink.href = providerOfficialUrls[provider] || "https://aistudio.google.com/app/apikey";
    }

    if (aiKeyAskAiLink) {
      const isZh = getCurrentLocale() === "zh-TW";
      const q = isZh
        ? encodeURIComponent(`如何申請 ${providerNames[provider]} API key 教學步驟`)
        : encodeURIComponent(`How to get ${providerNames[provider]} API key step by step tutorial`);
      const hl = isZh ? "zh-TW" : "en";
      aiKeyAskAiLink.href = `https://www.google.com/search?q=${q}&hl=${hl}`;
    }
  };

  const openAiSettingsModal = () => {
    aiSettings = loadAISettings();
    aiSettingsProvider.value = aiSettings.activeProvider;
    populateModelPresets(aiSettings.activeProvider);
    aiSettingsModal.showModal();
  };


  // Skill tab actions
  aiBtnDownload?.addEventListener("click", () => {
    downloadSkillFile();
  });

  aiBtnCopySkill?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(TmdSkill.skillMarkdown);
      const prevText = aiBtnCopySkill.textContent;
      aiBtnCopySkill.textContent = `✓ ${t("aiSkillCopied")}`;
      setTimeout(() => {
        aiBtnCopySkill.textContent = prevText;
      }, 2000);
    } catch {
      alert(t("aiSkillCopied"));
    }
  });


  const updateAiSettingsButtonState = () => {
    aiSettings = loadAISettings();
    const currentProvider = aiSettings.activeProvider;
    const currentConfig = aiSettings.providers[currentProvider];
    const hasKey = Boolean(currentConfig?.apiKey?.trim()) || currentProvider === "custom";

    if (!hasKey) {
      btnOpenAiSettings.classList.add("needs-key");
      btnOpenAiSettings.title = `${t("aiSettingsTitle")} (未設定 Key)`;
    } else {
      btnOpenAiSettings.classList.remove("needs-key");
      btnOpenAiSettings.title = `${t("aiSettingsTitle")} (${currentProvider.toUpperCase()})`;
    }
  };

  // Update initial button appearance
  updateAiSettingsButtonState();

  btnToggleAi?.addEventListener("click", () => {
    aiDrawer.classList.toggle("hidden");
    if (!aiDrawer.classList.contains("hidden")) {
      // If on narrow screen, close inspector to avoid overcrowding
      if (window.innerWidth < 800) {
        inspectorPanel.classList.add("hidden");
      }
      aiPromptInput.focus();
      updateAiSettingsButtonState();
    }
  });

  btnCloseAiDrawer?.addEventListener("click", () => {
    aiDrawer.classList.add("hidden");
  });

  btnOpenAiSettings?.addEventListener("click", () => {
    openAiSettingsModal();
  });

  btnCloseAiSettings?.addEventListener("click", () => {
    aiSettingsModal.close();
  });

  btnDismissAiSettings?.addEventListener("click", () => {
    aiSettingsModal.close();
  });

  aiSettingsProvider.addEventListener("change", () => {
    const selected = aiSettingsProvider.value as AIProviderType;
    populateModelPresets(selected);
  });

  btnSaveAiSettings?.addEventListener("click", (e) => {
    e.preventDefault();
    const provider = aiSettingsProvider.value as AIProviderType;
    let customModel = aiSettingsModelCustom.value.trim();
    let key = aiSettingsKey.value.trim();
    const baseUrl = aiSettingsBaseUrl.value.trim();

    // Prevent API key from being accidentally saved or displayed as model name
    if (looksLikeApiKey(customModel) || (key && customModel === key)) {
      if (!key) {
        key = customModel;
        aiSettingsKey.value = key;
      }
      customModel = "";
      aiSettingsModelCustom.value = "";
    }

    let selectedModel = customModel || aiSettingsModelPreset.value || DEFAULT_MODELS[provider];
    if (looksLikeApiKey(selectedModel)) {
      selectedModel = DEFAULT_MODELS[provider];
    }

    aiSettings.activeProvider = provider;
    aiSettings.providers[provider] = {
      apiKey: key,
      model: selectedModel,
      ...(baseUrl ? { baseUrl } : {}),
    };

    saveAISettings(aiSettings);
    updateAiSettingsButtonState();
    aiSettingsModal.close();
    aiStatusText.textContent = t("aiModelApplied").replace("{model}", selectedModel);
  });

  // Preset Buttons
  document.querySelectorAll<HTMLButtonElement>(".ai-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      const prompts: Record<string, string> = {
        compose: "請以流行流行放克風格 (110 BPM, G 大調) 創作一首完整的 4 軌 TMD 歌曲（旋律、和弦、貝斯、鼓組）。",
        arrange: "請保留我現有的主旋律，為它編寫豐富的木吉他分解和弦 [CHORD]、走音貝斯 [Bass] 與動態鼓點 [Drums]。",
        extend: "請接續這段主題動機，發展出情感昂揚的 8 小節副歌，並在最後一小節給予清晰的終止式收尾。",
        reharm: "請重新為目前的旋律安排色彩更豐富的爵士/流行和弦進行（加入 maj7, m7, 7, sus4 或次屬和弦）。",
        debug: "請診斷並修正我這份樂譜的小節拍數、格式錯誤與排版，確保各軌道長度平衡且能正常解析播放。",
      };
      if (mode && prompts[mode]) {
        aiPromptInput.value = prompts[mode];
        aiPromptInput.dataset.activeMode = mode;
        aiPromptInput.focus();
      }
    });
  });

    let lastPromptForRepair = "";
    let lastFaultyValidation: any = null;

    const showValidationFailure = (validation: any) => {
      if (aiValidationBanner) {
        aiValidationBanner.style.display = "flex";
        if (aiValidationMsg) {
          aiValidationMsg.textContent = t("aiValidationError")
            .replace("{line}", String(validation.line))
            .replace("{error}", validation.message);
        }
      }
      if (btnAiPreviewPlay) {
        btnAiPreviewPlay.disabled = true;
        btnAiPreviewPlay.title = t("aiInvalidTmdWarning");
      }
      aiStatusText.textContent = t("aiValidationError")
        .replace("{line}", String(validation.line))
        .replace("{error}", validation.message);
    };

    const handleValidationAndRepair = async (
      tmdCode: string,
      originalPrompt: string,
      provider: AIProviderType,
      config: any,
      allowAutoRepair: boolean
    ) => {
      aiCurrentGeneratedCode = tmdCode;
      const validation = validateTmdCode(tmdCode);

      if (validation.valid) {
        if (aiValidationBanner) aiValidationBanner.style.display = "none";
        if (btnAiPreviewPlay) {
          btnAiPreviewPlay.disabled = false;
          btnAiPreviewPlay.title = t("aiBtnPlayPreview");
        }
        lastFaultyValidation = null;
        aiStatusText.textContent = allowAutoRepair ? t("aiStatusDone") : t("aiStatusRepaired");
        return;
      }

      // Syntax error detected
      lastFaultyValidation = validation;
      lastPromptForRepair = originalPrompt;

      if (allowAutoRepair) {
        // Auto-Repair loop: 1 automatic retry
        aiStatusText.textContent = t("aiStatusAutoRepairing").replace("{line}", String(validation.line));
        const repairPrompt = buildRepairPrompt({
          originalPrompt,
          faultyTmd: tmdCode,
          errorMessage: validation.message,
          line: validation.line,
          column: validation.column,
          snippet: validation.snippet,
          expectedTokens: validation.expectedTokens,
        });

        let repairAccumulated = "";
        aiResultOutput.textContent = "";

        repairAccumulated = await callAI(provider, config, {
          prompt: repairPrompt,
          currentTmd: tmdCode,
          mode: "debug",
          signal: aiAbortController?.signal,
          onChunk: (chunk) => {
            repairAccumulated += chunk;
            aiResultOutput.textContent = repairAccumulated;
            aiResultOutput.scrollTop = aiResultOutput.scrollHeight;
          },
        });

        aiResultOutput.textContent = repairAccumulated;
        const repairedCode = extractTmdCode(repairAccumulated);
        if (repairedCode) {
          await handleValidationAndRepair(repairedCode, originalPrompt, provider, config, false);
        } else {
          showValidationFailure(validation);
          aiStatusText.textContent = t("aiNoCodeFound");
        }
      } else {
        showValidationFailure(validation);
      }
    };

    // AI Generation
    btnAiGenerate?.addEventListener("click", async () => {
      const prompt = aiPromptInput.value.trim();
      if (!prompt) {
        aiPromptInput.focus();
        return;
      }

      aiSettings = loadAISettings();
      const provider = aiSettings.activeProvider;
      const config = aiSettings.providers[provider];

      if (!config.apiKey.trim() && provider !== "custom") {
        alert(t("aiMissingApiKey"));
        aiSettingsProvider.value = provider;
        populateModelPresets(provider);
        aiSettingsModal.showModal();
        return;
      }

      aiAbortController = new AbortController();
      btnAiGenerate.style.display = "none";
      btnAiStop.style.display = "inline-flex";
      aiStatusText.textContent = t("aiStatusGenerating");
      aiResultContainer.style.display = "block";
      if (aiValidationBanner) aiValidationBanner.style.display = "none";
      if (btnAiPreviewPlay) {
        btnAiPreviewPlay.disabled = false;
        btnAiPreviewPlay.title = t("aiBtnPlayPreview");
      }
      aiResultOutput.textContent = "";
      aiCurrentGeneratedCode = "";

      const mode = (aiPromptInput.dataset.activeMode as any) || "compose";
      let accumulatedText = "";

      try {
        accumulatedText = await callAI(provider, config, {
          prompt,
          currentTmd: editor.getContent(),
          mode,
          signal: aiAbortController.signal,
          onChunk: (chunk) => {
            accumulatedText += chunk;
            aiResultOutput.textContent = accumulatedText;
            aiResultOutput.scrollTop = aiResultOutput.scrollHeight;
          },
        });

        aiResultOutput.textContent = accumulatedText;
        const extracted = extractTmdCode(accumulatedText);
        if (extracted) {
          await handleValidationAndRepair(extracted, prompt, provider, config, true);
        } else {
          aiStatusText.textContent = t("aiNoCodeFound");
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          aiStatusText.textContent = "已停止生成。";
        } else {
          aiStatusText.textContent = `生成失敗: ${err.message}`;
        }
      } finally {
        btnAiGenerate.style.display = "inline-flex";
        btnAiStop.style.display = "none";
        aiAbortController = null;
      }
    });

    btnAiRetryRepair?.addEventListener("click", async () => {
      if (!aiCurrentGeneratedCode || !lastFaultyValidation) return;
      const provider = aiSettings.activeProvider;
      const config = aiSettings.providers[provider];

      aiAbortController = new AbortController();
      btnAiGenerate.style.display = "none";
      btnAiStop.style.display = "inline-flex";
      aiStatusText.textContent = t("aiStatusAutoRepairing").replace("{line}", String(lastFaultyValidation.line));

      try {
        const repairPrompt = buildRepairPrompt({
          originalPrompt: lastPromptForRepair || "Fix TMD syntax",
          faultyTmd: aiCurrentGeneratedCode,
          errorMessage: lastFaultyValidation.message,
          line: lastFaultyValidation.line,
          column: lastFaultyValidation.column,
          snippet: lastFaultyValidation.snippet,
          expectedTokens: lastFaultyValidation.expectedTokens,
        });

        let repairAccumulated = "";
        aiResultOutput.textContent = "";

        repairAccumulated = await callAI(provider, config, {
          prompt: repairPrompt,
          currentTmd: aiCurrentGeneratedCode,
          mode: "debug",
          signal: aiAbortController.signal,
          onChunk: (chunk) => {
            repairAccumulated += chunk;
            aiResultOutput.textContent = repairAccumulated;
            aiResultOutput.scrollTop = aiResultOutput.scrollHeight;
          },
        });

        aiResultOutput.textContent = repairAccumulated;
        const repairedCode = extractTmdCode(repairAccumulated);
        if (repairedCode) {
          await handleValidationAndRepair(repairedCode, lastPromptForRepair, provider, config, false);
        } else {
          showValidationFailure(lastFaultyValidation);
          aiStatusText.textContent = t("aiNoCodeFound");
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          aiStatusText.textContent = "已停止生成。";
        } else {
          aiStatusText.textContent = `生成失敗: ${err.message}`;
        }
      } finally {
        btnAiGenerate.style.display = "inline-flex";
        btnAiStop.style.display = "none";
        aiAbortController = null;
      }
    });

    btnAiStop?.addEventListener("click", () => {
      if (aiAbortController) {
        aiAbortController.abort();
      }
    });

    btnAiPreviewPlay?.addEventListener("click", () => {
      const codeToPlay = aiCurrentGeneratedCode || extractTmdCode(aiResultOutput.textContent || "");
      if (!codeToPlay) {
        return alert(t("aiNoCodeFound"));
      }
      const check = validateTmdCode(codeToPlay);
      if (!check.valid) {
        return alert(t("aiInvalidTmdWarning"));
      }
      startPlayback(codeToPlay);
    });

  btnAiCopyCode?.addEventListener("click", async () => {
    const codeToCopy = aiCurrentGeneratedCode || extractTmdCode(aiResultOutput.textContent || "") || aiResultOutput.textContent || "";
    if (!codeToCopy) return;
    try {
      await navigator.clipboard.writeText(codeToCopy);
      const prev = btnAiCopyCode.textContent;
      btnAiCopyCode.textContent = "✓ 已複製";
      setTimeout(() => {
        btnAiCopyCode.textContent = prev;
      }, 2000);
    } catch {
      alert("已複製代碼！");
    }
  });

  btnAiApplyReplace?.addEventListener("click", () => {
    const code = aiCurrentGeneratedCode || extractTmdCode(aiResultOutput.textContent || "");
    if (!code) return alert(t("aiNoCodeFound"));
    editor.setContent(code);
    updateInspector(code);
    aiStatusText.textContent = t("aiAppliedSuccess");
  });

  btnAiApplyInsert?.addEventListener("click", () => {
    const code = aiCurrentGeneratedCode || extractTmdCode(aiResultOutput.textContent || "");
    if (!code) return alert(t("aiNoCodeFound"));
    editor.insertAtCursor(`\n${code}\n`);
    updateInspector(editor.getContent());
    aiStatusText.textContent = t("aiAppliedSuccess");
  });
}

async function init() {
  const container = document.getElementById("editor-container")!;
  const defaultSample = SAMPLES[0]; // 《三天三夜》

  let initialContent = defaultSample.content;
  currentScoreId = null;
  isTemplateScore = true;
  activeTemplateId = defaultSample.id;

  // Apply the language first, so a message about a bad share link uses the right language.
  applyI18n(detectLanguage());

  try {
    const shared = await importSharedScore();
    if (shared) TmdStorage.setActiveScoreId(shared.id);
    const activeId = TmdStorage.getActiveScoreId();
    if (activeId) {
      const saved = shared ?? (await TmdStorage.getScore(activeId));
      if (saved) {
        initialContent = saved.content;
        currentScoreId = saved.id;
        isTemplateScore = false;
        activeTemplateId = null;
      }
    }
  } catch (e) {
    console.warn("Could not restore active score from storage:", e);
  }

  editor = createTmdEditor(
    container,
    initialContent,
    handleEditorChange,
    (line, col) => {
      if (sbCursor) {
        sbCursor.textContent = `Ln ${line}, Col ${col}`;
      }
    },
    () => {
      try {
        const current = editor.getContent();
        const formatted = TMDRefactor.format(current);
        editor.setContent(formatted);
        updateInspector(formatted);
        updateProblems(formatted);
        showToast(t("toastFormatted"));
      } catch (err: any) {
        showToast(t("errorRefactor").replace("{error}", err.message || String(err)), "error");
      }
    },
    (section, instrument) => {
      playSectionOrTrack(section, instrument);
    }
  );

  initEvents();
  updateInspector(initialContent);
  updateProblems(initialContent);

  // Initialize Web MCP service
  try {
    initTmdWebMcp(window, {
      getCurrentScore: () => editor.getContent(),
      loadScoreToEditor: (text: string) => {
        editor.setContent(text);
        updateInspector(text);
      },
      startPlayback: () => {
        startPlayback(editor.getContent());
      },
    });
  } catch (err) {
    console.warn("Failed to initialize Web MCP:", err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Initialization failed:", err));
});

