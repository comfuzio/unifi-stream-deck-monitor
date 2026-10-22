'use strict';

const crypto = require('node:crypto');
const WebSocket = require('ws');
const { UniFiClient } = require('./unifi');
const { getSecret, saveSecret, deleteSecret } = require('./credential-store');
const { calculateRates, formatMbps } = require('./rates');

let websocket;
let pluginUUID;
const actions = new Map();
const defaults = { baseUrl: '', site: '', intervalSeconds: 5, credentialId: '' };
const clampInterval = value => Math.max(5, Math.min(60, Number(value) || 5));

function send(event, context, payload = {}) {
  if (websocket?.readyState === WebSocket.OPEN) websocket.send(JSON.stringify({ event, context, payload }));
}
function title(context, text) { send('setTitle', context, { title: text, target: 0 }); }
function publicSettings(settings, hasCredential = false) {
  const { apiKey, ...safe } = settings || {};
  return { ...defaults, ...safe, hasCredential: Boolean(hasCredential) };
}
function hydrateSettings(raw = {}) {
  const settings = { ...defaults, ...raw };
  // One-time migration from the development prototype: move any legacy key out
  // of Stream Deck settings and overwrite those settings without the secret.
  if (typeof settings.apiKey === 'string' && settings.apiKey.trim()) {
    settings.credentialId = settings.credentialId || crypto.randomUUID();
    saveSecret(settings.credentialId, settings.apiKey);
    delete settings.apiKey;
    return { settings, migrated: true, apiKey: getSecret(settings.credentialId) };
  }
  delete settings.apiKey;
  return { settings, migrated: false, apiKey: getSecret(settings.credentialId) };
}
function applySettings(state, raw) {
  const hydrated = hydrateSettings(raw);
  state.settings = hydrated.settings;
  state.apiKey = hydrated.apiKey;
  state.client.configure({ ...state.settings, apiKey: state.apiKey || '' });
  if (hydrated.migrated) send('setSettings', state.context, state.settings);
  state.previous = null;
}

function connectElgatoStreamDeckSocket(port, uuid, registerEvent) {
  pluginUUID = uuid;
  websocket = new WebSocket(`ws://127.0.0.1:${port}`);
  websocket.on('open', () => send(registerEvent, pluginUUID));
  websocket.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const context = msg.context;
    if (msg.event === 'willAppear') {
      const state = { context, action: msg.action, settings: defaults, apiKey: null, client: new UniFiClient(), previous: null, timer: null, busy: false, visible: true };
      actions.set(context, state);
      try { applySettings(state, msg.payload?.settings || {}); }
      catch (error) { console.error('Credential-store error:', error.message); }
      void poll(state);
      schedule(state);
    } else if (msg.event === 'didReceiveSettings') {
      const state = actions.get(context);
      if (state) {
        try { applySettings(state, msg.payload?.settings || {}); }
        catch (error) { state.apiKey = null; state.client.configure({ ...state.settings, apiKey: '' }); console.error('Credential-store error:', error.message); }
        if (state.timer) clearTimeout(state.timer);
        state.timer = null;
        void poll(state);
        schedule(state);
      }
    } else if (msg.event === 'willDisappear') {
      const state = actions.get(context);
      if (state) {
        state.visible = false;
        if (state.timer) clearTimeout(state.timer);
        actions.delete(context);
      }
    } else if (msg.event === 'propertyInspectorDidAppear') {
      const state = actions.get(context);
      let settings = state?.settings || defaults;
      let hasCredential = Boolean(state?.apiKey);
      if (!state) {
        try {
          const raw = msg.payload?.settings || {};
          const hydrated = hydrateSettings(raw);
          settings = hydrated.settings;
          hasCredential = Boolean(hydrated.apiKey);
          if (hydrated.migrated) send('setSettings', context, settings);
        } catch (error) { console.error('Credential-store error:', error.message); }
      }
      send('sendToPropertyInspector', context, { event: 'settings', settings: publicSettings(settings, hasCredential) });
    } else if (msg.event === 'sendToPlugin' && msg.payload?.event === 'testConnection') {
      void testConnection(context, msg.payload.settings || {});
    } else if (msg.event === 'sendToPlugin' && msg.payload?.event === 'saveSettings') {
      void saveSettings(context, msg.payload.settings || {});
    } else if (msg.event === 'sendToPlugin' && msg.payload?.event === 'forgetCredential') {
      void forgetCredential(context, msg.payload.settings || {});
    }
  });
  websocket.on('error', err => console.error('Stream Deck connection error:', err.message));
}

