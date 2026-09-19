import { escapeHtml } from "../html.js";
import { t } from "../i18n.js";
import { TmdParser } from "../../../src/core/parser.js";
import { TMDMeasureChecker, TMDMeasureIssue } from "../../../src/core/measure_check.js";
import type { TMDWebEditor } from "../editor.js";

export interface ProblemsPanelElements {
  problemsPanel: HTMLElement;
  btnToggleProblems?: HTMLButtonElement | null;
  problemsCountBadge: HTMLElement;
  problemsList: HTMLElement;
}

export function updateProblemsPanel(
  text: string,
  elements: ProblemsPanelElements
): void {
  const { problemsPanel, problemsCountBadge, problemsList } = elements;
  if (!problemsPanel || !problemsList || !problemsCountBadge) return;

  // First check if syntax parse fails
  try {
    TmdParser.parse(text);
  } catch (err: any) {
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

export function setupProblemsPanelEvents(
  elements: ProblemsPanelElements,
  editor: TMDWebEditor,
  onStateChange: () => void
): void {
  const { problemsPanel, btnToggleProblems, problemsList } = elements;
  if (!problemsPanel) return;

  const toggleCollapsed = () => {
    problemsPanel.classList.toggle("collapsed");
    if (btnToggleProblems) {
      btnToggleProblems.textContent = problemsPanel.classList.contains("collapsed") ? "▲" : "▼";
    }
    onStateChange();
  };

  btnToggleProblems?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleCollapsed();
  });

  const problemsHeader = problemsPanel.querySelector(".problems-panel-header");
  problemsHeader?.addEventListener("click", () => {
    toggleCollapsed();
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
}
