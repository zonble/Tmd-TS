// web/src/ui/theme.ts
// Theme controller supporting dark (default) and light modes

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "tmd-theme";

export function getTheme(): Theme {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        return saved;
      }
    }
  } catch (_) {}
  return "dark";
}

export function setTheme(theme: Theme): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch (_) {}

  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function toggleTheme(): Theme {
  const current = getTheme();
  const next: Theme = current === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}

export function initTheme(): Theme {
  const theme = getTheme();
  setTheme(theme);
  return theme;
}
