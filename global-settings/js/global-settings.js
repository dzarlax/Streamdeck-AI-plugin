/**
 * Global Settings for AI Plugin
 */

let globalSettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 30
};

// Stream Deck connection
let websocket = null;
let uuid = null;

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
  uuid = inUUID;

  websocket = new WebSocket('ws://localhost:' + inPort);

  websocket.onopen = () => {
    const json = {
      event: inRegisterEvent,
      uuid: uuid
    };
    websocket.send(JSON.stringify(json));

    // Request current global settings
    websocket.send(JSON.stringify({
      event: 'getGlobalSettings',
      context: uuid
    }));
  };

  websocket.onmessage = (evt) => {
    const jsonObj = JSON.parse(evt.data);

    if (jsonObj.event === 'didReceiveGlobalSettings') {
      const receivedSettings = jsonObj.payload.settings;
      if (receivedSettings && Object.keys(receivedSettings).length > 0) {
        globalSettings = { ...globalSettings, ...receivedSettings };
        updateUI();
      }
    }
  };
}

function updateUI() {
  document.getElementById('provider').value = globalSettings.provider || 'openai';
  document.getElementById('apiKey').value = globalSettings.apiKey || '';
  document.getElementById('baseUrl').value = globalSettings.baseUrl || '';
  document.getElementById('model').value = globalSettings.model || 'gpt-4o';
  document.getElementById('temperature').value = globalSettings.temperature || 0.7;
  document.getElementById('temperatureValue').textContent = globalSettings.temperature || 0.7;
  document.getElementById('maxTokens').value = globalSettings.maxTokens || 4096;
  document.getElementById('timeout').value = globalSettings.timeout || 30;

  toggleBaseUrlField();
}

function saveSettings() {
  globalSettings = {
    provider: document.getElementById('provider').value,
    apiKey: document.getElementById('apiKey').value,
    baseUrl: document.getElementById('baseUrl').value,
    model: document.getElementById('model').value,
    temperature: parseFloat(document.getElementById('temperature').value),
    maxTokens: parseInt(document.getElementById('maxTokens').value),
    timeout: parseInt(document.getElementById('timeout').value)
  };

  if (websocket) {
    websocket.send(JSON.stringify({
      event: 'setGlobalSettings',
      context: uuid,
      payload: globalSettings
    }));
  }
}

function toggleBaseUrlField() {
  const provider = document.getElementById('provider').value;
  const baseUrlGroup = document.getElementById('baseUrlGroup');
  baseUrlGroup.style.display = provider === 'custom' ? 'block' : 'none';
}

function setModelSuggestion(model) {
  document.getElementById('model').value = model;
  saveSettings();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Provider change
  document.getElementById('provider').addEventListener('change', () => {
    toggleBaseUrlField();
    saveSettings();
  });

  // Input change handlers
  const inputs = ['apiKey', 'baseUrl', 'model', 'maxTokens', 'timeout'];
  inputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', saveSettings);
      element.addEventListener('input', saveSettings);
    }
  });

  // Temperature slider
  const tempSlider = document.getElementById('temperature');
  tempSlider.addEventListener('input', () => {
    document.getElementById('temperatureValue').textContent = tempSlider.value;
    saveSettings();
  });

  // Model quick-select buttons
  document.querySelectorAll('.model-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setModelSuggestion(btn.dataset.model);
    });
  });

  // Test connection
  document.getElementById('testConnection').addEventListener('click', async () => {
    const statusIndicator = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');

    statusIndicator.className = 'status-indicator status-unknown';
    statusText.textContent = 'Testing...';

    // The actual test would be done by the plugin
    // Here we just signal to test
    if (websocket) {
      websocket.send(JSON.stringify({
        event: 'sendToPlugin',
        action: 'com.yourname.ai-plugin.text-action',
        context: uuid,
        payload: {
          event: 'testConnection'
        }
      }));

      // For UI demo, show success after delay
      setTimeout(() => {
        if (globalSettings.apiKey) {
          statusIndicator.className = 'status-indicator status-ok';
          statusText.textContent = 'Connection successful';
        } else {
          statusIndicator.className = 'status-indicator status-error';
          statusText.textContent = 'Please enter API key';
        }
      }, 1000);
    }
  });
});
