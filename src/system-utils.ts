import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const isMac = process.platform === 'darwin';

// Use full paths so plugin works when Stream Deck runs with limited PATH (e.g. release mode).
const PBCOPY = '/usr/bin/pbcopy';
const PBPASTE = '/usr/bin/pbpaste';
const OSASCRIPT = '/usr/bin/osascript';
const POWERSHELL = `${process.env.SystemRoot || 'C:\\Windows'}/System32/WindowsPowerShell/v1.0/powershell.exe`;

const UTF8_ENV = { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' };

/**
 * Copies text to the system clipboard.
 * Waits for pbcopy to finish before resolving.
 */
export async function copyToClipboard(text: string): Promise<void> {
    if (isMac) {
        return new Promise((resolve, reject) => {
            const proc = spawn(PBCOPY, [], { env: UTF8_ENV });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`pbcopy exited with code ${code}`));
            });
            proc.on('error', reject);
            proc.stdin.write(text, 'utf8');
            proc.stdin.end();
        });
    } else {
        // Use stdin pipe to avoid shell escaping issues with special characters
        // (double quotes, dollar signs, backticks in AI responses break exec interpolation)
        return new Promise((resolve, reject) => {
            const proc = spawn(POWERSHELL, [
                '-NoProfile', '-NonInteractive', '-Command',
                '[Console]::InputEncoding = [Text.Encoding]::UTF8; $t = [Console]::In.ReadToEnd(); Set-Clipboard -Value $t'
            ], { env: process.env });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`powershell Set-Clipboard exited with code ${code}`));
            });
            proc.on('error', reject);
            proc.stdin.write(text, 'utf8');
            proc.stdin.end();
        });
    }
}

/**
 * Reads text from the system clipboard.
 */
export async function pasteFromClipboard(): Promise<string> {
    if (isMac) {
        const { stdout } = await execAsync(PBPASTE, {
            encoding: 'utf8',
            env: UTF8_ENV,
            maxBuffer: 10 * 1024 * 1024
        });
        return stdout;
    } else {
        const { stdout } = await execAsync(`"${POWERSHELL}" -NoProfile -NonInteractive -command "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-Clipboard"`, {
            encoding: 'utf8'
        });
        // trimEnd to remove the trailing \r\n that PowerShell adds, but preserve leading whitespace
        return stdout.trimEnd();
    }
}

/**
 * Simulates a key combo on Windows using keybd_event (no struct marshaling issues).
 * keybd_event is simpler than SendInput and doesn't toggle NumLock/CapsLock like SendKeys.
 */
function winKeyCombo(vkMod: number, vkKey: number): Promise<void> {
    const script = `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte k,byte s,uint f,UIntPtr x);' -Name U -Namespace W; [W.U]::keybd_event(${vkMod},0,0,[UIntPtr]::Zero); [W.U]::keybd_event(${vkKey},0,0,[UIntPtr]::Zero); [W.U]::keybd_event(${vkKey},0,2,[UIntPtr]::Zero); [W.U]::keybd_event(${vkMod},0,2,[UIntPtr]::Zero)`;
    return new Promise((resolve, reject) => {
        const proc = spawn(POWERSHELL, [
            '-NoProfile', '-NonInteractive', '-Command', script
        ], { env: process.env });
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`PowerShell keybd_event exited with code ${code}`));
        });
        proc.on('error', reject);
    });
}

/**
 * Simulates a "Copy" key press (Cmd+C or Ctrl+C).
 * Uses key code instead of keystroke for keyboard layout independence.
 */
export async function simulateCopy(): Promise<void> {
    if (isMac) {
        // key code 8 = "c" on US layout, works regardless of active input method
        await execAsync(`"${OSASCRIPT}" -e 'tell application "System Events" to key code 8 using {command down}'`);
    } else {
        // VK_CONTROL=0x11, VK_C=0x43
        await winKeyCombo(0x11, 0x43);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
}

/**
 * Simulates a "Paste" key press (Cmd+V or Ctrl+V).
 * Uses key code instead of keystroke for keyboard layout independence.
 */
export async function simulatePaste(): Promise<void> {
    if (isMac) {
        // key code 9 = "v" on US layout, works regardless of active input method
        await execAsync(`"${OSASCRIPT}" -e 'tell application "System Events" to key code 9 using {command down}'`);
    } else {
        // VK_CONTROL=0x11, VK_V=0x56
        await winKeyCombo(0x11, 0x56);
    }
}
