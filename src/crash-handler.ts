/**
 * Must be imported first so uncaught errors are logged before process exits.
 * Logs to a file in case console/Stream Deck logger are not available yet.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const candidates = [
  '/tmp/ai-assistant-crash.log',
  path.join(process.cwd(), 'crash.log'),
  path.join(os.homedir(), 'ai-assistant-crash.log')
];

function crashLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  for (const file of candidates) {
    try {
      fs.appendFileSync(file, line);
      break;
    } catch (_) {}
  }
  console.error(msg);
}

process.on('uncaughtException', (err: unknown) => {
  const e = err instanceof Error ? err : new Error(String(err));
  crashLog(`Uncaught: ${e.message}\n${e.stack}`);
});

process.on('unhandledRejection', (reason: unknown) => {
  crashLog(`Unhandled: ${reason}`);
});

crashLog('Crash handler loaded');
