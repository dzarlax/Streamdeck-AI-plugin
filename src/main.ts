#!/usr/bin/env node
import fs from 'fs';

// Use a fixed path for absolute reliability
const logFile = '/tmp/ai-assistant-final.log';

const debugLog = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logFile, logMessage);
  } catch (e) { }
  console.log(message);
};

debugLog('--- PLUGIN STARTUP ---');
debugLog(`CWD: ${process.cwd()}`);
debugLog(`Args: ${JSON.stringify(process.argv)}`);

// Catch-all for early errors
process.on('uncaughtException', (err: any) => {
  debugLog(`[CRITICAL] Uncaught Exception: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason: any) => {
  debugLog(`[CRITICAL] Unhandled Rejection: ${reason}`);
});

import streamDeck from '@elgato/streamdeck';
import { AITextAction, PromptSelectorAction } from './plugin';

debugLog('Registering actions...');
streamDeck.actions.registerAction(new AITextAction());
streamDeck.actions.registerAction(new PromptSelectorAction());

debugLog('Connecting...');
streamDeck.connect().then(() => {
  debugLog('Connected successfully');
}).catch((e: any) => {
  debugLog(`Connection failed: ${e.message}`);
});
