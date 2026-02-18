import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const isMac = process.platform === 'darwin';

const UTF8_ENV = { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' };

/**
 * Copies text to the system clipboard.
 * Waits for pbcopy to finish before resolving.
 */
export async function copyToClipboard(text: string): Promise<void> {
    if (isMac) {
        return new Promise((resolve, reject) => {
            const proc = spawn('pbcopy', [], { env: UTF8_ENV });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`pbcopy exited with code ${code}`));
            });
            proc.on('error', reject);
            proc.stdin.write(text, 'utf8');
            proc.stdin.end();
        });
    } else {
        const escapedText = text.replace(/'/g, "''");
        await execAsync(`powershell -command "Set-Clipboard -Value '${escapedText}'"`, {
            encoding: 'utf8'
        });
    }
}

/**
 * Reads text from the system clipboard.
 */
export async function pasteFromClipboard(): Promise<string> {
    if (isMac) {
        const { stdout } = await execAsync('pbpaste', {
            encoding: 'utf8',
            env: UTF8_ENV,
            maxBuffer: 10 * 1024 * 1024
        });
        return stdout;
    } else {
        const { stdout } = await execAsync('powershell -command "Get-Clipboard"', {
            encoding: 'utf8'
        });
        return stdout.trim();
    }
}

/**
 * Simulates a "Copy" key press (Cmd+C or Ctrl+C).
 * Uses key code instead of keystroke for keyboard layout independence.
 */
export async function simulateCopy(): Promise<void> {
    if (isMac) {
        // key code 8 = "c" on US layout, works regardless of active input method
        await execAsync(`osascript -e 'tell application "System Events" to key code 8 using {command down}'`);
    } else {
        await execAsync(`powershell -command "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys('^c')"`);
    }
    await new Promise(resolve => setTimeout(resolve, 150));
}

/**
 * Simulates a "Paste" key press (Cmd+V or Ctrl+V).
 * Uses key code instead of keystroke for keyboard layout independence.
 */
export async function simulatePaste(): Promise<void> {
    if (isMac) {
        // key code 9 = "v" on US layout, works regardless of active input method
        await execAsync(`osascript -e 'tell application "System Events" to key code 9 using {command down}'`);
    } else {
        await execAsync(`powershell -command "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys('^v')"`);
    }
}
