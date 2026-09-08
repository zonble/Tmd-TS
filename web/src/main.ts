import { TmdParser } from "../../src/core/parser.js";
import { Sheet, scaleDegreeLetter, accidentalToSemitone } from "../../src/core/types.js";
import {
  TMDMIDIGenerator,
  TMDMusicXMLGenerator,
  TMDLilyPondGenerator,
  TMDABCGenerator,
} from "../../src/exporters/index.js";
import { TMDWAVRenderer } from "../../src/audio.js";
import { TmdSkill } from "../../src/skill.js";

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

let editor: TMDWebEditor;
let currentSheet: Sheet | null = null;
let isSeeking = false;

// DOM Elements
const sampleSelect = document.getElementById("sample-select") as HTMLSelectElement;
const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
const exportDropdown = document.getElementById("export-dropdown") as HTMLElement;
const btnExportMenu = document.getElementById("btn-export-menu") as HTMLButtonElement;
const btnLangToggle = document.getElementById("btn-lang-toggle") as HTMLButtonElement;
const btnDownloadSkill = document.getElementById("btn-download-skill") as HTMLButtonElement;

// Export items
const btnExportMidi = document.getElementById("export-midi") as HTMLButtonElement;
const btnExportMusicXML = document.getElementById("export-musicxml") as HTMLButtonElement;
const btnExportLilyPond = document.getElementById("export-lilypond") as HTMLButtonElement;
const btnExportABC = document.getElementById("export-abc") as HTMLButtonElement;
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

// Help Modal
const btnHelp = document.getElementById("btn-help") as HTMLButtonElement;
const helpModal = document.getElementById("help-modal") as HTMLDialogElement;
const btnCloseHelp = document.getElementById("btn-close-help") as HTMLButtonElement;
const btnDismissHelp = document.getElementById("btn-dismiss-help") as HTMLButtonElement;

// AI Modal
const aiModal = document.getElementById("ai-modal") as HTMLDialogElement;
const btnCloseAi = document.getElementById("btn-close-ai") as HTMLButtonElement;
const btnDismissAi = document.getElementById("btn-dismiss-ai") as HTMLButtonElement;
const aiBtnDownload = document.getElementById("ai-btn-download") as HTMLButtonElement;
const aiBtnCopySkill = document.getElementById("ai-btn-copy-skill") as HTMLButtonElement;
const aiBtnCopyCmd = document.getElementById("ai-btn-copy-cmd") as HTMLButtonElement;

// Player Bar (Matching zago)
const tmdPlayerBar = document.getElementById("tmd-player-bar") as HTMLElement;
const playerTitle = document.getElementById("player-title") as HTMLElement;
const playerTime = document.getElementById("player-time") as HTMLElement;
const playerProgress = document.getElementById("player-progress") as HTMLInputElement;
const synthSelect = document.getElementById("synth-select") as HTMLSelectElement;
const playerBtnPause = document.getElementById("player-btn-pause") as HTMLButtonElement;
const playerBtnStop = document.getElementById("player-btn-stop") as HTMLButtonElement;
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
        return `
          <div class="track-item">
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
}

// Playback handling
async function startPlayback() {
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

  playerBtnStop.addEventListener("click", () => {
    tmdPlayer.stop();
    tmdPlayerBar.style.display = "none";
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

  onLanguageChange(() => {
    if (editor) {
      updateInspector(editor.getContent());
    }
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
  btnExportMidi.addEventListener("click", () => {
    exportDropdown.classList.remove("open");
    const text = editor.getContent();
    const sheet = TmdParser.parse(text);
    if (!sheet) return alert(t("alertCannotExport"));
    const midi = TMDMIDIGenerator.generateMIDI(sheet);
    downloadBlob(getSafeFilename(sheet.name, "mid"), new Blob([midi as any], { type: "audio/midi" }));
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

  btnDownloadSkill.addEventListener("click", () => {
    aiModal.showModal();
  });

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

  aiBtnCopyCmd?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("npx tmd-ts --install-skills");
      const prevText = aiBtnCopyCmd.textContent;
      aiBtnCopyCmd.textContent = "✓";
      setTimeout(() => {
        aiBtnCopyCmd.textContent = prevText;
      }, 2000);
    } catch {
      alert(t("aiCmdCopied"));
    }
  });

  btnCloseAi?.addEventListener("click", () => {
    aiModal.close();
  });

  btnDismissAi?.addEventListener("click", () => {
    aiModal.close();
  });

  // Sample select
  SAMPLES.forEach((sample) => {
    const opt = document.createElement("option");
    opt.value = sample.id;
    opt.textContent = `${sample.name} [${sample.category}]`;
    sampleSelect.appendChild(opt);
  });

  sampleSelect.addEventListener("change", () => {
    const sample = SAMPLES.find((s) => s.id === sampleSelect.value);
    if (sample) {
      editor.setContent(sample.content);
      updateInspector(sample.content);
    }
  });

  // Inspector toggle
  btnToggleInspector.addEventListener("click", () => {
    inspectorPanel.classList.toggle("hidden");
  });

  btnCloseInspector.addEventListener("click", () => {
    inspectorPanel.classList.add("hidden");
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
}

function init() {
  const container = document.getElementById("editor-container")!;
  const initialSample = SAMPLES[0];
  editor = createTmdEditor(container, initialSample.content, handleEditorChange);
  sampleSelect.value = initialSample.id;

  // Initialize Language
  const initialLocale = detectLanguage();
  applyI18n(initialLocale);

  initEvents();
  updateInspector(initialSample.content);
}

window.addEventListener("DOMContentLoaded", init);
