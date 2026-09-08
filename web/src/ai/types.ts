export type AIProviderType = "gemini" | "openai" | "groq" | "anthropic" | "custom";

export interface AIModelPreset {
  id: string;
  name: string;
  recommended?: boolean;
}

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AISettingsState {
  activeProvider: AIProviderType;
  providers: Record<AIProviderType, AIProviderConfig>;
}

export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  prompt: string;
  currentTmd?: string;
  mode?: "compose" | "arrange" | "extend" | "debug" | "reharm";
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
}
