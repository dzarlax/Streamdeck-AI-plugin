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
    actionName: 'Translate EN',
    systemPrompt: 'You are a professional translator. Translate the following text to English. Preserve the tone and style. Output ONLY the translated text.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste'
  },
  'translate-ru': {
    actionName: 'Translate RU',
    systemPrompt: 'You are a professional translator. Translate the following text to Russian. Preserve the tone and style. Output ONLY the translated text.',
    userPromptTemplate: '{{text}}',
    postAction: 'paste'
  },
  'translate-sr': {
    actionName: 'Translate SR',
    systemPrompt: 'You are a professional translator. Translate the following text to Serbian. Preserve the tone and style. Output ONLY the translated text.',
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

const FALLBACK_MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'o3-mini', name: 'o3-mini' },
    { id: 'o1', name: 'o1' },
    { id: 'o1-mini', name: 'o1-mini' }
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
  ],
  openrouter: [
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' }
  ],
  custom: []
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

    if (data.event === 'didReceiveSettings' && data.payload.settings) {
      actionSettings = { ...actionSettings, ...data.payload.settings };
      updateActionUI();
    }

    if (data.event === 'didReceiveGlobalSettings') {
      const s = data.payload.settings;
      if (s && Object.keys(s).length > 0) {
        globalSettings = { ...globalSettings, ...s };
        updateGlobalUI();
      }
    }
  };
}

// --- Model fetching ---

function getModelsEndpoint(provider, baseUrl) {
  if (provider === 'openai') return { url: 'https://api.openai.com/v1/models', headers: {} };
  if (provider === 'anthropic') return { url: 'https://api.anthropic.com/v1/models', headers: { 'anthropic-version': '2023-06-01' } };
  if (provider === 'openrouter') return { url: 'https://openrouter.ai/api/v1/models', headers: {} };
  if (provider === 'custom' && baseUrl) {
    const base = baseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
    return { url: base + '/models', headers: {} };
  }
  return null;
}

