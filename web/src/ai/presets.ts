import { AIModelPreset, AIProviderType } from "./types.js";

export const MODEL_PRESETS: Record<AIProviderType, AIModelPreset[]> = {
  gemini: [
    { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash (Latest Autonomous Agent Flagship)", recommended: true },
    { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash (High-performance Reasoning)" },
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash (Efficient Workhorse)" },
    { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite (High Volume / Free Tier)" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Stable Legacy)" },
  ],
  openai: [
    { id: "gpt-6-astra", name: "GPT-6 Astra (Latest Flagship Frontier Reasoning)", recommended: true },
    { id: "gpt-5.6-sol", name: "GPT-5.6 Sol (Complex Professional Tasks)" },
    { id: "gpt-5.6-terra", name: "GPT-5.6 Terra (Balanced Speed & Cost)" },
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna (Fast & Cost-sensitive)" },
    { id: "gpt-4o", name: "GPT-4o (Stable Legacy)" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile (Blazing Fast)", recommended: true },
    { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek-R1 Distill Llama 70B" },
    { id: "qwen-qwq-32b", name: "Qwen QwQ 32B (Reasoning)" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
  ],
  anthropic: [
    { id: "claude-fable-5-1", name: "Claude Fable 5.1 (Top Reasoning & Agentic Flagship)", recommended: true },
    { id: "claude-sonnet-5", name: "Claude Sonnet 5 (Optimal Speed & Coding)" },
    { id: "claude-opus-5", name: "Claude Opus 5 (Deep Architecture & Enterprise)" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5 (High Speed)" },
    { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet (Stable Legacy)" },
  ],
  custom: [
    { id: "deepseek-v4-flash", name: "DeepSeek-V4 Flash (Native 1M Context)", recommended: true },
    { id: "deepseek-v4-pro", name: "DeepSeek-V4 Pro (Flagship Agentic)" },
    { id: "deepseek-chat", name: "DeepSeek-V3 (Stable Legacy)" },
    { id: "deepseek-reasoner", name: "DeepSeek-R1 (Full Reasoning Legacy)" },
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


