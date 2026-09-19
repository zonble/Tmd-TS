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

  // Orders
  if (currentSheet.orders && currentSheet.orders.length > 0) {
    inspectorOrders.innerHTML = currentSheet.orders
      .map((ord, idx) => {
        const orderLabel = ord.type === "name" ? ord.name : `{${ord.value}}`;
        const playTitle = (t("playOrderTitle") || "Play from here ({order})").replace("{order}", orderLabel);
        const playBtnHtml = `<button type="button" class="order-play-btn" data-play-order-index="${idx}" title="${escapeHtml(playTitle)}">▶</button>`;

        if (ord.type === "name") {
          return `<span class="order-tag"><span class="order-tag-text">${escapeHtml(ord.name)}</span>${playBtnHtml}</span>`;
        } else if (ord.type === "relative") {
          return `<span class="order-tag order-tag-directive" style="color: var(--accent-purple); border-color: rgba(188, 140, 255, 0.3);"><span class="order-tag-text">{${escapeHtml(ord.value)}}</span>${playBtnHtml}</span>`;
        } else if (ord.type === "absolute") {
          return `<span class="order-tag order-tag-directive" style="color: var(--accent-yellow); border-color: rgba(210, 153, 34, 0.3);"><span class="order-tag-text">{${escapeHtml(ord.value)}}</span>${playBtnHtml}</span>`;
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
