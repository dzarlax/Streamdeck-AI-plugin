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
  'translate-de': {
    actionName: 'Translate DE',
    systemPrompt: 'You are a professional translator. Translate the following text to German. Preserve the tone and style. Output ONLY the translated text.',
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

// Default encoder preset configuration
const DEFAULT_ENCODER_PRESETS = [
  { key: 'fix-grammar', enabled: true },
  { key: 'translate-en', enabled: true },
  { key: 'translate-ru', enabled: true },
  { key: 'translate-sr', enabled: true },
  { key: 'translate-de', enabled: true },
  { key: 'summarize', enabled: true },
  { key: 'explain-code', enabled: true },
  { key: 'professional', enabled: true },
  { key: 'casual', enabled: true }
];


let globalSettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4.1',
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 30,
  modelCache: {}
};

let actionSettings = {
  actionName: '',
  systemPrompt: '',
  userPromptTemplate: '{{text}}',
  inputMode: 'selection',
  postAction: 'paste'
};

let encoderSettings = {
  presetIndex: 0,
  encoderPresets: DEFAULT_ENCODER_PRESETS
};

let websocket = null;
let uuid = null;
let actionType = null; // 'text-action' or 'prompt-selector'

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
  uuid = inUUID;
  websocket = new WebSocket('ws://localhost:' + inPort);

  // Parse action info to determine action type
  try {
    const actionInfo = JSON.parse(inActionInfo);
    // action is full UUID like "com.dzarlax.ai-assistant.prompt-selector"
    actionType = actionInfo.action.includes('prompt-selector') ? 'prompt-selector' : 'text-action';
  } catch (e) {
    actionType = 'text-action'; // fallback
  }

  websocket.onopen = () => {
    websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: uuid }));
    websocket.send(JSON.stringify({ event: 'getSettings', context: uuid }));
    websocket.send(JSON.stringify({ event: 'getGlobalSettings', context: uuid }));
  };

  websocket.onmessage = (evt) => {
    const data = JSON.parse(evt.data);

    if (data.event === 'didReceiveSettings' && data.payload.settings) {
      if (actionType === 'prompt-selector') {
        encoderSettings = { ...encoderSettings, ...data.payload.settings };
        showActionSections();
        updateEncoderUI();
      } else {
        actionSettings = { ...actionSettings, ...data.payload.settings };
        updateActionUI();
      }
    }

    if (data.event === 'didReceiveGlobalSettings') {
      const s = data.payload.settings;
      if (s && Object.keys(s).length > 0) {
        globalSettings = { ...globalSettings, ...s };
        updateGlobalUI();
      }
    }
  };

  // Show/hide sections based on action type
  showActionSections();
}

// --- Model fetching ---

