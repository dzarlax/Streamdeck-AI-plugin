# AI Assistant Stream Deck Plugin

## Overview
Stream Deck plugin for AI-powered text processing. Captures selected text or clipboard, sends to AI API, and pastes the result.

**Supported Providers:** OpenAI, Anthropic, Google Gemini, OpenRouter, Custom endpoints

**Actions:**
- **AI Text Action** - Regular key with customizable prompts
- **AI Prompt Selector** - Stream Deck+ encoder with preset switching

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
├── main.ts           # Entry point - registers actions, connects
├── plugin.ts         # AITextAction, PromptSelectorAction classes
├── api-client.ts     # AI API calls (OpenAI, Anthropic, OpenRouter)
└── system-utils.ts   # Clipboard & keyboard emulation

property-inspector/
├── index.html        # Settings UI
└── js/property-inspector.js
```

---

## Actions

### 1. AI Text Action
**UUID:** `com.dzarlax.ai-assistant.text-action`

Regular key action with customizable prompts.

**States:**
- 0: Idle
- 1: Processing
- 2: Success
- 3: Error

### 2. AI Prompt Selector (Stream Deck+)
**UUID:** `com.dzarlax.ai-assistant.prompt-selector`

Encoder/dial action for quick preset switching.

**Controls:**
- **Rotate** - Switch between presets
- **Press (Dial)** - Execute selected preset
- **Tap (Touch)** - Execute selected preset

**LCD Display:**
- `title` - Preset name
- `value` - Position (e.g., "3/9") or status
- `indicator` - Visual progress bar

---

## Built-in Presets (9 total)

| # | Key | Name | Post Action |
|---|-----|------|-------------|
| 1 | fix-grammar | Fix Grammar | paste |
| 2 | translate-en | Translate EN | paste |
| 3 | translate-ru | Translate RU | paste |
| 4 | translate-sr | Translate SR | paste |
| 5 | translate-de | Translate DE | paste |
| 6 | summarize | Summarize | copy |
| 7 | explain-code | Explain Code | copy |
| 8 | professional | Professional | paste |
| 9 | casual | Casual | paste |

Presets are defined in `src/plugin.ts` as `PRESETS` array.

---

## Adding New Presets

### Step 1: Add to `src/plugin.ts`

Add a new object to the `PRESETS` array:

```typescript
const PRESETS = [
  // ... existing presets ...
  {
    key: 'my-new-preset',           // Unique identifier (kebab-case)
    name: 'My New Preset',          // Display name (shown on encoder LCD)
    systemPrompt: 'You are a helpful assistant that...',  // AI system instructions
    userPromptTemplate: '{{text}}', // User prompt ({{text}} = captured text)
    postAction: 'paste' as const    // 'paste' or 'copy'
  }
];
```

### Step 2: Add to Property Inspector UI

Edit `property-inspector/index.html` - add option to the preset selector:

```html
<select class="sdpi-item-value select" id="presetSelector">
  <!-- ... existing options ... -->
  <option value="my-new-preset">My New Preset</option>
</select>
```

### Step 3: Add to Property Inspector JS

Edit `property-inspector/js/property-inspector.js` - add preset to `PRESETS` object:

```javascript
const PRESETS = {
  // ... existing presets ...
  'my-new-preset': {
    name: 'My New Preset',
    systemPrompt: 'You are a helpful assistant that...',
    userPromptTemplate: '{{text}}',
    postAction: 'paste'
  }
};
```

### Step 4: Rebuild

```bash
npm run build
streamdeck restart com.dzarlax.ai-assistant
```

### Preset Fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Unique identifier, used in settings |
| `name` | string | Display name on encoder LCD |
| `systemPrompt` | string | AI system instructions |
| `userPromptTemplate` | string | Prompt template, use `{{text}}` for captured content |
| `postAction` | 'paste' \| 'copy' | What to do with result |

---

## Settings

### Global Settings
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| provider | string | "openai" | openai, anthropic, openrouter, custom |
| apiKey | string | - | API key |
| baseUrl | string | - | Custom endpoint |
| model | string | "gpt-4o" | Model identifier |
| temperature | number | 0.7 | 0-2 |
| maxTokens | number | 4096 | Max response length |
| timeout | number | 30 | Seconds |

### Action Settings (Text Action)
| Setting | Type | Default |
|---------|------|---------|
| systemPrompt | string | "You are a helpful assistant." |
| userPromptTemplate | string | "{{text}}" |
| inputMode | string | "selection" |
| postAction | string | "paste" |

### Encoder Settings (Prompt Selector)
| Setting | Type | Description |
|---------|------|-------------|
| presetIndex | number | Current preset index (0-8) |

---

## Supported Models

### OpenAI
o3-mini, o1, o1-mini, gpt-4o, gpt-4o-mini

### Anthropic
claude-sonnet-4-20250514, claude-3-7-sonnet-latest, claude-3-5-haiku-20241022, claude-3-opus-20240229

### Google Gemini
gemini-2.5-pro-preview-06-05, gemini-2.0-flash, gemini-2.0-flash-lite, gemini-1.5-pro, gemini-1.5-flash

### OpenRouter
anthropic/claude-sonnet-4, openai/gpt-4o, google/gemini-pro-1.5, meta-llama/llama-3.1-70b-instruct

---

## Key Implementation Details

### Shared Logic (`processWithAI`)
Both actions use shared `processWithAI()` function:
1. Get global settings (API key, model, etc.)
2. Capture input (selection or clipboard)
3. Build prompt from template
4. Call AI API
5. Output result (paste or copy)

### System Utils (`src/system-utils.ts`)
- `copyToClipboard(text)` - spawn + pbcopy with UTF-8 encoding
- `pasteFromClipboard()` - pbpaste with 10MB maxBuffer
- `simulateCopy()` - key code 8 + Cmd (layout-independent)
- `simulatePaste()` - key code 9 + Cmd (layout-independent)

### Encoder Feedback
```typescript
await action.setFeedback({
  title: preset.name,
  value: `${index + 1}/9`,
  indicator: Math.round(((index + 1) / 9) * 100)
});
```

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
