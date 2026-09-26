import { TMDLocale, TMDSectionTimingProfile, TMDTonalityProfile } from "../../../src/core/inspector.js";
import { escapeHtml } from "../html.js";

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const KEY_OFFSETS: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};
const SOLFEGE: Record<number, string> = { 0: "Do", 2: "Re", 4: "Mi", 5: "Fa", 7: "Sol", 9: "La", 11: "Ti" };

function text(locale: TMDLocale, english: string, chinese: string): string {
  return locale === "zh-Hant" || locale === "zh-TW" ? chinese : english;
}

function stabilityLabel(stability: string, locale: TMDLocale): string {
  if (locale === "zh-Hant" || locale === "zh-TW") {
    return stability === "high" ? "穩定" : stability === "moderate" ? "中度穩定" : "調性模糊";
  }
  return stability.charAt(0).toUpperCase() + stability.slice(1);
}

/**
 * Renders the inspector-level tonality panel shared conceptually with the VSCode webview.
 * The output intentionally keeps the same information hierarchy: diagnosis, histogram,
 * and expandable theoretical details.
 */
export function renderTonalityProfileHtml(
  tonality: TMDTonalityProfile,
  locale: TMDLocale = "en",
  timingSections: TMDSectionTimingProfile[] = []
): string {
  const stability = tonality.globalCorrelation.stability || "high";
  const stabilityClass = stability === "high" ? "valid" : stability === "moderate" ? "warn" : "error";
  const diatonicPct = (tonality.globalPitchClasses.diatonicRatio * 100).toFixed(1);
  const correlation = tonality.globalCorrelation.declaredKeyCorrelation.toFixed(2);
  const candidates = (tonality.globalCorrelation.topCandidateKeys || [])
    .slice(0, 3)
    .map((candidate) => `${escapeHtml(candidate.keyName)} (${candidate.correlation.toFixed(2)})`)
    .join(", ");
  const fifthsPath = (tonality.circleOfFifthsPath || [])
    .map((position) => (position >= 0 ? `+${position}` : `${position}`))
    .join(" → ");

  const rootName = (tonality.globalCorrelation.declaredKey || "C").split(" ")[0];
  const rootOffset = KEY_OFFSETS[rootName] ?? 0;
  const weights = tonality.globalPitchClasses.weights || [];
  const maxWeight = Math.max(0.001, ...weights);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  const bars = PITCH_NAMES.map((pitchName, index) => {
    const weight = weights[index] || 0;
    const barPercent = ((weight / maxWeight) * 100).toFixed(1);
    const weightPercent = ((weight / totalWeight) * 100).toFixed(0);
    const degreeOffset = (index - rootOffset + 12) % 12;
    const solfege = SOLFEGE[degreeOffset] || "•";
    const diatonic = SOLFEGE[degreeOffset] !== undefined;
    return `<div class="pitch-bar-col" title="${escapeHtml(`${pitchName} (${solfege}): ${weightPercent}% (${weight.toFixed(1)} beats)`)}">
      <div class="pitch-bar-fill-wrap"><div class="pitch-bar-fill${diatonic ? "" : " fill-chromatic"}" style="height: ${barPercent}%;"></div></div>
      <div class="pitch-bar-label">${pitchName}</div>
      <div class="pitch-degree-label ${diatonic ? "degree-diatonic" : "degree-chromatic"}">${solfege}</div>
    </div>`;
  }).join("");

  const summary = tonality.summaryText || `${tonality.globalCorrelation.declaredKey} ${text(locale, "Major", "大調")}`;
  const mood = tonality.moodDescription || (tonality.globalPitchClasses.diatonicRatio >= 0.95
    ? text(locale, "Clean major tonality", "純淨自然大調")
    : text(locale, "Contemporary major color", "流行色彩大調"));
  const journey = tonality.modulationStory || text(locale, "No modulation", "未轉調");
  const timeline = timingSections.length > 0
    ? `<div class="tonality-timeline">
        <div class="stat-label">${escapeHtml(text(locale, "Structure & Conductor Timeline", "結構與指揮時間線"))}</div>
        <div class="timeline-bar-wrapper tonality-timeline-bar">${timingSections.map((section, index) => {
          const width = timingSections.reduce((sum, item) => sum + item.durationSeconds, 0) > 0
            ? Math.max(4, section.durationSeconds / timingSections.reduce((sum, item) => sum + item.durationSeconds, 0) * 100)
            : 100 / timingSections.length;
          return `<button type="button" class="timeline-segment" data-tonality-section="${escapeHtml(section.name)}" style="width: ${width.toFixed(2)}%;" title="${escapeHtml(`${section.name} · ${section.durationSeconds.toFixed(1)}s · ${section.measures}m`)}"><span>${index + 1}</span></button>`;
        }).join("")}</div>
        <div class="tonality-timeline-list">${timingSections.map((section, index) => {
          const tonalSection = tonality.sections[index];
          return `<button type="button" class="timeline-item tonality-timeline-item" data-tonality-section="${escapeHtml(section.name)}">
            <span class="timeline-item-index">#${index + 1}</span>
            <span class="timeline-item-name">${escapeHtml(section.name)}${tonalSection ? ` · ${escapeHtml(tonalSection.declaredKey)}` : ""}</span>
            <span class="timeline-item-time">${section.durationSeconds.toFixed(1)}s (${section.measures}m)</span>
          </button>`;
        }).join("")}</div>
      </div>`
    : "";

  return `<div class="tonality-profile" data-tonality-profile>
    <div class="tonality-profile-header">
      <div class="producer-headline"><span class="producer-icon">🎵</span><span class="producer-title">${escapeHtml(summary)}</span></div>
      <span id="tonality-stability-badge" class="tonality-stability-badge ${stabilityClass}">${escapeHtml(stabilityLabel(stability, locale))}</span>
    </div>
    <div class="producer-detail-item"><span class="producer-label">${escapeHtml(text(locale, "Musical Character & Mood", "音樂性格與氣質"))}:</span> <span class="producer-value">${escapeHtml(mood)}</span></div>
    <div class="producer-detail-item"><span class="producer-label">${escapeHtml(text(locale, "Modulation Journey", "轉調歷程"))}:</span> <span class="producer-value">${escapeHtml(journey)}</span></div>

    ${timeline}

    <div class="tonality-histogram-wrap">
      <div class="stat-label">${escapeHtml(text(locale, "12-Tone Pitch Class Weight Distribution", "十二半音音級權重分佈"))}</div>
      <div class="pitch-bar-chart">${bars}</div>
    </div>

    <details class="tonality-advanced-details">
      <summary class="tonality-advanced-summary">${escapeHtml(text(locale, "Detailed Theoretical Analysis", "詳細樂理分析"))}</summary>
      <div class="tonality-details-content">
        <div class="tonality-summary-row">
          <div class="tonality-stat-box"><span class="stat-label">${escapeHtml(text(locale, "Declared Key", "宣告調性"))}</span><span class="stat-value">${escapeHtml(tonality.globalCorrelation.declaredKey)}</span><span class="stat-sub">${escapeHtml(text(locale, "Correlation", "相關度"))}: ${correlation}</span></div>
          <div class="tonality-stat-box"><span class="stat-label">${escapeHtml(text(locale, "Diatonic Purity", "自然音純度"))}</span><span class="stat-value">${diatonicPct}%</span><span class="stat-sub">${escapeHtml(text(locale, "Diatonic / Chromatic", "自然音／調外音"))}</span></div>
        </div>
        ${candidates ? `<div class="pitch-metric-row"><span class="stat-label">${escapeHtml(text(locale, "Best Fit Keys (K-S)", "最佳符合調性 (K-S)"))}</span><span class="pitch-metric-value">${candidates}</span></div>` : ""}
        ${fifthsPath ? `<div class="pitch-metric-row"><span class="stat-label">${escapeHtml(text(locale, "Circle of Fifths Trajectory", "五度圈游移軌跡"))}</span><span class="pitch-metric-value mono">${escapeHtml(fifthsPath)}</span></div>` : ""}
      </div>
    </details>
  </div>`;
}
