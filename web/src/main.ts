import { TmdParser } from "../../src/core/parser.js";
import { Sheet, scaleDegreeLetter, accidentalToSemitone } from "../../src/core/types.js";
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
const aiSettingsBaseUrlGroup = document.getElementById("ai-settings-baseurl-group") as HTMLElement;

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
          return `<span class="order-tag">${ord.name}</span>`;
        } else if (ord.type === "relative") {
          return `<span class="order-tag" style="color: var(--accent-purple); border-color: rgba(188, 140, 255, 0.3);">{${ord.value}}</span>`;
        } else if (ord.type === "absolute") {
          return `<span class="order-tag" style="color: var(--accent-yellow); border-color: rgba(210, 153, 34, 0.3);">{${ord.value}}</span>`;
        }
        return "";
      })
      .filter(Boolean)
      .join("");
  } else {
    inspectorOrders.innerHTML = `<span class="stat-label">${t("noOrders")}</span>`;
  }

  // Tracks
  if (currentSheet.paragraphs && currentSheet.paragraphs.length > 0) {
    inspectorTracks.innerHTML = currentSheet.paragraphs
      .map((p) => {
        const offset = p.start ? (p.start > 0 ? `+${p.start}` : `${p.start}`) : "0";
        const totalUnits = p.sections.reduce((acc, s) => acc + s.unitGroups.reduce((uAcc, g) => uAcc + g.units.length, 0), 0);
        const lineAttr = p.line ? `data-line="${p.line}"` : "";
        const titleAttr = p.line ? `title="點擊跳轉至第 ${p.line} 行"` : "";
        return `
          <div class="track-item" ${lineAttr} ${titleAttr}>
            <span class="track-name">${p.name}:${p.instrument}</span>
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
  }, 200);

  // Auto-save to IndexedDB (Debounced 500ms)
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
    }
    const selectedProvider = (aiSettingsProvider?.value as AIProviderType) || aiSettings.activeProvider;
    populateModelPresets(selectedProvider);
    updateWebMcpAskLink();
  });

  // Export dropdown menu
  btnExportMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle("open");
  });

  window.addEventListener("click", (e) => {
    if (!exportDropdown.contains(e.target as Node)) {
      exportDropdown.classList.remove("open");
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
                <div class="library-item ${isActive ? "active" : ""}" data-id="${score.id}">
                  <div class="library-item-content">
                    <div class="library-item-title">${score.title}</div>
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

  // Track item click -> Jump to editor line
  inspectorTracks?.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest(".track-item") as HTMLElement | null;
    if (target && target.dataset.line) {
      const line = parseInt(target.dataset.line, 10);
      if (!isNaN(line) && line > 0) {
        editor.scrollToLine(line);
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

  try {
    const activeId = TmdStorage.getActiveScoreId();
    if (activeId) {
      const saved = await TmdStorage.getScore(activeId);
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
    }
  );

  // Initialize Language
  const initialLocale = detectLanguage();
  applyI18n(initialLocale);

  initEvents();
  updateInspector(initialContent);

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

