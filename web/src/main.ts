import { TmdParser } from "../../src/core/parser.js";
import { Sheet } from "../../src/core/types.js";
import { TMDRefactor } from "../../src/core/refactor.js";
import { createTmdEditor, TMDWebEditor } from "./editor.js";
import { SAMPLES } from "./samples.js";
import {
  applyI18n,
  detectLanguage,
  getCurrentLocale,
  t,
  onLanguageChange,
  Locale,
} from "./i18n.js";
import { AIProviderType } from "./ai/index.js";
import { initTmdWebMcp } from "./mcp/webmcpIntegration.js";
import { TmdStorage, SavedScore, extractTmdTitle } from "./storage/db.js";
import { decodeShareHash } from "./share.js";

// Extracted UI Controllers & Helpers
import { renderInspectorView, setupInspectorPanelEvents } from "./ui/inspector.js";
import { updateProblemsPanel, setupProblemsPanelEvents } from "./ui/problemsPanel.js";
import { loadPanelsState, savePanelsState, applyPanelsState } from "./ui/panelState.js";
import { TMDPlayerController } from "./ui/playerBar.js";
import { TMDLibraryDrawerController } from "./ui/libraryDrawer.js";
import { TMDAIDrawerController } from "./ui/aiDrawer.js";
import { setupExportMenu } from "./ui/exportMenu.js";
import { TMDToolsAndContextMenuController } from "./ui/toolsMenu.js";
import { setupRefactorModals } from "./ui/modals/refactorModals.js";
import { setupInsertSectionModal } from "./ui/modals/insertSectionModal.js";
import { setupHumModal } from "./ui/modals/humModal.js";

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
const helpModal = document.getElementById("help-modal") as HTMLDialogElement;
const btnHelp = document.getElementById("btn-help") as HTMLButtonElement;
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
const aiPreviewProblemsBadge = document.getElementById("ai-preview-problems-badge") as HTMLElement;
const aiPreviewProblemsList = document.getElementById("ai-preview-problems-list") as HTMLElement;
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
const aiSettingsBaseUrlGroup = document.getElementById("ai-settings-baseurl-group") as HTMLElement;

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
const btnFixProblemsAi = document.getElementById("btn-fix-problems-ai") as HTMLButtonElement;
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
const ctxComment = document.getElementById("ctx-comment") as HTMLButtonElement;
const ctxInsertSection = document.getElementById("ctx-insert-section") as HTMLButtonElement;
const ctxDoubleGrid = document.getElementById("ctx-double-grid") as HTMLButtonElement;
const ctxHalveGrid = document.getElementById("ctx-halve-grid") as HTMLButtonElement;
const ctxDuplicateTrack = document.getElementById("ctx-duplicate-track") as HTMLButtonElement;
const ctxGenerateHarmony = document.getElementById("ctx-generate-harmony") as HTMLButtonElement;
const ctxExtractInstrument = document.getElementById("ctx-extract-instrument") as HTMLButtonElement;
const ctxRenameInstrument = document.getElementById("ctx-rename-instrument") as HTMLButtonElement;
const ctxRenameSection = document.getElementById("ctx-rename-section") as HTMLButtonElement;
const ctxHumRecording = document.getElementById("ctx-hum-recording") as HTMLButtonElement;

// Hum to TMD elements
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
const humSnapScale = document.getElementById("hum-snap-scale") as HTMLInputElement;
const humEnableMetronome = document.getElementById("hum-enable-metronome") as HTMLInputElement;
const humEnableCountIn = document.getElementById("hum-enable-countin") as HTMLInputElement;
const humResultCode = document.getElementById("hum-result-code") as HTMLTextAreaElement;
const humBtnPlayPreview = document.getElementById("hum-btn-play-preview") as HTMLButtonElement;
const humBtnApply = document.getElementById("hum-btn-apply") as HTMLButtonElement;