function parseModelsResponse(provider, data) {
  if (provider === 'anthropic') {
    return (data.data || [])
      .map(m => ({ id: m.id, name: m.display_name || m.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  let models = (data.data || []).map(m => ({ id: m.id, name: m.name || m.id }));

  if (provider === 'openai') {
    models = models.filter(m =>
      m.id.startsWith('gpt-') || m.id.startsWith('o1') ||
      m.id.startsWith('o3') || m.id.startsWith('o4')
    );
  }

  return models.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchModels() {
  const provider = globalSettings.provider;
  const apiKey = globalSettings.apiKey;
  const baseUrl = globalSettings.baseUrl;
  const statusEl = document.getElementById('fetchStatus');
  const btn = document.getElementById('fetchModelsBtn');

  if (!apiKey && provider !== 'openrouter') {
    statusEl.textContent = 'Enter API key first';
    return;
  }

  const endpoint = getModelsEndpoint(provider, baseUrl);
  if (!endpoint) {
    statusEl.textContent = 'Cannot fetch for this provider';
    populateModelSelect(FALLBACK_MODELS[provider] || []);
    return;
  }

  btn.disabled = true;
  btn.textContent = '...';
  statusEl.textContent = 'Loading...';

  try {
    const headers = { ...endpoint.headers, 'Content-Type': 'application/json' };
    if (apiKey) {
      if (provider === 'anthropic') headers['x-api-key'] = apiKey;
      else headers['Authorization'] = 'Bearer ' + apiKey;
    }

    const resp = await fetch(endpoint.url, { method: 'GET', headers });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const data = await resp.json();
    const models = parseModelsResponse(provider, data);

    if (models.length === 0) {
      statusEl.textContent = 'No models found, showing defaults';
      populateModelSelect(FALLBACK_MODELS[provider] || []);
    } else {
      statusEl.textContent = models.length + ' models loaded';
      populateModelSelect(models);
    }
  } catch (err) {
    statusEl.textContent = 'Failed: ' + err.message;
    populateModelSelect(FALLBACK_MODELS[provider] || []);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Fetch';
  }
}

// --- UI helpers ---

function populateModelSelect(models) {
  const select = document.getElementById('modelSelect');
  const current = globalSettings.model || '';
  select.innerHTML = '';

  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name !== m.id ? m.name + ' (' + m.id + ')' : m.id;
    select.appendChild(opt);
  });

  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = 'Custom model...';
  select.appendChild(customOpt);

  const inList = models.some(m => m.id === current);
  if (inList) {
    select.value = current;
    document.getElementById('customModelGroup').style.display = 'none';
  } else if (current) {
    select.value = '__custom__';
    document.getElementById('customModelInput').value = current;
    document.getElementById('customModelGroup').style.display = 'block';
  }
}

function getSelectedModel() {
  const sel = document.getElementById('modelSelect');
  return sel.value === '__custom__'
    ? (document.getElementById('customModelInput').value || '')
    : sel.value;
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
  populateModelSelect(FALLBACK_MODELS[provider] || FALLBACK_MODELS.openai);
}

function updateActionUI() {
  document.getElementById('actionName').value = actionSettings.actionName || '';
  document.getElementById('systemPrompt').value = actionSettings.systemPrompt || '';
  document.getElementById('userPromptTemplate').value = actionSettings.userPromptTemplate || '{{text}}';
  document.getElementById('inputMode').value = actionSettings.inputMode || 'selection';
  document.getElementById('postAction').value = actionSettings.postAction || 'paste';
}

function saveGlobalSettings() {
  globalSettings = {
    provider: document.getElementById('provider').value,
    apiKey: document.getElementById('apiKey').value,
    baseUrl: document.getElementById('baseUrl').value,
    model: getSelectedModel(),
    temperature: parseFloat(document.getElementById('temperature').value),
    maxTokens: parseInt(document.getElementById('maxTokens').value),
    timeout: parseInt(document.getElementById('timeout').value)
  };
  if (websocket) {
    websocket.send(JSON.stringify({ event: 'setGlobalSettings', context: uuid, payload: globalSettings }));
  }
}

function saveActionSettings() {
  actionSettings = {
    actionName: document.getElementById('actionName').value,
    systemPrompt: document.getElementById('systemPrompt').value,
    userPromptTemplate: document.getElementById('userPromptTemplate').value,
    inputMode: document.getElementById('inputMode').value,
    postAction: document.getElementById('postAction').value
  };
  if (websocket) {
    websocket.send(JSON.stringify({ event: 'setSettings', context: uuid, payload: actionSettings }));
  }
}

function toggleBaseUrl() {
  document.getElementById('baseUrlGroup').style.display =
    document.getElementById('provider').value === 'custom' ? 'block' : 'none';
}

function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  const heading = section.previousElementSibling;
  section.classList.toggle('collapsed');
  heading.classList.toggle('collapsed');
}

function loadPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;
  document.getElementById('actionName').value = preset.actionName;
  document.getElementById('systemPrompt').value = preset.systemPrompt;
  document.getElementById('userPromptTemplate').value = preset.userPromptTemplate;
  document.getElementById('postAction').value = preset.postAction;
  saveActionSettings();
}

// --- Event listeners ---

document.addEventListener('DOMContentLoaded', () => {
  // Provider
  document.getElementById('provider').addEventListener('change', () => {
    toggleBaseUrl();
    const p = document.getElementById('provider').value;
    document.getElementById('fetchStatus').textContent = '';
    populateModelSelect(FALLBACK_MODELS[p] || []);
    saveGlobalSettings();
  });

  // Global inputs
  ['apiKey', 'baseUrl', 'maxTokens', 'timeout'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', saveGlobalSettings);
  });

  // Model select
  document.getElementById('modelSelect').addEventListener('change', () => {
    const v = document.getElementById('modelSelect').value;
    document.getElementById('customModelGroup').style.display = v === '__custom__' ? 'block' : 'none';
    saveGlobalSettings();
  });

  document.getElementById('customModelInput')?.addEventListener('change', saveGlobalSettings);

  // Temperature
  const temp = document.getElementById('temperature');
  temp.addEventListener('input', () => {
    document.getElementById('temperatureValue').textContent = temp.value;
  });
  temp.addEventListener('change', saveGlobalSettings);

  // Fetch models
  document.getElementById('fetchModelsBtn').addEventListener('click', fetchModels);

  // Action inputs
  ['actionName', 'systemPrompt', 'userPromptTemplate', 'inputMode', 'postAction'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('change', saveActionSettings);
  });

  // Preset
  document.getElementById('loadPresetBtn').addEventListener('click', () => {
    const key = document.getElementById('presetSelector').value;
    if (key) loadPreset(key);
  });
});
