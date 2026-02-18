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

import * as fs from 'fs';

const log = (msg: string) => {
  try {
    fs.appendFileSync('/tmp/ai-plugin.log', `[${new Date().toISOString()}] ${msg}\n`);
    streamDeck.logger.info(msg);
  } catch (e) { }
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

interface EncoderSettings extends JsonObject {
  presetIndex?: number;
}

const PRESETS = [
  {
    key: 'fix-grammar',
    name: 'Fix Grammar',
    systemPrompt: 'You are a professional proofreader. Fix all spelling and grammar errors while preserving the original meaning and tone. Output ONLY the corrected text, nothing else.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  },
  {
    key: 'translate-en',
    name: 'Translate EN',
    systemPrompt: 'You are a professional translator. Translate the following text to English. Preserve the tone and style. Output ONLY the translated text.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  },
  {
    key: 'translate-ru',
    name: 'Translate RU',
    systemPrompt: 'You are a professional translator. Translate the following text to Russian. Preserve the tone and style. Output ONLY the translated text.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  },
  {
    key: 'summarize',
    name: 'Summarize',
    systemPrompt: 'You are an expert at summarization. Summarize the following content concisely in 3-5 bullet points. Use clear, simple language.',
    userPromptTemplate: '{{text}}',
    postAction: 'copy' as const
  },
  {
    key: 'explain-code',
    name: 'Explain Code',
    systemPrompt: 'You are a programming expert. Explain the following code in simple terms. Describe what it does, how it works, and any notable patterns or techniques used.',
    userPromptTemplate: '{{text}}',
    postAction: 'copy' as const
  },
  {
    key: 'professional',
    name: 'Professional',
    systemPrompt: 'You are a professional editor. Rewrite the following text in a more professional, polished tone while keeping the same meaning.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste' as const
  },
  {
    key: 'casual',
    name: 'Casual',
    systemPrompt: 'You are a casual, friendly editor. Rewrite the following text in a more relaxed, conversational tone while keeping the same meaning.',
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

    log(`Key pressed. Settings: ${JSON.stringify(settings)}`);

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
          (ev.action as any).setState(0).catch(() => { });
        }, 1500);
      }
      log('Action completed successfully');

    } catch (error: any) {
      log(`Error: ${error.message}`);
      if (ev.action.isKey()) {
        await ev.action.setState(3);
        setTimeout(() => {
          (ev.action as any).setState(0).catch(() => { });
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

  private getIndex(contextId: string): number {
    return this.presetIndices.get(contextId) ?? 0;
  }

  private setIndex(contextId: string, index: number): void {
    const wrapped = ((index % PRESETS.length) + PRESETS.length) % PRESETS.length;
    this.presetIndices.set(contextId, wrapped);
  }

  private async updateDisplay(ev: { action: any }, contextId: string, opts?: { value?: string; indicator?: number }): Promise<void> {
    const index = this.getIndex(contextId);
    const preset = PRESETS[index];
    try {
      await ev.action.setFeedback({
        title: preset.name,
        value: opts?.value ?? `${index + 1}/${PRESETS.length}`,
        indicator: opts?.indicator ?? Math.round(((index + 1) / PRESETS.length) * 100)
      });
    } catch (e: any) {
      log(`setFeedback error: ${e.message}`);
    }
  }

  override async onWillAppear(ev: WillAppearEvent<EncoderSettings>): Promise<void> {
    const contextId = ev.action.id;
    const saved = ev.payload.settings.presetIndex;
    if (saved !== undefined && saved >= 0 && saved < PRESETS.length) {
      this.presetIndices.set(contextId, saved);
    }
    if (ev.action.isDial()) {
      await this.updateDisplay(ev, contextId);
    }
  }

  override async onDialRotate(ev: DialRotateEvent<EncoderSettings>): Promise<void> {
    const contextId = ev.action.id;
    const current = this.getIndex(contextId);
    this.setIndex(contextId, current + ev.payload.ticks);

    const newIndex = this.getIndex(contextId);
    await ev.action.setSettings({ presetIndex: newIndex });
    await this.updateDisplay(ev, contextId);

    log(`Dial rotated: preset ${newIndex} (${PRESETS[newIndex].name})`);
  }

  override async onDialDown(ev: DialDownEvent<EncoderSettings>): Promise<void> {
    const contextId = ev.action.id;
    const index = this.getIndex(contextId);
    const preset = PRESETS[index];

    log(`Dial pressed: executing preset "${preset.name}"`);

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
      log(`Encoder action completed: ${preset.name}`);

      setTimeout(() => {
        this.updateDisplay(ev, contextId).catch(() => { });
      }, 1500);

    } catch (error: any) {
      log(`Encoder error: ${error.message}`);
      await ev.action.setFeedback({
        title: preset.name,
        value: 'Error!',
        indicator: { value: 0, enabled: false }
      });
      await ev.action.showAlert();

      setTimeout(() => {
        this.updateDisplay(ev, contextId).catch(() => { });
      }, 3000);
    }
  }

  override async onTouchTap(ev: TouchTapEvent<EncoderSettings>): Promise<void> {
    const contextId = ev.action.id;
    const index = this.getIndex(contextId);
    const preset = PRESETS[index];

    log(`Touch tap: executing preset "${preset.name}"`);

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
      log(`Touch action completed: ${preset.name}`);

      setTimeout(() => {
        this.updateDisplay(ev, contextId).catch(() => { });
      }, 1500);

    } catch (error: any) {
      log(`Touch error: ${error.message}`);
      await ev.action.setFeedback({
        title: preset.name,
        value: 'Error!',
        indicator: { value: 0, enabled: false }
      });
      await ev.action.showAlert();

      setTimeout(() => {
        this.updateDisplay(ev, contextId).catch(() => { });
      }, 3000);
    }
  }
}

export { AITextAction, PromptSelectorAction };

streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  streamDeck.logger.info(`Received global settings: ${JSON.stringify(ev.settings)}`);
});
