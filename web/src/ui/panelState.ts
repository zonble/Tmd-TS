export interface PanelsState {
  libraryOpen: boolean;
  aiOpen: boolean;
  inspectorOpen: boolean;
  problemsCollapsed: boolean;
}

export interface PanelDOMElements {
  libraryDrawer: HTMLElement;
  aiDrawer: HTMLElement;
  inspectorPanel: HTMLElement;
  problemsPanel: HTMLElement;
  btnToggleProblems?: HTMLButtonElement | null;
}

const PANELS_STATE_KEY = "tmd-panels-state";

export function loadPanelsState(): PanelsState {
  const defaultState: PanelsState = {
    libraryOpen: false,
    aiOpen: false,
    inspectorOpen: true,
    problemsCollapsed: false,
  };
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(PANELS_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          libraryOpen: typeof parsed.libraryOpen === "boolean" ? parsed.libraryOpen : defaultState.libraryOpen,
          aiOpen: typeof parsed.aiOpen === "boolean" ? parsed.aiOpen : defaultState.aiOpen,
          inspectorOpen: typeof parsed.inspectorOpen === "boolean" ? parsed.inspectorOpen : defaultState.inspectorOpen,
          problemsCollapsed: typeof parsed.problemsCollapsed === "boolean" ? parsed.problemsCollapsed : defaultState.problemsCollapsed,
        };
      }
    }
  } catch (err) {
    console.warn("Failed to load panels state from localStorage:", err);
  }
  return defaultState;
}

export function savePanelsState(elements: PanelDOMElements): void {
  try {
    if (typeof localStorage !== "undefined") {
      const state: PanelsState = {
        libraryOpen: !elements.libraryDrawer.classList.contains("hidden"),
        aiOpen: !elements.aiDrawer.classList.contains("hidden"),
        inspectorOpen: !elements.inspectorPanel.classList.contains("hidden"),
        problemsCollapsed: elements.problemsPanel.classList.contains("collapsed"),
      };
      localStorage.setItem(PANELS_STATE_KEY, JSON.stringify(state));
    }
  } catch (err) {
    console.warn("Failed to save panels state to localStorage:", err);
  }
}

export function applyPanelsState(elements: PanelDOMElements): void {
  const state = loadPanelsState();
  if (state.libraryOpen) {
    elements.libraryDrawer.classList.remove("hidden");
  } else {
    elements.libraryDrawer.classList.add("hidden");
  }

  if (state.aiOpen) {
    elements.aiDrawer.classList.remove("hidden");
  } else {
    elements.aiDrawer.classList.add("hidden");
  }

  if (state.inspectorOpen) {
    elements.inspectorPanel.classList.remove("hidden");
  } else {
    elements.inspectorPanel.classList.add("hidden");
  }

  if (state.problemsCollapsed) {
    elements.problemsPanel.classList.add("collapsed");
    if (elements.btnToggleProblems) elements.btnToggleProblems.textContent = "▲";
  } else {
    elements.problemsPanel.classList.remove("collapsed");
    if (elements.btnToggleProblems) elements.btnToggleProblems.textContent = "▼";
  }
}
