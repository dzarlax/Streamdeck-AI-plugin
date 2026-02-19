import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Must be imported first so uncaught errors are logged before process exits.
 * Logs to a file in case console/Stream Deck logger are not available yet.
 */
const candidates = [
    '/tmp/ai-assistant-crash.log',
    path.join(process.cwd(), 'crash.log'),
    path.join(os.homedir(), 'ai-assistant-crash.log')
];
function crashLog(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    for (const file of candidates) {
        try {
            fs.appendFileSync(file, line);
            break;
        }
        catch (_) { }
    }
    console.error(msg);
}
process.on('uncaughtException', (err) => {
    const e = err instanceof Error ? err : new Error(String(err));
    crashLog(`Uncaught: ${e.message}\n${e.stack}`);
});
process.on('unhandledRejection', (reason) => {
    crashLog(`Unhandled: ${reason}`);
});
crashLog('Crash handler loaded');

/**
 * Minimal entry point. Loads crash-handler first (only fs/path/os), then the real plugin.
 * This way we catch startup errors even when the process has limited env.
 */
await import('./main.js');
//# sourceMappingURL=launcher.js.map
