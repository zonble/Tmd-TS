import { TmdSkill } from "../../../src/skill.js";
import {
  loadAISettings,
  saveAISettings,
  looksLikeApiKey,
  callAI,
  extractTmdCode,
  buildRepairPrompt,
  validateTmdCode,
  MODEL_PRESETS,
  DEFAULT_MODELS,
  AIProviderType,
  AISettingsState,
} from "../ai/index.js";
import { getCurrentLocale, t } from "../i18n.js";
import type { TMDWebEditor } from "../editor.js";

export interface AIDrawerElements {
  aiDrawer: HTMLElement;
  btnToggleAi?: HTMLButtonElement | null;
  btnCloseAiDrawer?: HTMLButtonElement | null;
  btnOpenAiSettings: HTMLButtonElement;
  aiBtnDownload?: HTMLButtonElement | null;
  aiBtnCopySkill?: HTMLButtonElement | null;
  aiPromptInput: HTMLTextAreaElement;
  btnAiGenerate?: HTMLButtonElement | null;
  btnAiStop?: HTMLButtonElement | null;
  aiStatusText: HTMLElement;
  aiResultContainer: HTMLElement;
  aiResultOutput: HTMLElement;
  btnAiPreviewPlay?: HTMLButtonElement | null;
  btnAiCopyCode?: HTMLButtonElement | null;
  btnAiApplyReplace?: HTMLButtonElement | null;
  btnAiApplyInsert?: HTMLButtonElement | null;
  aiValidationBanner?: HTMLElement | null;
  aiValidationMsg?: HTMLElement | null;
  btnAiRetryRepair?: HTMLButtonElement | null;

  // AI Settings Modal
  aiSettingsModal: HTMLDialogElement;
  btnCloseAiSettings?: HTMLButtonElement | null;
  btnDismissAiSettings?: HTMLButtonElement | null;
  btnSaveAiSettings?: HTMLButtonElement | null;
  aiSettingsProvider: HTMLSelectElement;
  aiSettingsModelPreset: HTMLSelectElement;
  aiSettingsModelCustom: HTMLInputElement;
  aiSettingsKey: HTMLInputElement;
  aiKeyOfficialLink?: HTMLAnchorElement | null;
  aiKeyAskAiLink?: HTMLAnchorElement | null;
  aiSettingsBaseUrl: HTMLInputElement;
  aiSettingsBaseUrlGroup: HTMLElement;

  inspectorPanel: HTMLElement;
}

export class TMDAIDrawerController {
  private aiSettings: AISettingsState;
  private aiAbortController: AbortController | null = null;
  private aiCurrentGeneratedCode: string = "";
  private lastPromptForRepair: string = "";
  private lastFaultyValidation: any = null;

  constructor(
    private elements: AIDrawerElements,
    private getEditor: () => TMDWebEditor,
    private onScoreUpdated: (text: string) => void,
    private onSavePanelsState: () => void,
    private downloadSkillFile: () => void,
    private startPlayback: (text: string) => Promise<void>
  ) {
    this.aiSettings = loadAISettings();
  }

