/**
 * Property Inspector for AI Assistant
 */

const PRESETS = {
  'fix-grammar': {
    actionName: 'Fix Grammar',
    systemPrompt: 'You are a professional proofreader. Fix all spelling and grammar errors while preserving the original meaning and tone. Output ONLY the corrected text, nothing else.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste'
  },
  'translate-en': {
    actionName: '→ English',
    systemPrompt: 'You are a professional translator. Translate the following text to English. Preserve the tone and style. Output ONLY the translated text.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste'
  },
  'translate-ru': {
    actionName: '→ Russian',
    systemPrompt: 'You are a professional translator. Translate the following text to Russian. Preserve the tone and style. Output ONLY the translated text.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste'
  },
  'summarize': {
    actionName: 'Summarize',
    systemPrompt: 'You are an expert at summarization. Summarize the following content concisely in 3-5 bullet points. Use clear, simple language.',
    userPromptTemplate: '{{text}}',
    postAction: 'copy'
  },
  'explain-code': {
    actionName: 'Explain Code',
    systemPrompt: 'You are a programming expert. Explain the following code in simple terms. Describe what it does, how it works, and any notable patterns or techniques used.',
    userPromptTemplate: '{{text}}',
    postAction: 'copy'
  },
  'professional': {
    actionName: 'Professional',
    systemPrompt: 'You are a professional editor. Rewrite the following text in a more professional, polished tone while keeping the same meaning.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste'
  },
  'casual': {
    actionName: 'Casual',
    systemPrompt: 'You are a casual, friendly editor. Rewrite the following text in a more relaxed, conversational tone while keeping the same meaning.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste'
  }
};

// Default models (used as fallback)
const DEFAULT_MODELS = {
  openai: [
    { id: 'o3-mini', name: 'o3-mini' },
    { id: 'o1', name: 'o1' },
    { id: 'o1-mini', name: 'o1-mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
  ],
  anthropic: [
    { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
  ],
  openrouter: [
    { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'openai/o3-mini', name: 'o3-mini' },
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' }
  ]
};

let globalSettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 30
};

let actionSettings = {
  actionName: '',
  systemPrompt: '',
  userPromptTemplate: '{{text}}',
  inputMode: 'selection',
  postAction: 'paste'
};

let websocket = null;
let uuid = null;
let cachedModels = {};

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
  uuid = inUUID;
  websocket = new WebSocket('ws://localhost:' + inPort);

  websocket.onopen = () => {
    websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: uuid }));
    websocket.send(JSON.stringify({ event: 'getSettings', context: uuid }));
    websocket.send(JSON.stringify({ event: 'getGlobalSettings', context: uuid }));
  };

  websocket.onmessage = (evt) => {
    const data = JSON.parse(evt.data);

    if (data.event === 'didReceiveSettings') {
      if (data.payload.settings) {
        actionSettings = { ...actionSettings, ...data.payload.settings };
        updateActionUI();
      }
    }

    if (data.event === 'didReceiveGlobalSettings') {
      if (data.payload.settings && Object.keys(data.payload.settings).length > 0) {
        globalSettings = { ...globalSettings, ...data.payload.settings };
        updateGlobalUI();
      }
    }
  };
}

function updateGlobalUI() {
  const provider = globalSettings.provider || 'openai';
  document.getElementById('provider').value = provider;
  document.getElementById('apiKey').value = globalSettings.apiKey || '';
  document.getElementById('baseUrl').value = globalSettings.baseUrl || '';
  document.getElementById('temperature').value = globalSettings.temperature || 0.7;
  document.getElementById('temperatureValue').textContent = globalSettings.temperature || 0.7;
  document.getElementById('maxTokens').value = globalSettings.maxTokens || 4096;
  document.getElementById('timeout').value = globalSettings.timeout || 30;

  toggleBaseUrl();
  updateModelDropdown();

  // Set the specific model dropdown/input value
  if (globalSettings.model) {
    const modelEl = document.getElementById(`model-${provider}`);
    if (modelEl) {
      modelEl.value = globalSettings.model;
    }
  }
}

