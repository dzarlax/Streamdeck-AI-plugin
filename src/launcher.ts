/**
 * Minimal entry point. Loads crash-handler first (only fs/path/os), then the real plugin.
 * This way we catch startup errors even when the process has limited env.
 */
import './crash-handler';
await import('./main.js');