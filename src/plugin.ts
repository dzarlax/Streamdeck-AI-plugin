import streamDeck, {
  action,
  SingletonAction,
  JsonObject,
  KeyDownEvent,
  WillAppearEvent,
  DialRotateEvent,
  DialDownEvent,
  TouchTapEvent
} from '@elgato/streamdeck';

import { callAI, AIRequestConfig } from './api-client.js';
import {
  copyToClipboard,
  pasteFromClipboard,
  simulateCopy,
  simulatePaste
} from './system-utils.js';

const log = (msg: string) => {
  streamDeck.logger.info(msg);
};

interface GlobalSettings extends JsonObject {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

interface ActionSettings extends JsonObject {
  actionName?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  inputMode?: 'selection' | 'clipboard';
  postAction?: 'paste' | 'copy';
}

interface EncoderPresetConfig extends JsonObject {
  key?: string;
  enabled?: boolean;
  order?: number;
}

interface EncoderSettings extends JsonObject {
  presetIndex?: number;
  encoderPresets?: EncoderPresetConfig[];
}

const PRESETS = [
  {
    key: 'fix-grammar',
    name: 'Fix Grammar',
    systemPrompt: 'You are a professional proofreader. Fix ONLY spelling and grammar errors in the text. Do NOT rephrase, restructure, or change the style. Keep the original language. Output ONLY the corrected text, no explanations.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  },
  {
    key: 'translate-en',
    name: 'Translate EN',
    systemPrompt: 'You are a professional translator. Translate the text into English. If it is already in English, return it unchanged. Preserve formatting, tone, and style. Output ONLY the translation, no explanations.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  },
  {
    key: 'translate-ru',
    name: 'Translate RU',
    systemPrompt: 'You are a professional translator. Translate the text into Russian. If it is already in Russian, return it unchanged. Preserve formatting, tone, and style. Output ONLY the translation, no explanations.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  },
  {
    key: 'translate-sr',
    name: 'Translate SR',
    systemPrompt: 'You are a professional translator. Translate the text into Serbian (Latin script). If it is already in Serbian Latin, return it unchanged. Preserve formatting, tone, and style. Output ONLY the translation, no explanations.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  },
  {
    key: 'translate-de',
    name: 'Translate DE',
    systemPrompt: 'You are a professional translator. Translate the text into German. If it is already in German, return it unchanged. Preserve formatting, tone, and style. Output ONLY the translation, no explanations.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  },
  {
    key: 'summarize',
    name: 'Summarize',
    systemPrompt: 'You are an expert at summarization. Summarize the following content. For short texts (under 100 words), write 1-2 sentences. For longer content, use 3-5 bullet points. Be concise and clear. Output ONLY the summary, no introductions or explanations.',
    userPromptTemplate: '{{text}}',
    postAction: 'copy' as const
  },
  {
    key: 'explain-code',
    name: 'Explain Code',
    systemPrompt: 'You are a programming expert. Explain what the following code does in plain language. Cover: purpose, logic, and any notable patterns. Write clearly for a developer who did not write this code. Do not repeat the code in your response.',
    userPromptTemplate: '{{text}}',
    postAction: 'copy' as const
  },
  {
    key: 'professional',
    name: 'Professional',
    systemPrompt: 'You are a professional editor. Rewrite the following text in a more professional, polished tone. Keep the same language, meaning, and key points. Do NOT translate. Output ONLY the rewritten text, no explanations.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  },
  {
    key: 'casual',
    name: 'Casual',
    systemPrompt: 'You are a friendly editor. Rewrite the following text in a more relaxed, conversational tone. Keep the same language, meaning, and key points. Do NOT translate. Output ONLY the rewritten text, no explanations.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  }
];

async function processWithAI(opts: {
  systemPrompt: string;
  userPromptTemplate: string;
  inputMode: 'selection' | 'clipboard';
  postAction: 'paste' | 'copy';
}): Promise<void> {
  const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

  if (!globalSettings.apiKey) {
    throw new Error('API key not configured');
  }

  let textToProcess = '';

  if (opts.inputMode === 'selection') {
    log('Attempting simulateCopy()');
    await simulateCopy();
    textToProcess = await pasteFromClipboard();
  } else {
    textToProcess = await pasteFromClipboard();
  }

  log(`Capture complete. Text length: ${textToProcess?.length ?? 0}`);

  if (!textToProcess) {
    throw new Error('No text captured from selection/clipboard');
  }

  const userPrompt = opts.userPromptTemplate.replace('{{text}}', textToProcess);
  log(`Calling AI with provider: ${globalSettings.provider}`);

  const config: AIRequestConfig = {
    provider: globalSettings.provider || 'openai',
    apiKey: globalSettings.apiKey,
    model: globalSettings.model || 'gpt-4o',
    baseUrl: globalSettings.baseUrl,
    temperature: globalSettings.temperature,
    maxTokens: globalSettings.maxTokens,
    timeout: globalSettings.timeout
  };

  const result = await callAI(opts.systemPrompt, userPrompt, config);
  log(`AI responded successfully. Result length: ${result.text.length}`);

  if (opts.postAction === 'paste') {
    await copyToClipboard(result.text);
    await new Promise(resolve => setTimeout(resolve, 100));
    await simulatePaste();
  } else {
    await copyToClipboard(result.text);
  }
}

@action({ UUID: 'com.dzarlax.ai-assistant.text-action' })
class AITextAction extends SingletonAction<ActionSettings> {

  override async onKeyDown(ev: KeyDownEvent<ActionSettings>): Promise<void> {
    const { settings } = ev.payload;

    log(`Key pressed. Action: ${settings.actionName || 'unnamed'}, input: ${settings.inputMode || 'selection'}`);

    try {
      if (ev.action.isKey()) {
        await ev.action.setState(1);
      }

      await processWithAI({
        systemPrompt: settings.systemPrompt || 'You are a helpful assistant.',
        userPromptTemplate: settings.userPromptTemplate || '{{text}}',
        inputMode: settings.inputMode || 'selection',
        postAction: settings.postAction || 'paste'
      });

      if (ev.action.isKey()) {
        await ev.action.setState(2);
        setTimeout(() => {
          ev.action.setState(0).catch(() => { });
        }, 1500);
      }
      log('Action completed successfully');

    } catch (error: any) {
      log(`Error: ${error.message}`);
      if (ev.action.isKey()) {
        await ev.action.setState(3);
        setTimeout(() => {
          ev.action.setState(0).catch(() => { });
        }, 3000);
      }
      await ev.action.showAlert();
    }
  }

  override async onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> {
    if (ev.action.isKey()) {
      await ev.action.setState(0);
    }
  }
}

@action({ UUID: 'com.dzarlax.ai-assistant.prompt-selector' })
class PromptSelectorAction extends SingletonAction<EncoderSettings> {

  private presetIndices = new Map<string, number>();
  private encoderSettings = new Map<string, EncoderSettings>();

  private getActivePresets(settings: EncoderSettings): typeof PRESETS {
    if (!settings.encoderPresets || settings.encoderPresets.length === 0) {
      return PRESETS;
    }

    return settings.encoderPresets
      .filter(p => p.enabled)
      .map(p => PRESETS.find(preset => preset.key === p.key))
      .filter((p): p is typeof PRESETS[0] => p !== undefined);
  }

  private getIndex(contextId: string, presetsLength: number): number {
    const idx = this.presetIndices.get(contextId) ?? 0;
    if (presetsLength === 0) return 0;
    return ((idx % presetsLength) + presetsLength) % presetsLength;
  }

  private setIndex(contextId: string, index: number, presetsLength: number): void {
    if (presetsLength === 0) {
      this.presetIndices.set(contextId, 0);
    } else {
      const wrapped = ((index % presetsLength) + presetsLength) % presetsLength;
      this.presetIndices.set(contextId, wrapped);
    }
  }

  private async updateDisplay(ev: { action: any }, contextId: string, settings: EncoderSettings, opts?: { value?: string; indicator?: number }): Promise<void> {
    const activePresets = this.getActivePresets(settings);
    const index = this.getIndex(contextId, activePresets.length);
    const preset = activePresets[index];

    if (!preset) {
      try {
        await ev.action.setFeedback({
          title: 'No Presets',
          value: 'Configure in settings',
          indicator: 0
        });
      } catch (e: any) {
        log(`setFeedback error: ${e.message}`);
      }
      return;
    }

    try {
      await ev.action.setFeedback({
        title: preset.name,
        value: opts?.value ?? `${index + 1}/${activePresets.length}`,
        indicator: opts?.indicator ?? Math.round(((index + 1) / activePresets.length) * 100)
      });
    } catch (e: any) {
      log(`setFeedback error: ${e.message}`);
    }
  }

  override async onWillAppear(ev: WillAppearEvent<EncoderSettings>): Promise<void> {
    const contextId = ev.action.id;
    const settings = ev.payload.settings;

    this.encoderSettings.set(contextId, settings);

    const saved = settings.presetIndex;
    const activePresets = this.getActivePresets(settings);

    if (saved !== undefined && saved >= 0 && saved < activePresets.length) {
      this.presetIndices.set(contextId, saved);
    }

    if (ev.action.isDial()) {
      // Set layout explicitly so feedback (title/value/indicator) is shown when debug is off.
      try {
        await ev.action.setFeedbackLayout('$B1');
      } catch (e: any) {
        log(`setFeedbackLayout error: ${e.message}`);
      }
      await this.updateDisplay(ev, contextId, settings);
    }
  }

  override async onDialRotate(ev: DialRotateEvent<EncoderSettings>): Promise<void> {
    const contextId = ev.action.id;
    const settings = ev.payload.settings;
    this.encoderSettings.set(contextId, settings);

    const activePresets = this.getActivePresets(settings);
    const current = this.getIndex(contextId, activePresets.length);
    this.setIndex(contextId, current + ev.payload.ticks, activePresets.length);

    const newIndex = this.getIndex(contextId, activePresets.length);
    await ev.action.setSettings({ ...settings, presetIndex: newIndex });
    await this.updateDisplay(ev, contextId, settings);

    const preset = activePresets[newIndex];
    log(`Dial rotated: preset ${newIndex} (${preset?.name ?? 'none'})`);
  }

  private async executePreset(ev: { action: any }, contextId: string, settings: EncoderSettings, source: string): Promise<void> {
    this.encoderSettings.set(contextId, settings);

    const activePresets = this.getActivePresets(settings);
    const index = this.getIndex(contextId, activePresets.length);
    const preset = activePresets[index];

    if (!preset) {
      log(`${source}: no active presets`);
      await ev.action.showAlert();
      return;
    }

    log(`${source}: executing preset "${preset.name}"`);

    try {
      await ev.action.setFeedback({
        title: preset.name,
        value: 'Processing...',
        indicator: { value: 0, enabled: false }
      });

      await processWithAI({
        systemPrompt: preset.systemPrompt,
        userPromptTemplate: preset.userPromptTemplate,
        inputMode: 'selection',
        postAction: preset.postAction
      });

      await ev.action.setFeedback({
        title: preset.name,
        value: 'Done!',
        indicator: 100
      });
      log(`${source} completed: ${preset.name}`);

      setTimeout(() => {
        this.updateDisplay(ev, contextId, settings).catch(() => { });
      }, 1500);

    } catch (error: any) {
      log(`${source} error: ${error.message}`);
      await ev.action.setFeedback({
        title: 'Error',
        value: error.message?.slice(0, 30) || 'Unknown error',
        indicator: { value: 0, enabled: false }
      });
      await ev.action.showAlert();

      setTimeout(() => {
        this.updateDisplay(ev, contextId, settings).catch(() => { });
      }, 3000);
    }
  }

  override async onDialDown(ev: DialDownEvent<EncoderSettings>): Promise<void> {
    await this.executePreset(ev, ev.action.id, ev.payload.settings, 'Dial pressed');
  }

  override async onTouchTap(ev: TouchTapEvent<EncoderSettings>): Promise<void> {
    await this.executePreset(ev, ev.action.id, ev.payload.settings, 'Touch tap');
  }
}

export { AITextAction, PromptSelectorAction };

streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  const safe = { ...ev.settings, apiKey: ev.settings.apiKey ? '***' : undefined };
  streamDeck.logger.info(`Received global settings: ${JSON.stringify(safe)}`);
});