function updateActionUI() {
  document.getElementById('actionName').value = actionSettings.actionName || '';
  document.getElementById('systemPrompt').value = actionSettings.systemPrompt || '';
  document.getElementById('userPromptTemplate').value = actionSettings.userPromptTemplate || '{{text}}';
  document.getElementById('inputMode').value = actionSettings.inputMode || 'selection';
  document.getElementById('postAction').value = actionSettings.postAction || 'paste';
}

function updateModelDropdown() {
  const provider = globalSettings.provider || 'openai';

  // Hide all model groups
  document.querySelectorAll('.model-group').forEach(el => el.classList.remove('active'));

  // Show provider's model group
  const modelGroup = document.getElementById(`${provider}-models`);
  if (modelGroup) {
    modelGroup.classList.add('active');
  }
}

function getCurrentModel() {
  const provider = document.getElementById('provider').value;
  const modelGroup = document.getElementById(`${provider}-models`);
  if (modelGroup) {
    const select = modelGroup.querySelector('select');
    if (select) return select.value;
    const input = modelGroup.querySelector('input');
    if (input) return input.value;
  }
  return 'gpt-4o';
}

function saveGlobalSettings() {
  globalSettings = {
    provider: document.getElementById('provider').value,
    apiKey: document.getElementById('apiKey').value,
    baseUrl: document.getElementById('baseUrl').value,
    model: getCurrentModel(),
    temperature: parseFloat(document.getElementById('temperature').value),
    maxTokens: parseInt(document.getElementById('maxTokens').value),
    timeout: parseInt(document.getElementById('timeout').value)
  };

  websocket.send(JSON.stringify({
    event: 'setGlobalSettings',
    context: uuid,
    payload: globalSettings
  }));
}

function saveActionSettings() {
  actionSettings = {
    actionName: document.getElementById('actionName').value,
    systemPrompt: document.getElementById('systemPrompt').value,
    userPromptTemplate: document.getElementById('userPromptTemplate').value,
    inputMode: document.getElementById('inputMode').value,
    postAction: document.getElementById('postAction').value
  };

  websocket.send(JSON.stringify({
    event: 'setSettings',
    context: uuid,
    payload: actionSettings
  }));
}

function toggleBaseUrl() {
  document.getElementById('baseUrlGroup').style.display =
    document.getElementById('provider').value === 'custom' ? 'block' : 'none';
}

function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  const toggle = section.previousElementSibling;
  section.classList.toggle('collapsed');
  toggle.classList.toggle('collapsed');
}

function loadPreset(key) {
  const preset = PRESETS[key];
  if (preset) {
    document.getElementById('actionName').value = preset.actionName;
    document.getElementById('systemPrompt').value = preset.systemPrompt;
    document.getElementById('userPromptTemplate').value = preset.userPromptTemplate;
    document.getElementById('postAction').value = preset.postAction;
    saveActionSettings();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Provider change
  document.getElementById('provider').addEventListener('change', () => {
    toggleBaseUrl();
    updateModelDropdown();
    saveGlobalSettings();
  });

  // API Key change
  document.getElementById('apiKey').addEventListener('change', (e) => {
    saveGlobalSettings();
  });

  // Global inputs
  ['baseUrl', 'maxTokens', 'timeout'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', saveGlobalSettings);
  });

  // Temperature
  const tempSlider = document.getElementById('temperature');
  tempSlider.addEventListener('input', (e) => {
    document.getElementById('temperatureValue').textContent = e.target.value;
  });
  tempSlider.addEventListener('change', saveGlobalSettings);

  // Model changes
  ['openai', 'anthropic', 'openrouter', 'custom'].forEach(provider => {
    const el = document.getElementById(`model-${provider}`);
    el?.addEventListener('change', saveGlobalSettings);
    el?.addEventListener('input', saveGlobalSettings);
  });

  // Action inputs
  ['actionName', 'systemPrompt', 'userPromptTemplate', 'inputMode', 'postAction'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', saveActionSettings);
    el?.addEventListener('change', saveActionSettings);
  });

  // Preset button
  document.getElementById('loadPresetBtn').addEventListener('click', () => {
    const key = document.getElementById('presetSelector').value;
    if (key) loadPreset(key);
  });
});
