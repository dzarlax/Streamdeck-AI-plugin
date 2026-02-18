# AI Assistant Stream Deck Plugin

## Overview
Stream Deck plugin for AI-powered text processing. Captures selected text or clipboard, sends to AI API, and pastes the result.

**Supported Providers:** OpenAI, Anthropic, OpenRouter, Custom endpoints

---

## Architecture

```
com.dzarlax.ai-assistant.sdPlugin/
├── bin/
│   ├── plugin.js          # Bundled plugin code (ESM)
│   └── plugin.js.map      # Source map
├── imgs/                   # Plugin icons
├── ui/
│   ├── index.html          # Property Inspector
│   └── js/property-inspector.js
├── manifest.json
└── package.json            # { "type": "module" }
```

## Source Files

```
src/
├── main.ts           # Entry point - registers action, connects to Stream Deck
├── plugin.ts         # AITextAction class
├── api-client.ts     # AI API calls (OpenAI, Anthropic, OpenRouter)
└── system-utils.ts   # Clipboard & keyboard emulation

property-inspector/
├── index.html        # Settings UI
└── js/property-inspector.js
```

---

## Action: AI Text Action

**UUID:** `com.dzarlax.ai-assistant.text-action`

**States:**
- 0: Idle
- 1: Processing
- 2: Success
- 3: Error

**Workflow:**
1. Capture input (selection via Cmd+C or clipboard content)
2. Build prompt from template
3. Call AI API
4. Output result (paste or copy to clipboard)

**Timing:**
- 150ms delay after simulateCopy() for clipboard to update
- 100ms delay after copyToClipboard() before simulatePaste()

---

## Settings

### Global Settings
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| provider | string | "openai" | openai, anthropic, openrouter, custom |
| apiKey | string | - | API key |
| baseUrl | string | - | Custom endpoint (for custom provider) |
| model | string | "gpt-4o" | Model identifier |
| temperature | number | 0.7 | 0-2 |
| maxTokens | number | 4096 | Max response length |
| timeout | number | 30 | Seconds |

### Action Settings
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| actionName | string | - | Display name |
| systemPrompt | string | "You are a helpful assistant." | System prompt |
| userPromptTemplate | string | "{{text}}" | Template with {{text}} placeholder |
| inputMode | string | "selection" | selection or clipboard |
| postAction | string | "paste" | paste or copy |

---

## Built-in Presets

| Preset | Description |
|--------|-------------|
| fix-grammar | Fix spelling & grammar |
| translate-en | Translate to English |
| translate-ru | Translate to Russian |
| summarize | Summarize in bullet points |
| explain-code | Explain code |
| professional | Professional tone |
| casual | Casual tone |

---

## Supported Models

### OpenAI
o3-mini, o1, o1-mini, gpt-4o, gpt-4o-mini

### Anthropic
claude-3-7-sonnet-latest, claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, claude-3-opus-20240229

### OpenRouter
anthropic/claude-sonnet-4, openai/gpt-4o, google/gemini-pro-1.5, meta-llama/llama-3.1-70b-instruct

---

## Key Implementation Details

### System Utils (`src/system-utils.ts`)
- `copyToClipboard(text)` - spawn + pbcopy with UTF-8 encoding
- `pasteFromClipboard()` - pbpaste with 10MB maxBuffer
- `simulateCopy()` - key code 8 + Cmd (layout-independent)
- `simulatePaste()` - key code 9 + Cmd (layout-independent)

**Note:** Key codes (8=C, 9=V) work with any keyboard layout.

### API Client (`src/api-client.ts`)
- OpenAI format: `{ model, messages: [{ role, content }] }`
- Anthropic format: `{ model, system, messages }`
- Returns `{ text, usage }`

---

## Build Commands

```bash
npm run build    # Build plugin
npm run watch    # Watch mode with auto-restart
npm run link     # Link to Stream Deck
```

## Debug

```bash
# Plugin logs
cat /tmp/ai-plugin.log
cat /tmp/ai-assistant-final.log

# Stream Deck logs
cat ~/Library/Logs/ElgatoStreamDeck/StreamDeck.json | grep ai-assistant

# Restart plugin
streamdeck restart com.dzarlax.ai-assistant
```

---

## Dependencies

```json
{
  "@elgato/streamdeck": "^1.4.1",
  "axios": "^1.6.0"
}
```

---

## References

- SDK: https://docs.elgato.com/streamdeck/sdk/intro
- SDPI CSS: https://github.com/GeekyEggo/sdpi-components
