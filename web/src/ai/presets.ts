import { AIModelPreset, AIProviderType } from "./types.js";

export const MODEL_PRESETS: Record<AIProviderType, AIModelPreset[]> = {
  gemini: [
    { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", recommended: true },
    { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash" },
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
    { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  ],
  openai: [
    { id: "gpt-6-astra", name: "GPT-6 Astra", recommended: true },
    { id: "gpt-5.6-sol", name: "GPT-5.6 Sol" },
    { id: "gpt-5.6-terra", name: "GPT-5.6 Terra" },
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna" },
    { id: "gpt-4o", name: "GPT-4o" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", recommended: true },
    { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B" },
    { id: "qwen-qwq-32b", name: "Qwen QwQ 32B" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B" },
  ],
  anthropic: [
    { id: "claude-fable-5-1", name: "Claude Fable 5.1", recommended: true },
    { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
    { id: "claude-opus-5", name: "Claude Opus 5" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
    { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
  ],
  custom: [
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", recommended: true },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
    { id: "deepseek-chat", name: "DeepSeek V3" },
    { id: "deepseek-reasoner", name: "DeepSeek R1" },
    { id: "qwen2.5-coder:32b", name: "Ollama (qwen2.5-coder:32b)" },
    { id: "llama3.3", name: "Ollama (llama3.3)" },
  ],
};

export const DEFAULT_BASE_URLS: Partial<Record<AIProviderType, string>> = {
  custom: "https://api.deepseek.com/v1",
  groq: "https://api.groq.com/openai/v1",
};

export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  gemini: "gemini-3.8-flash",
  openai: "gpt-6-astra",
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-fable-5-1",
  custom: "deepseek-v4-flash",
};


