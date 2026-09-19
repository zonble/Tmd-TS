import { Sheet, scaleDegreeLetter, accidentalToSemitone } from "../../../src/core/types.js";
import { TMDOutlineGenerator } from "../../../src/core/outline.js";
import { t } from "../i18n.js";
import { escapeHtml } from "../html.js";

export interface InspectorElements {
  inspectorStatus: HTMLElement;
  statTitle: HTMLElement;
  statTempo: HTMLElement;
  statKey: HTMLElement;
  statMeter: HTMLElement;
  inspectorOrders: HTMLElement;
  inspectorTracks: HTMLElement;
  sbStatus: HTMLElement;
  sbSummary: HTMLElement;
}

export function renderInspectorView(
  text: string,
  elements: InspectorElements,
  parseSheet: (text: string) => Sheet | null
): Sheet | null {
  const {
    inspectorStatus,
    statTitle,
    statTempo,
    statKey,
    statMeter,
    inspectorOrders,
    inspectorTracks,
    sbStatus,
    sbSummary,
  } = elements;

  let currentSheet: Sheet | null = null;
  try {
    currentSheet = parseSheet(text);
  } catch (err: any) {
    inspectorStatus.className = "status-badge error";
    inspectorStatus.textContent = `${t("statusError")}: ${err.message || ""}`;
    sbStatus.textContent = "Syntax Error";
    sbSummary.textContent = err.message || "";
    return null;
  }

  if (!currentSheet) {
    inspectorStatus.className = "status-badge error";
    inspectorStatus.textContent = t("missingScoreHeader");
    sbStatus.textContent = "Invalid TMD";
    sbSummary.textContent = "Missing ::SCORE:: root header";
    return null;
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

  // Tracks & Orders / Outline Hierarchy
  const outlineNodes = TMDOutlineGenerator.generate(text);
  const ordersNode = outlineNodes.find((n) => n.name === "Orders");

  // Orders
  if (currentSheet.orders && currentSheet.orders.length > 0) {
    inspectorOrders.innerHTML = currentSheet.orders
      .map((ord, idx) => {
        const orderLabel = ord.type === "name" ? ord.name : `{${ord.value}}`;
        const playTitle = (t("playOrderTitle") || "Play from here ({order})").replace("{order}", orderLabel);
        const playBtnHtml = `<button type="button" class="order-play-btn" data-play-order-index="${idx}" title="${escapeHtml(playTitle)}">▶</button>`;

        const childNode = ordersNode?.children?.[idx];
        const rangeAttrs = childNode
          ? `data-start-line="${childNode.range.startLine}" data-start-col="${childNode.range.startColumn}" data-end-line="${childNode.range.endLine}" data-end-col="${childNode.range.endColumn}"`
          : (ordersNode ? `data-start-line="${ordersNode.range.startLine}" data-start-col="${ordersNode.range.startColumn}" data-end-line="${ordersNode.range.endLine}" data-end-col="${ordersNode.range.endColumn}"` : "");

        const jumpTitle = t("jumpToOrdersTitle") || "Jump to editor to modify playback order";

        if (ord.type === "name") {
          return `<span class="order-tag" ${rangeAttrs}><span class="order-tag-text" title="${escapeHtml(jumpTitle)}">${escapeHtml(ord.name)}</span>${playBtnHtml}</span>`;
        } else if (ord.type === "relative") {
          return `<span class="order-tag order-tag-directive" ${rangeAttrs} style="color: var(--accent-purple); border-color: rgba(188, 140, 255, 0.3);"><span class="order-tag-text" title="${escapeHtml(jumpTitle)}">{${escapeHtml(ord.value)}}</span>${playBtnHtml}</span>`;
        } else if (ord.type === "absolute") {
          return `<span class="order-tag order-tag-directive" ${rangeAttrs} style="color: var(--accent-yellow); border-color: rgba(210, 153, 34, 0.3);"><span class="order-tag-text" title="${escapeHtml(jumpTitle)}">{${escapeHtml(ord.value)}}</span>${playBtnHtml}</span>`;
        }
        return "";
      })
      .filter(Boolean)
      .join("");
  } else {
    inspectorOrders.innerHTML = `
      <span class="stat-label">${t("noOrders")}</span>
      <button type="button" class="btn btn-sm btn-jump-orders" data-i18n-title="jumpToOrdersTitle" title="${escapeHtml(t("jumpToOrdersTitle") || "Jump to editor to modify playback order")}" style="font-size: 11px; padding: 1px 6px; margin-left: 6px;">
        <span>✏️</span> <span>${escapeHtml(t("jumpToOrders") || "Edit Order")}</span>
      </button>
    `;
  }

  // Tracks / Outline Hierarchy (Sections -> Tracks -> Measures)
  const sectionsNode = outlineNodes.find((n) => n.name === "Sections");

  if (sectionsNode && sectionsNode.children && sectionsNode.children.length > 0) {
    inspectorTracks.innerHTML = `
      <div class="outline-tree">
        ${sectionsNode.children
          .map((secNode) => {
            const secRangeAttrs = `data-start-line="${secNode.range.startLine}" data-start-col="${secNode.range.startColumn}" data-end-line="${secNode.range.endLine}" data-end-col="${secNode.range.endColumn}"`;
            const trackChildren = secNode.children || [];
            const secPlayTitle = (t("playSectionTitle") || "Play section: {section}").replace("{section}", secNode.name);

            const tracksHtml = trackChildren
              .map((trkNode) => {
                const trkRangeAttrs = `data-start-line="${trkNode.range.startLine}" data-start-col="${trkNode.range.startColumn}" data-end-line="${trkNode.range.endLine}" data-end-col="${trkNode.range.endColumn}"`;
                const trkPlayTitle = (t("playTrackTitle") || "Play track: {section} ({instrument})")
                  .replace("{section}", secNode.name)
                  .replace("{instrument}", trkNode.name);

                return `
                  <div class="track-item outline-track-item" ${trkRangeAttrs} title="L${trkNode.range.startLine}:C${trkNode.range.startColumn}">
                    <span class="track-name">${escapeHtml(trkNode.name)}</span>
                    <span class="outline-item-right">
                      ${trkNode.detail ? `<span class="track-meta">${escapeHtml(trkNode.detail)}</span>` : ""}
                      <button type="button" class="outline-play-btn" data-play-section="${escapeHtml(secNode.name)}" data-play-instrument="${escapeHtml(trkNode.name)}" title="${escapeHtml(trkPlayTitle)}">▶</button>
                    </span>
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
                  <span class="outline-summary-right">
                    <span class="outline-badge">${trackChildren.length} track${trackChildren.length === 1 ? "" : "s"}</span>
                    <button type="button" class="outline-play-btn" data-play-section="${escapeHtml(secNode.name)}" title="${escapeHtml(secPlayTitle)}">▶</button>
                  </span>
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
        const trkPlayTitle = (t("playTrackTitle") || "Play track: {section} ({instrument})")
          .replace("{section}", p.name)
          .replace("{instrument}", p.instrument);

        return `
          <div class="track-item" ${lineAttr}>
            <span class="track-name">${escapeHtml(p.name)}:${escapeHtml(p.instrument)}</span>
            <span class="outline-item-right">
              <span class="track-meta">@|${offset}| · ${totalUnits} notes</span>
              <button type="button" class="outline-play-btn" data-play-section="${escapeHtml(p.name)}" data-play-instrument="${escapeHtml(p.instrument)}" title="${escapeHtml(trkPlayTitle)}">▶</button>
            </span>
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

  return currentSheet;
}

export function setupInspectorPanelEvents(
  elements: {
    inspectorPanel: HTMLElement;
    btnToggleInspector: HTMLButtonElement;
    btnCloseInspector: HTMLButtonElement;
    inspectorTracks: HTMLElement;
    inspectorOrders: HTMLElement;
    btnJumpOrders?: HTMLButtonElement;
  },
  editor: any,
  onSavePanelsState: () => void,
  playSectionOrTrack: (section: string, instrument?: string) => void,
  playFromOrderIndex: (orderIndex: number) => void
): void {
  const {
    inspectorPanel,
    btnToggleInspector,
    btnCloseInspector,
    inspectorTracks,
    inspectorOrders,
    btnJumpOrders,
  } = elements;

  btnToggleInspector.addEventListener("click", () => {
    inspectorPanel.classList.toggle("hidden");
    onSavePanelsState();
  });

  btnCloseInspector.addEventListener("click", () => {
    inspectorPanel.classList.add("hidden");
    onSavePanelsState();
  });

  // Jump to playback order in editor
  const jumpToOrders = () => {
    // 1. First check if any order tags have startLine
    const firstTag = inspectorOrders?.querySelector("[data-start-line]") as HTMLElement | null;
    if (firstTag && firstTag.dataset.startLine) {
      const sLine = parseInt(firstTag.dataset.startLine, 10);
      const sCol = firstTag.dataset.startCol ? parseInt(firstTag.dataset.startCol, 10) : 1;
      const eLine = firstTag.dataset.endLine ? parseInt(firstTag.dataset.endLine, 10) : sLine;
      const eCol = firstTag.dataset.endCol ? parseInt(firstTag.dataset.endCol, 10) : sCol;
      if (!isNaN(sLine) && sLine > 0) {
        if (typeof editor.scrollToRange === "function") {
          editor.scrollToRange(sLine, sCol, eLine, eCol);
        } else {
          editor.scrollToLine(sLine);
        }
        return;
      }
    }

    // 2. Fallback: inspect document content or outline
    if (typeof editor.getContent === "function") {
      const content: string = editor.getContent();
      const outlineNodes = TMDOutlineGenerator.generate(content);
      const ordersNode = outlineNodes.find((n) => n.name === "Orders");
      if (ordersNode) {
        if (typeof editor.scrollToRange === "function") {
          editor.scrollToRange(
            ordersNode.range.startLine,
            ordersNode.range.startColumn,
            ordersNode.range.endLine,
            ordersNode.range.endColumn
          );
        } else {
          editor.scrollToLine(ordersNode.range.startLine);
        }
        return;
      }
      // If no orders block, scroll to the end of file so user can append
      const lines = content.split("\n").length;
      editor.scrollToLine(lines);
    }
  };

  // Fallback jump button if rendered inside inspector panel or card
  btnJumpOrders?.addEventListener("click", (e) => {
    e.preventDefault();
    jumpToOrders();
  });

  inspectorTracks?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const playBtn = target.closest(".outline-play-btn") as HTMLElement | null;
    if (playBtn) {
      e.stopPropagation();
      e.preventDefault();
      const sec = playBtn.dataset.playSection;
      const inst = playBtn.dataset.playInstrument;
      if (sec) {
        playSectionOrTrack(sec, inst);
      }
      return;
    }

    const clickable = target.closest("[data-start-line]") as HTMLElement | null;
    if (clickable && clickable.dataset.startLine) {
      const sLine = parseInt(clickable.dataset.startLine, 10);
      const sCol = clickable.dataset.startCol ? parseInt(clickable.dataset.startCol, 10) : 1;
      const eLine = clickable.dataset.endLine ? parseInt(clickable.dataset.endLine, 10) : sLine;
      const eCol = clickable.dataset.endCol ? parseInt(clickable.dataset.endCol, 10) : sCol;

      if (!isNaN(sLine) && sLine > 0) {
        if (typeof editor.scrollToRange === "function") {
          editor.scrollToRange(sLine, sCol, eLine, eCol);
        } else {
          editor.scrollToLine(sLine);
        }
      }
    }
  });

  inspectorOrders?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const jumpBtn = target.closest(".btn-jump-orders") as HTMLElement | null;
    if (jumpBtn) {
      e.stopPropagation();
      e.preventDefault();
      jumpToOrders();
      return;
    }

    const playBtn = target.closest(".order-play-btn") as HTMLElement | null;
    if (playBtn && playBtn.dataset.playOrderIndex !== undefined) {
      e.stopPropagation();
      e.preventDefault();
      const idx = parseInt(playBtn.dataset.playOrderIndex, 10);
      if (!isNaN(idx) && idx >= 0) {
        playFromOrderIndex(idx);
      }
      return;
    }

    // Clicking order tag or tag text scrolls to the order range in editor
    const clickable = target.closest("[data-start-line]") as HTMLElement | null;
    if (clickable && clickable.dataset.startLine) {
      const sLine = parseInt(clickable.dataset.startLine, 10);
      const sCol = clickable.dataset.startCol ? parseInt(clickable.dataset.startCol, 10) : 1;
      const eLine = clickable.dataset.endLine ? parseInt(clickable.dataset.endLine, 10) : sLine;
      const eCol = clickable.dataset.endCol ? parseInt(clickable.dataset.endCol, 10) : sCol;

      if (!isNaN(sLine) && sLine > 0) {
        if (typeof editor.scrollToRange === "function") {
          editor.scrollToRange(sLine, sCol, eLine, eCol);
        } else {
          editor.scrollToLine(sLine);
        }
      }
    }
  });
}
