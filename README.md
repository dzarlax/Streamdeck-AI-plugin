# AI Assistant - Stream Deck Plugin

AI-powered text processing plugin for Elgato Stream Deck. Capture selected text or clipboard content, send it to an AI provider, and get the result pasted back or copied to clipboard.

## Features

- **Multiple AI providers**: OpenAI, Anthropic Claude, Google Gemini, OpenRouter, or any custom OpenAI-compatible endpoint
- **9 built-in presets**: Fix Grammar, Translate (EN/RU/SR/DE), Summarize, Explain Code, Professional & Casual rewrites
- **Two action types**:
  - **AI Text Action** — regular key with fully customizable prompts
  - **AI Prompt Selector** — Stream Deck+ encoder with quick preset switching via dial rotation
- **Custom prompts** with `{{text}}` template variable
- **Clipboard & selection modes** — process selected text or clipboard content

## Installation

1. Download the latest release from [Releases](https://github.com/dzarlax/streamdeck-ai-plugin/releases)
2. Double-click the `.streamDeckPlugin` file to install
3. The plugin will appear in Stream Deck under the **AI Assistant** category

## Configuration

1. Drag an **AI Text Action** or **AI Prompt Selector** to your Stream Deck
2. In the Property Inspector, select your AI provider (OpenAI, Anthropic, Gemini, OpenRouter, or Custom)
3. Enter your API key
4. Choose a model or use the **Fetch** button to load available models from the API
5. Configure prompts or select a built-in preset

## Usage

### AI Text Action (Key)
- Press the key to capture selected text (or clipboard), process it through AI, and paste/copy the result
- Customize the system prompt and user template per key

### AI Prompt Selector (Encoder / Stream Deck+)
- **Rotate** the dial to switch between presets
- **Press** or **tap** to execute the selected preset
- Enable/disable and reorder presets in the Property Inspector

## Building from Source

```bash
npm install
npm run build
streamdeck link com.dzarlax.ai-assistant.sdPlugin
```

## Privacy

Your text is sent directly from your computer to the selected AI provider's API. The plugin does not collect analytics, telemetry, or personal data. See [Privacy Policy](PRIVACY.md) for details.

## License

[MIT](LICENSE)