// Player Bar
const tmdPlayerBar = document.getElementById("tmd-player-bar") as HTMLElement;
const playerTitle = document.getElementById("player-title") as HTMLElement;
const playerTime = document.getElementById("player-time") as HTMLElement;
const playerProgress = document.getElementById("player-progress") as HTMLInputElement;
const synthSelect = document.getElementById("synth-select") as HTMLSelectElement;
const playerBtnPause = document.getElementById("player-btn-pause") as HTMLButtonElement;
const playerBtnClose = document.getElementById("player-btn-close") as HTMLButtonElement;

let editor: TMDWebEditor;
let currentSheet: Sheet | null = null;
let autoSaveTimer: any = null;

// Controller instances
let playerController: TMDPlayerController;
let libraryController: TMDLibraryDrawerController;
let aiDrawerController: TMDAIDrawerController;
let toolsAndContextController: TMDToolsAndContextMenuController;

function clearShareHash() {
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

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

function triggerSavePanelsState() {
  savePanelsState({
    libraryDrawer,
    aiDrawer,
    inspectorPanel,
    problemsPanel,
    btnToggleProblems,
  });
}

function updateProblems(text: string) {
  updateProblemsPanel(text, {
    problemsPanel,
    btnToggleProblems,
    btnFixProblemsAi,
    problemsCountBadge,
    problemsList,
  });
}

function updateInspector(text: string) {
  currentSheet = renderInspectorView(
    text,
    {
      inspectorStatus,
      statTitle,
      statTempo,
      statKey,
      statMeter,
      inspectorOrders,
      inspectorTracks,
      sbStatus,
      sbSummary,
    },
    (code) => TmdParser.parse(code)
  );
}

function handleScoreUpdated(newText: string) {
  updateInspector(newText);
  updateProblems(newText);
}

let parseDebounceTimer: any = null;
function handleEditorChange(text: string) {
  clearTimeout(parseDebounceTimer);
  parseDebounceTimer = setTimeout(() => {
    updateInspector(text);
    updateProblems(text);
  }, 200);

  // Auto-save to IndexedDB (Debounced 500ms)
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    try {
      if (libraryController.getIsTemplateScore()) {
        const title = extractTmdTitle(text);
        const newScore = await TmdStorage.saveScore({
          title,
          content: text,
        });
        libraryController.loadScoreIntoEditor(newScore);
        await libraryController.refreshLibraryScores();
      } else {
        const currentId = libraryController.getCurrentScoreId();
        if (currentId) {
          const title = extractTmdTitle(text);
          await TmdStorage.saveScore({
            id: currentId,
            title,
            content: text,
          });
          TmdStorage.setActiveScoreId(currentId);
          await libraryController.refreshLibraryScores();
        }
      }

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
    console.error("Could not save the shared score:", err);
    alert(t("shareSaveFailed"));
    return null;
  }
  clearShareHash();
  return score;
}

function initEvents() {
  // Setup Controllers
  playerController = new TMDPlayerController(
    {
      tmdPlayerBar,
      playerTitle,
      playerTime,
      playerProgress,
      synthSelect,
      playerBtnPause,
      playerBtnClose,
      btnPlay,
    },
    () => editor
  );
  playerController.init();

  libraryController = new TMDLibraryDrawerController(
    {
      libraryDrawer,
      btnToggleLibrary,
      btnCloseLibrary,
      btnLibraryNew,
      inputImportTmd,
      libraryScoresList,
      librarySamplesList,
      libraryScoresCount,
    },
    () => editor,
    (text) => handleScoreUpdated(text),
    () => triggerSavePanelsState()
  );
  libraryController.init();

  toolsAndContextController = new TMDToolsAndContextMenuController(
    {
      editorContextMenu,
      ctxHeaderInfo,
      ctxFormat,
      ctxFormatLabel,
      ctxComment,
      ctxInsertSection,
      ctxDoubleGrid,
      ctxHalveGrid,
      ctxDuplicateTrack,
      ctxGenerateHarmony,
      ctxExtractInstrument,
      ctxRenameInstrument,
      ctxRenameSection,
      ctxHumRecording,
    },
    {
      toolsDropdown,
      btnToolsMenu,
      toolFormatDocument,
      toolDoubleGrid,
      toolHalveGrid,
      exportDropdown,
    },
    () => editor,
    (text) => handleScoreUpdated(text),
    (msg, type) => showToast(msg, type)
  );
  toolsAndContextController.init();

  setupInspectorPanelEvents(
    {
      inspectorPanel,
      btnToggleInspector,
      btnCloseInspector,
      inspectorTracks,
      inspectorOrders,
    },
    editor,
    () => triggerSavePanelsState(),
    (sec, inst) => playerController.playSectionOrTrack(sec, inst),
    (idx) => playerController.playFromOrderIndex(idx)
  );

  setupExportMenu(
    {
      exportDropdown,
      btnExportMenu,
      btnExportTmd,
      btnExportMidi,
      btnExportReaper,
      btnExportMusicXML,
      btnExportLilyPond,
      btnExportABC,
      btnExportVsq,
      btnExportVsqx,
      btnExportWAV,
      btnExportSkill,
      btnExportLibraryZip,
      btnBackupZip,
      btnShare,
      toolsDropdown,
    },
    () => editor
  );

  const { openDuplicateModal, openHarmonyModal } = setupRefactorModals(
    {
      refactorInstrumentModal,
      refactorOldInst,
      refactorNewInst,
      btnConfirmRenameInst,
      toolRenameInstrument,
      ctxRenameInstrument,

      refactorSectionModal,
      refactorOldSec,
      refactorNewSec,
      btnConfirmRenameSec,
      toolRenameSection,
      ctxRenameSection,

      refactorExtractModal,
      refactorExtractInst,
      btnConfirmExtract,
      toolExtractInstrument,
      ctxExtractInstrument,

      refactorDuplicateModal,
      refactorDupSource,
      refactorDupTarget,
      refactorDupOctave,
      refactorDupScopeGroup,
      refactorDupScopeSection,
      refactorDupScopeGlobal,
      refactorDupScopeSectionLabel,
      btnConfirmDuplicate,
      toolDuplicateTrack,
      ctxDuplicateTrack,

      refactorHarmonyModal,
      refactorHarmSource,
      refactorHarmTarget,
      refactorHarmInterval,
      refactorHarmScopeGroup,
      refactorHarmScopeSection,
      refactorHarmScopeGlobal,
      refactorHarmScopeSectionLabel,
      btnConfirmHarmony,
      toolGenerateHarmony,
      ctxGenerateHarmony,

      toolInlineOrders,
      toolsDropdown,
      closeContextMenu: () => toolsAndContextController.closeContextMenu(),
      showToast,
      onScoreUpdated: (text) => handleScoreUpdated(text),
      loadScoreIntoEditor: (score) => libraryController.loadScoreIntoEditor(score),
    },
    editor
  );

  setupInsertSectionModal(
    {
      insertSectionModal,
      insertSecName,
      insertSecInst,
      insertSecTemplate,
      insertSecMeasures,
      btnConfirmInsertSec,
      toolInsertSection,
      ctxInsertSection,
      toolsDropdown,
      closeContextMenu: () => toolsAndContextController.closeContextMenu(),
      showToast,
      onScoreUpdated: (text) => handleScoreUpdated(text),
    },
    editor
  );

  setupHumModal(
    {
      humModal,
      toolHumRecording,
      ctxHumRecording,
      humBtnRecord,
      humRecordIcon,
      humRecordText,
      humStatusIndicator,
      humBpm,
      humKey,
      humGrid,
      humSnapScale,
      humEnableMetronome,
      humEnableCountIn,
      humSectionName,
      humInstrument,
      humResultCode,
      humBtnPlayPreview,
      humBtnApply,
      getCurrentSheet: () => currentSheet,
      closeContextMenu: () => toolsAndContextController.closeContextMenu(),
      showToast,
      onScoreUpdated: (text) => handleScoreUpdated(text),
      startPlayback: (code) => playerController.startPlayback(code),
    },
    editor
  );

  aiDrawerController = new TMDAIDrawerController(
    {
      aiDrawer,
      btnToggleAi,
      btnCloseAiDrawer,
      btnOpenAiSettings,
      btnCloseAiSettings,
      btnDismissAiSettings,
      btnSaveAiSettings,
      aiPromptInput,
      btnAiGenerate,
      btnAiStop,
      btnAiRetryRepair,
      btnAiPreviewPlay,
      aiPreviewProblemsBadge,
      aiPreviewProblemsList,
      btnAiCopyCode,
      btnAiApplyReplace,
      btnAiApplyInsert,
      aiStatusText,
      aiResultContainer,
      aiResultOutput,
      aiValidationBanner,
      aiValidationMsg,
      aiSettingsModal,
      aiSettingsProvider,
      aiSettingsModelPreset,
      aiSettingsModelCustom,
      aiSettingsKey,
      aiKeyOfficialLink,
      aiKeyAskAiLink,
      aiSettingsBaseUrl,
      aiSettingsBaseUrlGroup,
      aiBtnDownload,
      aiBtnCopySkill,
      inspectorPanel,
    },
    () => editor,
    (text) => handleScoreUpdated(text),
    () => triggerSavePanelsState(),
    () => {
      btnExportSkill.click();
    },
    (code) => playerController.startPlayback(code)
  );
  aiDrawerController.init();

  setupProblemsPanelEvents(
    {
      problemsPanel,
      btnToggleProblems,
      btnFixProblemsAi,
      problemsCountBadge,
      problemsList,
    },
    editor,
    () => triggerSavePanelsState(),
    (target) => {
      aiDrawerController.launchProblemFix(target);
    }
  );

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
      handleScoreUpdated(editor.getContent());
    }
    const selectedProvider = (aiSettingsProvider?.value as AIProviderType) || "gemini";
    aiDrawerController.populateModelPresets(selectedProvider);
    updateWebMcpAskLink();
  });

  // New Song Button
  btnNewSong.addEventListener("click", () => {
    libraryController.createNewSong();
  });

  // Help Modal
  btnHelp.addEventListener("click", () => {
    helpModal.showModal();
  });

  btnCloseHelp.addEventListener("click", () => {
    helpModal.close();
  });

  btnDismissHelp.addEventListener("click", () => {
    helpModal.close();
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
      humModal?.close();
    });
  });

  // A share link pasted into an open tab changes only the hash
  window.addEventListener("hashchange", () => {
    importSharedScore()
      .then((score) => score && libraryController.loadScoreIntoEditor(score))
      .catch((err) => console.error("Failed to import shared score:", err));
  });
}

async function init() {
  const container = document.getElementById("editor-container")!;
  const defaultSample = SAMPLES[0]; // 《三天三夜》
  let initialContent = defaultSample.content;

  applyI18n(detectLanguage());

  try {
    const shared = await importSharedScore();
    if (shared) TmdStorage.setActiveScoreId(shared.id);
    const activeId = TmdStorage.getActiveScoreId();
    if (activeId) {
      const saved = shared ?? (await TmdStorage.getScore(activeId));
      if (saved) {
        initialContent = saved.content;
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
      toolsAndContextController?.handleFormatDocument();
    },
    (section, instrument) => {
      playerController?.playSectionOrTrack(section, instrument);
    }
  );

  initEvents();
  applyPanelsState({
    libraryDrawer,
    aiDrawer,
    inspectorPanel,
    problemsPanel,
    btnToggleProblems,
  });
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
        playerController?.startPlayback(editor.getContent());
      },
    });
  } catch (err) {
    console.warn("Failed to initialize Web MCP:", err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Initialization failed:", err));
});
