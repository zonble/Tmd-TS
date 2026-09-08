import { AISettingsState, AIProviderType } from "./types.js";
import { DEFAULT_BASE_URLS, DEFAULT_MODELS } from "./presets.js";

const STORAGE_KEY = "tmd_ai_settings_v1";

export function loadAISettings(): AISettingsState {
  const defaultSettings: AISettingsState = {
    activeProvider: "gemini",
    providers: {
      gemini: { apiKey: "", model: DEFAULT_MODELS.gemini },
      openai: { apiKey: "", model: DEFAULT_MODELS.openai },
      groq: { apiKey: "", model: DEFAULT_MODELS.groq, baseUrl: DEFAULT_BASE_URLS.groq },
      anthropic: { apiKey: "", model: DEFAULT_MODELS.anthropic },
      custom: { apiKey: "", model: DEFAULT_MODELS.custom, baseUrl: DEFAULT_BASE_URLS.custom },
    },
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return {
      activeProvider: parsed.activeProvider || defaultSettings.activeProvider,
      providers: {
        gemini: { ...defaultSettings.providers.gemini, ...(parsed.providers?.gemini || {}) },
        openai: { ...defaultSettings.providers.openai, ...(parsed.providers?.openai || {}) },
        groq: { ...defaultSettings.providers.groq, ...(parsed.providers?.groq || {}) },
        anthropic: { ...defaultSettings.providers.anthropic, ...(parsed.providers?.anthropic || {}) },
        custom: { ...defaultSettings.providers.custom, ...(parsed.providers?.custom || {}) },
      },
    };
  } catch {
    return defaultSettings;
  }
}

export function saveAISettings(settings: AISettingsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save AI settings to localStorage", err);
  }
}
