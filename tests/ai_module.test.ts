import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, extractTmdCode } from '../web/src/ai/prompt.js';
import { MODEL_PRESETS, DEFAULT_MODELS } from '../web/src/ai/presets.js';

describe('AI Module Prompt and Parsing', () => {
  it('builds system prompt containing TMD specification', () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain('Timebase Mark Down');
    expect(sys).toContain('::SCORE::');
    expect(sys).toContain('```tmd');
  });

  it('builds specialized user prompt for arrange mode', () => {
    const prompt = buildUserPrompt({
      prompt: 'Add rock guitar and drum tracks',
      currentTmd: '::SCORE::\n** Song **\n!= 120\n?= C\n<4/4>\n\nA:Piano@|0|{ 1 2 3 4 }\n-> A ->#',
      mode: 'arrange',
    });
    expect(prompt).toContain('arrange accompaniment');
    expect(prompt).toContain('Add rock guitar and drum tracks');
    expect(prompt).toContain('A:Piano@|0|{ 1 2 3 4 }');
  });

  it('extracts TMD score code block from LLM markdown response', () => {
    const llmOutput = `Here is your composed TMD song:
\`\`\`tmd
::SCORE::
** Morning Breeze **
!= 100
?= G
<4/4>

intro:AcousticGuitar@|0|{
    <4*>
    1 3 5 3
    2 4 6 4
}
-> intro ->#
\`\`\`
Hope you like this acoustic progression!`;

    const code = extractTmdCode(llmOutput);
    expect(code).not.toBeNull();
    expect(code).toContain('::SCORE::');
    expect(code).toContain('** Morning Breeze **');
    expect(code).not.toContain('```');
    expect(code).not.toContain('Hope you like this acoustic progression!');
  });

  it('provides default models for all 5 providers including latest presets', () => {
    expect(DEFAULT_MODELS.gemini).toBe('gemini-3.8-flash');
    expect(DEFAULT_MODELS.openai).toBe('gpt-6-astra');
    expect(DEFAULT_MODELS.anthropic).toBe('claude-fable-5-1');
    expect(DEFAULT_MODELS.custom).toBe('deepseek-v4-flash');
    expect(MODEL_PRESETS.openai.some((m) => m.id === 'gpt-6-astra')).toBe(true);
    expect(MODEL_PRESETS.openai.some((m) => m.id === 'gpt-5.6-sol')).toBe(true);
    expect(MODEL_PRESETS.anthropic.some((m) => m.id === 'claude-fable-5-1')).toBe(true);
    expect(MODEL_PRESETS.gemini.some((m) => m.id === 'gemini-3.8-flash')).toBe(true);
    expect(MODEL_PRESETS.custom.some((m) => m.id === 'deepseek-v4-flash')).toBe(true);
  });

  it('detects API keys and prevents them from being used as model names', async () => {
    const { looksLikeApiKey, loadAISettings } = await import('../web/src/ai/storage.js');
    expect(looksLikeApiKey('AIzaSyAOAcOwEOm6O1wS2MUuG4KAGH5tVdXYf68')).toBe(true);
    expect(looksLikeApiKey('sk-proj-1234567890abcdef1234567890')).toBe(true);
    expect(looksLikeApiKey('gsk_1234567890abcdef1234567890')).toBe(true);
    expect(looksLikeApiKey('gemini-3.8-flash')).toBe(false);
    expect(looksLikeApiKey('gpt-6-astra')).toBe(false);
    expect(looksLikeApiKey('deepseek-v4-flash')).toBe(false);

    // Mock localStorage containing an API key mistakenly stored in model
    const mockStorage: Record<string, string> = {
      tmd_ai_settings_v1: JSON.stringify({
        activeProvider: 'gemini',
        providers: {
          gemini: { apiKey: '', model: 'AIzaSyAOAcOwEOm6O1wS2MUuG4KAGH5tVdXYf68' },
        },
      }),
    };
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
    };

    const loaded = loadAISettings();
    expect(loaded.providers.gemini.model).toBe('gemini-3.8-flash');
    expect(loaded.providers.gemini.apiKey).toBe('AIzaSyAOAcOwEOm6O1wS2MUuG4KAGH5tVdXYf68');
  });

  it('defines i18n keys for AI settings helper links and model-only applied message', async () => {
    const { zhTW } = await import('../web/src/locales/zh-TW.js');
    const { en } = await import('../web/src/locales/en.js');

    expect((zhTW as any).aiGetOfficialKey).toBeDefined();
    expect((en as any).aiGetOfficialKey).toBeDefined();
    expect((zhTW as any).aiAskAiHowToGet).toBeDefined();
    expect((en as any).aiAskAiHowToGet).toBeDefined();
    expect((zhTW as any).aiModelApplied).toContain('{model}');
    expect((en as any).aiModelApplied).toContain('{model}');
  });
});
