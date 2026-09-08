import { AIProviderConfig, AIProviderType, GenerateOptions } from "./types.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";

export async function callAI(
  provider: AIProviderType,
  config: AIProviderConfig,
  options: GenerateOptions
): Promise<string> {
  const apiKey = config.apiKey.trim();
  if (!apiKey && provider !== "custom") {
    throw new Error(`Please provide an API Key for ${provider} in AI Settings.`);
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(options);

  switch (provider) {
    case "gemini":
      return callGemini(apiKey, config.model, systemPrompt, userPrompt, options);
    case "anthropic":
      return callAnthropic(apiKey, config.model, systemPrompt, userPrompt, options);
    case "groq":
    case "openai":
    case "custom":
      return callOpenAICompatible(provider, config, systemPrompt, userPrompt, options);
  }
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerateOptions
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  return readSSEStream(response, options.onChunk, (json) => {
    const candidate = json.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;
    return textPart || "";
  });
}

async function callOpenAICompatible(
  provider: AIProviderType,
  config: AIProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  options: GenerateOptions
): Promise<string> {
  let endpoint = "https://api.openai.com/v1/chat/completions";
  if (provider === "groq") {
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
  } else if (provider === "custom") {
    const base = (config.baseUrl || "https://api.deepseek.com/v1").replace(/\/+$/, "");
    endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey.trim()) {
    headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
  }

  const body = {
    model: config.model,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider.toUpperCase()} API error (${response.status}): ${errorText}`);
  }

  return readSSEStream(response, options.onChunk, (json) => {
    return json.choices?.[0]?.delta?.content || "";
  });
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerateOptions
): Promise<string> {
  const endpoint = "https://api.anthropic.com/v1/messages";

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "dangerously-allow-browser": "true",
  };

  const body = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    stream: true,
    messages: [{ role: "user", content: userPrompt }],
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  return readSSEStream(response, options.onChunk, (json) => {
    if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
      return json.delta.text || "";
    }
    return "";
  });
}

async function readSSEStream(
  response: Response,
  onChunk: ((chunk: string) => void) | undefined,
  extractText: (json: any) => string
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is not readable");

  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":") || trimmed === "data: [DONE]") continue;

      if (trimmed.startsWith("data: ")) {
        const dataStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(dataStr);
          const chunk = extractText(parsed);
          if (chunk) {
            fullText += chunk;
            onChunk?.(chunk);
          }
        } catch {
          // ignore parse errors for non-JSON lines
        }
      }
    }
  }

  if (buffer.trim().startsWith("data: ")) {
    try {
      const dataStr = buffer.trim().slice(6);
      if (dataStr !== "[DONE]") {
        const parsed = JSON.parse(dataStr);
        const chunk = extractText(parsed);
        if (chunk) {
          fullText += chunk;
          onChunk?.(chunk);
        }
      }
    } catch {
      // ignore
    }
  }

  return fullText;
}
