import streamDeck, {
  action,
  SingletonAction,
  JsonObject,
  KeyDownEvent,
  WillAppearEvent
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

@action({ UUID: 'com.dzarlax.ai-assistant.text-action' })
class AITextAction extends SingletonAction<ActionSettings> {

  override async onKeyDown(ev: KeyDownEvent<ActionSettings>): Promise<void> {
    const { settings } = ev.payload;
    const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

    log(`Key pressed. Global Key: ${globalSettings.apiKey ? 'OK' : 'MISSING'}`);

    if (!globalSettings.apiKey) {
      log('API Key check failed');
      await ev.action.showAlert();
      return;
    }

    try {
      // 1. Capture Input
      let textToProcess = '';
      const inputMode = settings.inputMode || 'selection';
      log(`Mode: ${inputMode}`);

      if (inputMode === 'selection') {
        log('Attempting simulateCopy()');
        await simulateCopy();
        log('Attempting pasteFromClipboard()');
        textToProcess = await pasteFromClipboard();
      } else {
        log('Attempting pasteFromClipboard() only');
        textToProcess = await pasteFromClipboard();
      }

      log(`Capture complete. Text length: ${textToProcess?.length ?? 0}`);

      if (!textToProcess) {
        log('Error: No text captured from selection/clipboard');
        await ev.action.showAlert();
        return;
      }

      // 2. Prepare Prompt
      const template = settings.userPromptTemplate || '{{text}}';
      const userPrompt = template.replace('{{text}}', textToProcess);
      const systemPrompt = settings.systemPrompt || 'You are a helpful assistant.';
      log(`Calling AI with provider: ${globalSettings.provider}`);

      // 3. Show Processing State
      if (ev.action.isKey()) {
        await ev.action.setState(1);
      }

      // 4. Call AI
      const config: AIRequestConfig = {
        provider: globalSettings.provider || 'openai',
        apiKey: globalSettings.apiKey,
        model: globalSettings.model || 'gpt-4o',
        baseUrl: globalSettings.baseUrl,
        temperature: globalSettings.temperature,
        maxTokens: globalSettings.maxTokens,
        timeout: globalSettings.timeout
      };

      const result = await callAI(systemPrompt, userPrompt, config);
      log(`AI responded successfully. Result length: ${result.text.length}`);

      // 5. Handle Output
      const postAction = settings.postAction || 'paste';
      log(`Post action: ${postAction}`);

      if (postAction === 'paste') {
        await copyToClipboard(result.text);
        await new Promise(resolve => setTimeout(resolve, 100));
        await simulatePaste();
      } else {
        await copyToClipboard(result.text);
      }

      // 6. Show Success
      if (ev.action.isKey()) {
        await ev.action.setState(2);

        // Return to idle after delay
        setTimeout(() => {
          (ev.action as any).setState(0).catch(() => { });
        }, 1500);
      }
      log('Action completed successfully');

    } catch (error: any) {
      log(`Error: ${error.message}`);
      if (ev.action.isKey()) {
        await ev.action.setState(3); // Error state

        // Return to idle after delay
        setTimeout(() => {
          (ev.action as any).setState(0).catch(() => { });
        }, 3000);
      }
      await ev.action.showAlert();
    }
  }

  override async onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> {
    // Reset to idle state when action appears
    if (ev.action.isKey()) {
      await ev.action.setState(0);
    }
  }
}

export { AITextAction };

streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  streamDeck.logger.info(`Received global settings: ${JSON.stringify(ev.settings)}`);
});
