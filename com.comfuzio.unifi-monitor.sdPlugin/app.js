'use strict';

const WebSocket = require('ws');
const { UniFiClient } = require('./unifi');
const { calculateRates, formatMbps } = require('./rates');

let websocket;
let pluginUUID;
const actions = new Map();
const defaults = { baseUrl: 'https://192.168.50.1', username: '', password: '', site: 'default', intervalSeconds: 3, allowSelfSigned: false };
const clampInterval = value => Math.max(2, Math.min(30, Number(value) || 3));

function send(event, context, payload = {}) {
  if (websocket?.readyState === WebSocket.OPEN) websocket.send(JSON.stringify({ event, context, payload }));
}
function title(context, text) { send('setTitle', context, { title: text, target: 0 }); }
function status(context, message) { title(context, message); }

function connectElgatoStreamDeckSocket(port, uuid, registerEvent, info, actionInfo) {
  pluginUUID = uuid;
  websocket = new WebSocket(`ws://127.0.0.1:${port}`);
  websocket.on('open', () => send(registerEvent, pluginUUID));
  websocket.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const context = msg.context;
    if (msg.event === 'willAppear') {
      const settings = { ...defaults, ...(msg.payload?.settings || {}) };
      const state = { context, action: msg.action, settings, client: new UniFiClient(settings), previous: null, timer: null, busy: false, visible: true };
      actions.set(context, state);
      void poll(state);
      schedule(state);
    } else if (msg.event === 'didReceiveSettings') {
      const state = actions.get(context);
      if (state) {
        state.settings = { ...defaults, ...(msg.payload?.settings || {}) };
        state.client.configure(state.settings);
        state.client.loggedIn = false;
        state.previous = null;
        if (state.timer) clearTimeout(state.timer);
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
      send('sendToPropertyInspector', context, { event: 'settings', settings: state?.settings || defaults });
    }
  });
  websocket.on('error', err => console.error('Stream Deck WebSocket error:', err.message));
}

function schedule(state) {
  if (!state.visible) return;
  state.timer = setTimeout(async () => {
    await poll(state);
    schedule(state);
  }, clampInterval(state.settings.intervalSeconds) * 1000);
}

async function poll(state) {
  if (!state.visible || state.busy) return;
  state.busy = true;
  try {
    if (!state.client.isConfigured()) {
      status(state.context, 'Set UniFi settings');
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
    status(state.context, error.message.length > 34 ? 'UniFi API error\nCheck logs/settings' : error.message);
  } finally {
    state.busy = false;
  }
}

global.connectElgatoStreamDeckSocket = connectElgatoStreamDeckSocket;