function getModelsEndpoint(provider, baseUrl) {
  if (provider === 'openai') return { url: 'https://api.openai.com/v1/models', headers: {} };
  if (provider === 'anthropic') return { url: 'https://api.anthropic.com/v1/models', headers: { 'anthropic-version': '2023-06-01' } };
  if (provider === 'gemini') return { url: 'https://generativelanguage.googleapis.com/v1beta/models', headers: {} };
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

  if (provider === 'gemini') {
    return (data.models || [])
      .map(m => {
        const id = m.name.replace('models/', '');
        return { id, name: m.displayName || id };
      })
      .filter(m => m.id.startsWith('gemini'))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  let models = (data.data || []).map(m => ({ id: m.id, name: m.name || m.id }));

  if (provider === 'openai') {
    models = models.filter(m =>
      m.id.startsWith('gpt-') || m.id.startsWith('o1') ||
      m.id.startsWith('o2') || m.id.startsWith('o3') || m.id.startsWith('o4')
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
    return;
  }

  btn.disabled = true;
  btn.textContent = '...';
  statusEl.textContent = 'Loading...';

  try {
    const headers = { ...endpoint.headers, 'Content-Type': 'application/json' };
    let url = endpoint.url;

    if (apiKey) {
      if (provider === 'anthropic') headers['x-api-key'] = apiKey;
      else if (provider === 'gemini') url = endpoint.url + '?key=' + apiKey;
      else headers['Authorization'] = 'Bearer ' + apiKey;
    }

    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const data = await resp.json();
    const models = parseModelsResponse(provider, data);

    if (models.length === 0) {
      statusEl.textContent = 'No models found';
    } else {
      statusEl.textContent = models.length + ' models loaded';
      if (!globalSettings.modelCache) globalSettings.modelCache = {};
      globalSettings.modelCache[provider] = models;
      saveGlobalSettings();
      populateModelSelect(models);
    }
  } catch (err) {
    statusEl.textContent = 'Failed: ' + err.message;
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

  if (models.some(m => m.id === current)) {
    select.value = current;
  } else if (models.length > 0) {
    select.value = models[0].id;
  }
}

function getSelectedModel() {
  const provider = document.getElementById('provider').value;
  if (provider === 'custom') {
    return document.getElementById('customModelInput').value || '';
  }
  return document.getElementById('modelSelect').value || '';
}

function updateModelUI(provider) {
  const isCustom = provider === 'custom';
  document.getElementById('modelSelectRow').style.display = isCustom ? 'none' : '';
  document.getElementById('customModelGroup').style.display = isCustom ? 'block' : 'none';

  if (isCustom) {
    document.getElementById('customModelInput').value = globalSettings.model || '';
  } else {
    const cached = (globalSettings.modelCache || {})[provider];
    if (cached && cached.length > 0) {
      populateModelSelect(cached);
      document.getElementById('fetchStatus').textContent = cached.length + ' models (cached)';
    } else {
      const select = document.getElementById('modelSelect');
      select.innerHTML = '';
      const currentModel = globalSettings.model || '';
      if (currentModel) {
        const opt = document.createElement('option');
        opt.value = currentModel;
        opt.textContent = currentModel;
        select.appendChild(opt);
      }
      document.getElementById('fetchStatus').textContent = 'Click Fetch to load models';
    }
  }
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
  updateModelUI(provider);
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
    timeout: parseInt(document.getElementById('timeout').value),
    modelCache: globalSettings.modelCache || {}
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

// --- Encoder Preset Configuration ---

function showActionSections() {
  const isEncoder = actionType === 'prompt-selector';
  const setDisplay = (id, display) => {
    const el = document.getElementById(id);
    if (el) el.style.display = display;
  };

  // Hide entire Prompt Settings and Quick Presets blocks for encoder (heading + content)
  setDisplay('promptBlock', isEncoder ? 'none' : 'block');
  setDisplay('presetBlock', isEncoder ? 'none' : 'block');
  setDisplay('encoderSection', isEncoder ? 'block' : 'none');
  setDisplay('divider1', isEncoder ? 'none' : 'block');
  setDisplay('divider2', isEncoder ? 'none' : 'block');
}

function updateEncoderUI() {
  renderPresetList();
}

function renderPresetList() {
  const container = document.getElementById('presetList');
  container.innerHTML = '';

  const presets = encoderSettings.encoderPresets || DEFAULT_ENCODER_PRESETS;

  presets.forEach((preset, index) => {
    const presetInfo = PRESETS[preset.key];
    if (!presetInfo) return;

    const item = document.createElement('div');
    item.className = 'preset-item' + (preset.enabled ? '' : ' disabled');
    item.draggable = true;
    item.dataset.index = index;

    item.innerHTML = `
      <span class="preset-drag">⋮⋮</span>
      <input type="checkbox" class="preset-toggle" ${preset.enabled ? 'checked' : ''} data-key="${preset.key}">
      <span class="preset-name">${presetInfo.actionName}</span>
    `;

    // Drag events
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragleave', handleDragLeave);

    // Toggle event
    const checkbox = item.querySelector('.preset-toggle');
    checkbox.addEventListener('change', (e) => {
      const key = e.target.dataset.key;
      const idx = encoderSettings.encoderPresets.findIndex(p => p.key === key);
      if (idx !== -1) {
        encoderSettings.encoderPresets[idx].enabled = e.target.checked;
        item.className = 'preset-item' + (e.target.checked ? '' : ' disabled');
        saveEncoderSettings();
      }
    });

    container.appendChild(item);
  });
}

let draggedItem = null;

function handleDragStart(e) {
  draggedItem = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.preset-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drag-over');
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');

  if (draggedItem === this) return;

  const fromIndex = parseInt(draggedItem.dataset.index);
  const toIndex = parseInt(this.dataset.index);

  if (fromIndex !== toIndex) {
    const presets = encoderSettings.encoderPresets;
    const [removed] = presets.splice(fromIndex, 1);
    presets.splice(toIndex, 0, removed);

    saveEncoderSettings();
    renderPresetList();
  }
}

function saveEncoderSettings() {
  if (websocket) {
    websocket.send(JSON.stringify({
      event: 'setSettings',
      context: uuid,
      payload: encoderSettings
    }));
  }
}

function resetEncoderPresets() {
  encoderSettings.encoderPresets = JSON.parse(JSON.stringify(DEFAULT_ENCODER_PRESETS));
  encoderSettings.presetIndex = 0;
  saveEncoderSettings();
  renderPresetList();
}

// --- Event listeners ---

document.addEventListener('DOMContentLoaded', () => {
  // Provider
  document.getElementById('provider').addEventListener('change', () => {
    const p = document.getElementById('provider').value;
    toggleBaseUrl();
    document.getElementById('fetchStatus').textContent = '';
    updateModelUI(p);
    saveGlobalSettings();
  });

  // Global inputs
  ['apiKey', 'baseUrl', 'maxTokens', 'timeout'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', saveGlobalSettings);
  });

  // Model select
  document.getElementById('modelSelect').addEventListener('change', saveGlobalSettings);

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

  // Encoder reset button
  document.getElementById('resetPresetsBtn').addEventListener('click', resetEncoderPresets);
});