async function resolveApiKey(settings) {
  if (typeof settings.apiKey === 'string' && settings.apiKey.trim()) return settings.apiKey.trim();
  const id = settings.credentialId;
  const key = getSecret(id);
  if (!key) throw new Error('No saved API key. Enter a new key and save settings.');
  return key;
}

async function testConnection(context, settings) {
  try {
    const apiKey = await resolveApiKey(settings);
    const client = new UniFiClient({ ...settings, apiKey });
    const sites = await client.getSites();
    send('sendToPropertyInspector', context, { event: 'connectionResult', ok: true, sites });
  } catch (error) {
    send('sendToPropertyInspector', context, { event: 'connectionResult', ok: false, message: error.message });
  }
}

async function saveSettings(context, raw) {
  try {
    const settings = { ...defaults, ...raw };
    const apiKey = await resolveApiKey(settings);
    if (!settings.baseUrl || !settings.site) throw new Error('Console URL and site are required.');
    const credentialId = settings.credentialId || crypto.randomUUID();
    saveSecret(credentialId, apiKey);
    const safe = { baseUrl: String(settings.baseUrl).trim(), site: String(settings.site), intervalSeconds: clampInterval(settings.intervalSeconds), credentialId };
    // Persist only the credential reference, never the API key itself.
    send('setSettings', context, safe);
    const state = actions.get(context);
    if (state) {
      applySettings(state, safe);
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      void poll(state);
      schedule(state);
    }
    send('sendToPropertyInspector', context, { event: 'settingsSaved', ok: true, settings: publicSettings(safe, true) });
  } catch (error) {
    send('sendToPropertyInspector', context, { event: 'settingsSaved', ok: false, message: error.message });
  }
}

async function forgetCredential(context, raw) {
  try {
    deleteSecret(raw.credentialId);
    const safe = { ...defaults, baseUrl: String(raw.baseUrl || ''), site: String(raw.site || ''), intervalSeconds: clampInterval(raw.intervalSeconds), credentialId: '' };
    send('setSettings', context, safe);
    const state = actions.get(context);
    if (state) {
      state.apiKey = null;
      state.settings = safe;
      state.client.configure({ ...safe, apiKey: '' });
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      void poll(state);
      schedule(state);
    }
    send('sendToPropertyInspector', context, { event: 'credentialForgotten', ok: true, settings: publicSettings(safe, false) });
  } catch (error) {
    send('sendToPropertyInspector', context, { event: 'credentialForgotten', ok: false, message: error.message });
  }
}

function schedule(state) {
  if (!state.visible) return;
  state.timer = setTimeout(async () => { await poll(state); schedule(state); }, clampInterval(state.settings.intervalSeconds) * 1000);
}

async function poll(state) {
  if (!state.visible || state.busy) return;
  state.busy = true;
  try {
    if (!state.client.isConfigured()) {
      title(state.context, 'Configure UniFi\nsettings');
      return;
    }
    if (state.action === 'com.comfuzio.unifi.clients') {
      const count = await state.client.getActiveClients();
      title(state.context, `LAN clients\n${count} connected`);
    } else {
      const counters = await state.client.getWanCounters();
      const rates = calculateRates(state.previous, counters);
      state.previous = counters;
      if (!rates) title(state.context, 'UniFi WAN\nSampling…');
      else title(state.context, `↓ ${formatMbps(rates.downloadMbps)} Mbps\n↑ ${formatMbps(rates.uploadMbps)} Mbps`);
    }
  } catch (error) {
    console.error('UniFi polling failed:', error.message);
    title(state.context, state.action === 'com.comfuzio.unifi.bandwidth' ? 'WAN rate\nnot available' : 'UniFi API\ncheck settings');
  } finally { state.busy = false; }
}

global.connectElgatoStreamDeckSocket = connectElgatoStreamDeckSocket;
