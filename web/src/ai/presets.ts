import { AIModelPreset, AIProviderType } from "./types.js";

export const MODEL_PRESETS: Record<AIProviderType, AIModelPreset[]> = {
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Fast, Multimodal & Free Tier)", recommended: true },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Deep Reasoning Flagship)" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite (Ultra Fast)" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o (Omni Flagship)", recommended: true },
    { id: "gpt-4o-mini", name: "GPT-4o mini (Fast & Economical)" },
    { id: "gpt-4.5-preview", name: "GPT-4.5 Preview (Large Context Knowledge)" },
    { id: "o3-mini", name: "o3-mini (STEM & High-precision Reasoning)" },
    { id: "o1", name: "o1 (Deep Thought Reasoning)" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile (Blazing Fast)", recommended: true },
    { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek-R1 Distill Llama 70B" },
    { id: "qwen-qwq-32b", name: "Qwen QwQ 32B (Reasoning)" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
  ],
  anthropic: [
    { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet (Hybrid Reasoning Flagship)", recommended: true },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Ultra Fast & Precise)" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet v2" },
  ],
  custom: [
    { id: "deepseek-chat", name: "DeepSeek-V3 (671B MoE)", recommended: true },
    { id: "deepseek-reasoner", name: "DeepSeek-R1 (Full Reasoning)" },
    { id: "qwen2.5-coder:32b", name: "Ollama (qwen2.5-coder:32b)" },
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
  openai: "gpt-4o",
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-3-7-sonnet-20250219",
  custom: "deepseek-chat",
};

