# AI Assistant - Stream Deck Plugin

Process text with AI APIs using clipboard manipulation and keyboard emulation.

## Features
- Multiple AI provider support (OpenAI, Anthropic, OpenRouter)
- Custom prompts with templating
- Clipboard-based text processing
- Keyboard emulation for paste operations
- Stream Deck + encoder support for prompt selection

## Installation

```bash
# Install dependencies
npm install

# Build plugin
npm run build

# Link to Stream Deck (one-time setup)
streamdeck link com.dzarlax.ai-assistant.sdPlugin
```

## Configuration

Configure the plugin through the Property Inspector in Stream Deck:
1. Select your AI provider
2. Enter your API key
3. Set your default prompt

## Project Structure

```
├── src/
│   ├── main.ts          # Entry point
│   └── plugin.ts        # Action implementations
├── com.dzarlax.ai-assistant.sdPlugin/
│   ├── bin/             # Compiled plugin
│   ├── ui/              # Property Inspector
│   ├── imgs/            # Icons
│   └── manifest.json    # Plugin manifest
├── rollup.config.mjs    # Build configuration
└── manifest.json        # Source manifest
```

## Development Status

**Currently debugging connection issue** - see `@claude.md` for detailed notes.

### Known Issue
- Plugin works when run manually
- Stream Deck doesn't auto-spawn the plugin process
- Error: "The plugin 'com.dzarlax.ai-assistant' has no attached client"

### Quick Test
```bash
# Test plugin manually (this works!)
cd "/Users/dzarlax/Library/Application Support/com.elgato.StreamDeck/Plugins/com.dzarlax.ai-assistant.sdPlugin"
/Users/dzarlax/Library/Application\ Support/com.elgato.StreamDeck/NodeJS/20.19.5/node --no-global-search-paths bin/plugin.js -port 28196 -pluginUUID test -registerEvent registerPlugin -info '{"application":{"platform":"mac"},"devices":[],"plugin":{"uuid":"com.dzarlax.ai-assistant"}}'
```

## Tech Stack
- TypeScript
- @elgato/streamdeck SDK v1.4.1
- Rollup for bundling
- Axios for HTTP requests

## License
MIT
