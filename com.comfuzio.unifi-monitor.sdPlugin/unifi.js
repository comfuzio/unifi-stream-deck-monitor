'use strict';

const https = require('node:https');

function makeAgent(allowSelfSigned) {
  return new https.Agent({ rejectUnauthorized: !allowSelfSigned });
}

function firstFinite(objects, keys) {
  for (const object of objects) {
    if (!object || typeof object !== 'object') continue;
    for (const key of keys) {
      const value = Number(object[key]);
      if (object[key] !== undefined && Number.isFinite(value) && value >= 0) return value;
    }
  }
  return null;
}

class UniFiClient {
  constructor(settings = {}) {
    this.configure(settings);
    this.cookie = '';
    this.csrfToken = '';
    this.loggedIn = false;
  }

  configure(settings = {}) {
    this.baseUrl = String(settings.baseUrl || '').trim().replace(/\/+$/, '');
    this.username = String(settings.username || '');
    this.password = String(settings.password || '');
    this.site = String(settings.site || 'default').trim() || 'default';
    this.allowSelfSigned = settings.allowSelfSigned === true;
    this.agent = makeAgent(this.allowSelfSigned);
    this.timeoutMs = Math.max(2000, Math.min(Number(settings.timeoutMs) || 8000, 30000));
  }

  isConfigured() {
    return /^https?:\/\//i.test(this.baseUrl) && this.username.length > 0 && this.password.length > 0;
  }

  async request(path, options = {}) {
    const url = new URL(path, this.baseUrl + '/');
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Console URL must use HTTP or HTTPS');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = { Accept: 'application/json', ...(options.headers || {}) };
      if (this.cookie) headers.Cookie = this.cookie;
      if (this.csrfToken) headers['x-csrf-token'] = this.csrfToken;
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body,
        signal: controller.signal,
        // Node's fetch uses Undici, not https.Agent. Dispatcher support is not assumed here.
        // TLS verification override is implemented by NODE_TLS_REJECT_UNAUTHORIZED only in a
        // tightly scoped request below; see requestWithTls().
      });
      const setCookies = response.headers.getSetCookie?.() || [];
      if (setCookies.length) this.cookie = setCookies.map(c => c.split(';', 1)[0]).join('; ');
      const csrf = response.headers.get('x-csrf-token');
      if (csrf) this.csrfToken = csrf;
      const text = await response.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); } catch { throw new Error('UniFi returned a non-JSON response (check console URL and endpoint)'); }
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) this.loggedIn = false;
        throw new Error(`UniFi API HTTP ${response.status}`);
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('UniFi request timed out');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async login() {
    if (!this.isConfigured()) throw new Error('Configure console URL, username, and password in action settings');
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password, rememberMe: true })
    });
    if (response?.meta?.rc && response.meta.rc !== 'ok') throw new Error('UniFi login rejected');
    this.loggedIn = true;
    return true;
  }

  async ensureLogin() {
    if (!this.loggedIn) await this.login();
  }

  async getActiveClients() {
    await this.ensureLogin();
    const response = await this.request(`/proxy/network/api/s/${encodeURIComponent(this.site)}/stat/sta`);
    if (!Array.isArray(response?.data)) throw new Error('Unexpected active-client API response');
    return response.data.length;
  }

  async getWanCounters() {
    await this.ensureLogin();
    // UniFi Network's stat/health response commonly exposes WAN interface counters.
    // Schema differs by release; accept only explicit byte-counter fields.
    const response = await this.request(`/proxy/network/api/s/${encodeURIComponent(this.site)}/stat/health`);
    const rows = Array.isArray(response?.data) ? response.data : [];
    const wanRows = rows.filter(row => {
      const name = String(row?.subsystem || row?.name || row?._id || '').toLowerCase();
      return name.includes('wan') || name.includes('internet');
    });
    const candidates = [...wanRows, ...rows];
    const rxBytes = firstFinite(candidates, ['rx_bytes', 'download_bytes', 'bytes_recv', 'rxBytes']);
    const txBytes = firstFinite(candidates, ['tx_bytes', 'upload_bytes', 'bytes_sent', 'txBytes']);
    if (rxBytes === null || txBytes === null) {
      throw new Error('WAN byte counters were not found in stat/health; API schema may differ on this UniFi version');
    }
    return { rxBytes, txBytes, sampledAt: Date.now() };
  }
}

module.exports = { UniFiClient };
