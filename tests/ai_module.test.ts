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
    expect(DEFAULT_MODELS.gemini).toBe('gemini-2.5-flash');
    expect(DEFAULT_MODELS.anthropic).toBe('claude-3-7-sonnet-20250219');
    expect(MODEL_PRESETS.openai.some((m) => m.id === 'gpt-4.5-preview')).toBe(true);
    expect(MODEL_PRESETS.custom.some((m) => m.id === 'deepseek-chat')).toBe(true);
  });
});