  public init(): void {
    const {
      aiDrawer,
      btnToggleAi,
      btnCloseAiDrawer,
      btnOpenAiSettings,
      btnCloseAiSettings,
      btnDismissAiSettings,
      aiSettingsModal,
      aiSettingsProvider,
      btnSaveAiSettings,
      aiPromptInput,
      btnAiGenerate,
      btnAiStop,
      btnAiRetryRepair,
      btnAiPreviewPlay,
      btnAiCopyCode,
      btnAiApplyReplace,
      btnAiApplyInsert,
      aiBtnDownload,
      aiBtnCopySkill,
      inspectorPanel,
    } = this.elements;

    this.updateAiSettingsButtonState();

    aiBtnDownload?.addEventListener("click", () => {
      this.downloadSkillFile();
    });

    aiBtnCopySkill?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(TmdSkill.skillMarkdown);
        const prevText = aiBtnCopySkill.textContent;
        aiBtnCopySkill.textContent = `✓ ${t("aiSkillCopied")}`;
        setTimeout(() => {
          aiBtnCopySkill.textContent = prevText;
        }, 2000);
      } catch {
        alert(t("aiSkillCopied"));
      }
    });

    btnToggleAi?.addEventListener("click", () => {
      aiDrawer.classList.toggle("hidden");
      if (!aiDrawer.classList.contains("hidden")) {
        if (window.innerWidth < 800) {
          inspectorPanel.classList.add("hidden");
        }
        aiPromptInput.focus();
        this.updateAiSettingsButtonState();
      }
      this.onSavePanelsState();
    });

    btnCloseAiDrawer?.addEventListener("click", () => {
      aiDrawer.classList.add("hidden");
      this.onSavePanelsState();
    });

    btnOpenAiSettings?.addEventListener("click", () => {
      this.openAiSettingsModal();
    });

    btnCloseAiSettings?.addEventListener("click", () => {
      aiSettingsModal.close();
    });

    btnDismissAiSettings?.addEventListener("click", () => {
      aiSettingsModal.close();
    });

    aiSettingsProvider.addEventListener("change", () => {
      const selected = aiSettingsProvider.value as AIProviderType;
      this.populateModelPresets(selected);
    });

    btnSaveAiSettings?.addEventListener("click", (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    document.querySelectorAll<HTMLButtonElement>(".ai-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        const prompts: Record<string, string> = {
          compose: "請以流行流行放克風格 (110 BPM, G 大調) 創作一首完整的 4 軌 TMD 歌曲（旋律、和弦、貝斯、鼓組）。",
          arrange: "請保留我現有的主旋律，為它編寫豐富的木吉他分解和弦 [CHORD]、走音貝斯 [Bass] 與動態鼓點 [Drums]。",
          extend: "請接續這段主題動機，發展出情感昂揚的 8 小節副歌，並在最後一小節給予清晰的終止式收尾。",
          reharm: "請重新為目前的旋律安排色彩更豐富的爵士/流行和弦進行（加入 maj7, m7, 7, sus4 或次屬和弦）。",
          debug: "請診斷並修正我這份樂譜的小節拍數、格式錯誤與排版，確保各軌道長度平衡且能正常解析播放。",
        };
        if (mode && prompts[mode]) {
          aiPromptInput.value = prompts[mode];
          aiPromptInput.dataset.activeMode = mode;
          aiPromptInput.focus();
        }
      });
    });

    btnAiGenerate?.addEventListener("click", () => {
      this.generateCode();
    });

    btnAiRetryRepair?.addEventListener("click", () => {
      this.retryRepair();
    });

    btnAiStop?.addEventListener("click", () => {
      if (this.aiAbortController) {
        this.aiAbortController.abort();
      }
    });

    btnAiPreviewPlay?.addEventListener("click", () => {
      const { aiResultOutput } = this.elements;
      const codeToPlay = this.aiCurrentGeneratedCode || extractTmdCode(aiResultOutput.textContent || "");
      if (!codeToPlay) {
        return alert(t("aiNoCodeFound"));
      }
      const check = validateTmdCode(codeToPlay);
      if (!check.valid) {
        return alert(t("aiInvalidTmdWarning"));
      }
      this.startPlayback(codeToPlay);
    });

    btnAiCopyCode?.addEventListener("click", async () => {
      const { aiResultOutput } = this.elements;
      const codeToCopy = this.aiCurrentGeneratedCode || extractTmdCode(aiResultOutput.textContent || "") || aiResultOutput.textContent || "";
      if (!codeToCopy) return;
      try {
        await navigator.clipboard.writeText(codeToCopy);
        const prev = btnAiCopyCode.textContent;
        btnAiCopyCode.textContent = "✓";
        setTimeout(() => {
          btnAiCopyCode.textContent = prev;
        }, 2000);
      } catch {
        alert(t("codeCopied"));
      }
    });

    btnAiApplyReplace?.addEventListener("click", () => {
      const { aiResultOutput, aiStatusText } = this.elements;
      const code = this.aiCurrentGeneratedCode || extractTmdCode(aiResultOutput.textContent || "");
      if (!code) return alert(t("aiNoCodeFound"));
      const editor = this.getEditor();
      editor.setContent(code);
      this.onScoreUpdated(code);
      aiStatusText.textContent = t("aiAppliedSuccess");
    });

    btnAiApplyInsert?.addEventListener("click", () => {
      const { aiResultOutput, aiStatusText } = this.elements;
      const code = this.aiCurrentGeneratedCode || extractTmdCode(aiResultOutput.textContent || "");
      if (!code) return alert(t("aiNoCodeFound"));
      const editor = this.getEditor();
      editor.insertAtCursor(`\n${code}\n`);
      this.onScoreUpdated(editor.getContent());
      aiStatusText.textContent = t("aiAppliedSuccess");
    });
  }

  public populateModelPresets(provider: AIProviderType): void {
    const {
      aiSettingsModelPreset,
      aiSettingsModelCustom,
      aiSettingsKey,
      aiSettingsBaseUrl,
      aiSettingsBaseUrlGroup,
      aiKeyOfficialLink,
      aiKeyAskAiLink,
    } = this.elements;

    aiSettingsModelPreset.innerHTML = "";
    const presets = MODEL_PRESETS[provider] || [];
    presets.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name}${p.recommended ? " ★" : ""}`;
      aiSettingsModelPreset.appendChild(opt);
    });

    const currentCfg = this.aiSettings.providers[provider];
    if (presets.some((p) => p.id === currentCfg.model)) {
      aiSettingsModelPreset.value = currentCfg.model;
      aiSettingsModelCustom.value = "";
    } else {
      aiSettingsModelCustom.value = currentCfg.model;
    }

    aiSettingsKey.value = currentCfg.apiKey || "";
    aiSettingsBaseUrl.value = currentCfg.baseUrl || "";
    aiSettingsBaseUrlGroup.style.display = (provider === "custom" || provider === "groq") ? "flex" : "none";

    const providerOfficialUrls: Record<AIProviderType, string> = {
      gemini: "https://aistudio.google.com/app/apikey",
      openai: "https://platform.openai.com/api-keys",
      anthropic: "https://console.anthropic.com/settings/keys",
      groq: "https://console.groq.com/keys",
      custom: "https://platform.deepseek.com/api_keys",
    };

    const providerNames: Record<AIProviderType, string> = {
      gemini: "Google Gemini",
      openai: "OpenAI",
      anthropic: "Anthropic Claude",
      groq: "Groq",
      custom: "DeepSeek / Custom",
    };

    if (aiKeyOfficialLink) {
      aiKeyOfficialLink.href = providerOfficialUrls[provider] || "https://aistudio.google.com/app/apikey";
    }

    if (aiKeyAskAiLink) {
      const isZh = getCurrentLocale() === "zh-TW";
      const q = isZh
        ? encodeURIComponent(`如何申請 ${providerNames[provider]} API key 教學步驟`)
        : encodeURIComponent(`How to get ${providerNames[provider]} API key step by step tutorial`);
      const hl = isZh ? "zh-TW" : "en";
      aiKeyAskAiLink.href = `https://www.google.com/search?q=${q}&hl=${hl}`;
    }
  }

  public openAiSettingsModal(): void {
    this.aiSettings = loadAISettings();
    this.elements.aiSettingsProvider.value = this.aiSettings.activeProvider;
    this.populateModelPresets(this.aiSettings.activeProvider);
    this.elements.aiSettingsModal.showModal();
  }

  public updateAiSettingsButtonState(): void {
    this.aiSettings = loadAISettings();
    const currentProvider = this.aiSettings.activeProvider;
    const currentConfig = this.aiSettings.providers[currentProvider];
    const hasKey = Boolean(currentConfig?.apiKey?.trim()) || currentProvider === "custom";

    if (!hasKey) {
      this.elements.btnOpenAiSettings.classList.add("needs-key");
      this.elements.btnOpenAiSettings.title = `${t("aiSettingsTitle")} (未設定 Key)`;
    } else {
      this.elements.btnOpenAiSettings.classList.remove("needs-key");
      this.elements.btnOpenAiSettings.title = `${t("aiSettingsTitle")} (${currentProvider.toUpperCase()})`;
    }
  }

  private saveSettings(): void {
    const {
      aiSettingsProvider,
      aiSettingsModelCustom,
      aiSettingsModelPreset,
      aiSettingsKey,
      aiSettingsBaseUrl,
      aiSettingsModal,
      aiStatusText,
    } = this.elements;

    const provider = aiSettingsProvider.value as AIProviderType;
    let customModel = aiSettingsModelCustom.value.trim();
    let key = aiSettingsKey.value.trim();
    const baseUrl = aiSettingsBaseUrl.value.trim();

    if (looksLikeApiKey(customModel) || (key && customModel === key)) {
      if (!key) {
        key = customModel;
        aiSettingsKey.value = key;
      }
      customModel = "";
      aiSettingsModelCustom.value = "";
    }

    let selectedModel = customModel || aiSettingsModelPreset.value || DEFAULT_MODELS[provider];
    if (looksLikeApiKey(selectedModel)) {
      selectedModel = DEFAULT_MODELS[provider];
    }

    this.aiSettings.activeProvider = provider;
    this.aiSettings.providers[provider] = {
      apiKey: key,
      model: selectedModel,
      ...(baseUrl ? { baseUrl } : {}),
    };

    saveAISettings(this.aiSettings);
    this.updateAiSettingsButtonState();
    aiSettingsModal.close();
    aiStatusText.textContent = t("aiModelApplied").replace("{model}", selectedModel);
  }

  private showValidationFailure(validation: any): void {
    const { aiValidationBanner, aiValidationMsg, btnAiPreviewPlay, aiStatusText } = this.elements;
    if (aiValidationBanner) {
      aiValidationBanner.style.display = "flex";
      if (aiValidationMsg) {
        aiValidationMsg.textContent = t("aiValidationError")
          .replace("{line}", String(validation.line))
          .replace("{error}", validation.message);
      }
    }
    if (btnAiPreviewPlay) {
      btnAiPreviewPlay.disabled = true;
      btnAiPreviewPlay.title = t("aiInvalidTmdWarning");
    }
    aiStatusText.textContent = t("aiValidationError")
      .replace("{line}", String(validation.line))
      .replace("{error}", validation.message);
  }

  private async handleValidationAndRepair(
    tmdCode: string,
    originalPrompt: string,
    provider: AIProviderType,
    config: any,
    allowAutoRepair: boolean
  ): Promise<void> {
    const { aiValidationBanner, btnAiPreviewPlay, aiStatusText, aiResultOutput } = this.elements;
    this.aiCurrentGeneratedCode = tmdCode;
    const validation = validateTmdCode(tmdCode);

    if (validation.valid) {
      if (aiValidationBanner) aiValidationBanner.style.display = "none";
      if (btnAiPreviewPlay) {
        btnAiPreviewPlay.disabled = false;
        btnAiPreviewPlay.title = t("aiBtnPlayPreview");
      }
      this.lastFaultyValidation = null;
      aiStatusText.textContent = allowAutoRepair ? t("aiStatusDone") : t("aiStatusRepaired");
      return;
    }

    this.lastFaultyValidation = validation;
    this.lastPromptForRepair = originalPrompt;

    if (allowAutoRepair) {
      aiStatusText.textContent = t("aiStatusAutoRepairing").replace("{line}", String(validation.line));
      const repairPrompt = buildRepairPrompt({
        originalPrompt,
        faultyTmd: tmdCode,
        errorMessage: validation.message,
        line: validation.line,
        column: validation.column,
        snippet: validation.snippet,
        expectedTokens: validation.expectedTokens,
      });

      let repairAccumulated = "";
      aiResultOutput.textContent = "";

      repairAccumulated = await callAI(provider, config, {
        prompt: repairPrompt,
        currentTmd: tmdCode,
        mode: "debug",
        signal: this.aiAbortController?.signal,
        onChunk: (chunk) => {
          repairAccumulated += chunk;
          aiResultOutput.textContent = repairAccumulated;
          aiResultOutput.scrollTop = aiResultOutput.scrollHeight;
        },
      });

      aiResultOutput.textContent = repairAccumulated;
      const repairedCode = extractTmdCode(repairAccumulated);
      if (repairedCode) {
        await this.handleValidationAndRepair(repairedCode, originalPrompt, provider, config, false);
      } else {
        this.showValidationFailure(validation);
        aiStatusText.textContent = t("aiNoCodeFound");
      }
    } else {
      this.showValidationFailure(validation);
    }
  }

  private async generateCode(): Promise<void> {
    const {
      aiPromptInput,
      btnAiGenerate,
      btnAiStop,
      aiStatusText,
      aiResultContainer,
      aiValidationBanner,
      btnAiPreviewPlay,
      aiResultOutput,
      aiSettingsProvider,
      aiSettingsModal,
    } = this.elements;

    const prompt = aiPromptInput.value.trim();
    if (!prompt) {
      aiPromptInput.focus();
      return;
    }

    this.aiSettings = loadAISettings();
    const provider = this.aiSettings.activeProvider;
    const config = this.aiSettings.providers[provider];

    if (!config.apiKey.trim() && provider !== "custom") {
      alert(t("aiMissingApiKey"));
      aiSettingsProvider.value = provider;
      this.populateModelPresets(provider);
      aiSettingsModal.showModal();
      return;
    }

    this.aiAbortController = new AbortController();
    if (btnAiGenerate) btnAiGenerate.style.display = "none";
    if (btnAiStop) btnAiStop.style.display = "inline-flex";
    aiStatusText.textContent = t("aiStatusGenerating");
    aiResultContainer.style.display = "block";
    if (aiValidationBanner) aiValidationBanner.style.display = "none";
    if (btnAiPreviewPlay) {
      btnAiPreviewPlay.disabled = false;
      btnAiPreviewPlay.title = t("aiBtnPlayPreview");
    }
    aiResultOutput.textContent = "";
    this.aiCurrentGeneratedCode = "";

    const mode = (aiPromptInput.dataset.activeMode as any) || "compose";
    let accumulatedText = "";

    try {
      const editor = this.getEditor();
      accumulatedText = await callAI(provider, config, {
        prompt,
        currentTmd: editor.getContent(),
        mode,
        signal: this.aiAbortController.signal,
        onChunk: (chunk) => {
          accumulatedText += chunk;
          aiResultOutput.textContent = accumulatedText;
          aiResultOutput.scrollTop = aiResultOutput.scrollHeight;
        },
      });

      aiResultOutput.textContent = accumulatedText;
      const extracted = extractTmdCode(accumulatedText);
      if (extracted) {
        await this.handleValidationAndRepair(extracted, prompt, provider, config, true);
      } else {
        aiStatusText.textContent = t("aiNoCodeFound");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        aiStatusText.textContent = "已停止生成。";
      } else {
        aiStatusText.textContent = `生成失敗: ${err.message}`;
      }
    } finally {
      if (btnAiGenerate) btnAiGenerate.style.display = "inline-flex";
      if (btnAiStop) btnAiStop.style.display = "none";
      this.aiAbortController = null;
    }
  }

  private async retryRepair(): Promise<void> {
    const { btnAiGenerate, btnAiStop, aiStatusText, aiResultOutput } = this.elements;
    if (!this.aiCurrentGeneratedCode || !this.lastFaultyValidation) return;
    const provider = this.aiSettings.activeProvider;
    const config = this.aiSettings.providers[provider];

    this.aiAbortController = new AbortController();
    if (btnAiGenerate) btnAiGenerate.style.display = "none";
    if (btnAiStop) btnAiStop.style.display = "inline-flex";
    aiStatusText.textContent = t("aiStatusAutoRepairing").replace("{line}", String(this.lastFaultyValidation.line));

    try {
      const repairPrompt = buildRepairPrompt({
        originalPrompt: this.lastPromptForRepair || "Fix TMD syntax",
        faultyTmd: this.aiCurrentGeneratedCode,
        errorMessage: this.lastFaultyValidation.message,
        line: this.lastFaultyValidation.line,
        column: this.lastFaultyValidation.column,
        snippet: this.lastFaultyValidation.snippet,
        expectedTokens: this.lastFaultyValidation.expectedTokens,
      });

      let repairAccumulated = "";
      aiResultOutput.textContent = "";

      repairAccumulated = await callAI(provider, config, {
        prompt: repairPrompt,
        currentTmd: this.aiCurrentGeneratedCode,
        mode: "debug",
        signal: this.aiAbortController.signal,
        onChunk: (chunk) => {
          repairAccumulated += chunk;
          aiResultOutput.textContent = repairAccumulated;
          aiResultOutput.scrollTop = aiResultOutput.scrollHeight;
        },
      });

      aiResultOutput.textContent = repairAccumulated;
      const repairedCode = extractTmdCode(repairAccumulated);
      if (repairedCode) {
        await this.handleValidationAndRepair(repairedCode, this.lastPromptForRepair, provider, config, false);
      } else {
        this.showValidationFailure(this.lastFaultyValidation);
        aiStatusText.textContent = t("aiNoCodeFound");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        aiStatusText.textContent = "已停止生成。";
      } else {
        aiStatusText.textContent = `生成失敗: ${err.message}`;
      }
    } finally {
      if (btnAiGenerate) btnAiGenerate.style.display = "inline-flex";
      if (btnAiStop) btnAiStop.style.display = "none";
      this.aiAbortController = null;
    }
  }
}
