import { AIModelPreset, AIProviderType } from "./types.js";

export const MODEL_PRESETS: Record<AIProviderType, AIModelPreset[]> = {
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Fast & Free Tier)", recommended: true },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Deep Reasoning)" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  ],
  openai: [
    { id: "gpt-4o-mini", name: "GPT-4o mini (Fast & Economical)", recommended: true },
    { id: "gpt-4o", name: "GPT-4o (Omni Flagship)" },
    { id: "gpt-4.5-preview", name: "GPT-4.5 Preview" },
    { id: "o3-mini", name: "o3-mini (High Accuracy Reasoning)" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile (Blazing Fast)", recommended: true },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
  ],
  anthropic: [
    { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet (Latest Flagship)", recommended: true },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Speed & Cost)" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet v2" },
  ],
  custom: [
    { id: "deepseek-chat", name: "DeepSeek-V3", recommended: true },
    { id: "deepseek-reasoner", name: "DeepSeek-R1" },
    { id: "qwen2.5-coder:7b", name: "Ollama (qwen2.5-coder:7b)" },
    { id: "llama3.3", name: "Ollama (llama3.3)" },
  ],
};

export const DEFAULT_BASE_URLS: Partial<Record<AIProviderType, string>> = {
  custom: "https://api.deepseek.com/v1",
  groq: "https://api.groq.com/openai/v1",
};

export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-3-7-sonnet-20250219",
  custom: "deepseek-chat",
};
