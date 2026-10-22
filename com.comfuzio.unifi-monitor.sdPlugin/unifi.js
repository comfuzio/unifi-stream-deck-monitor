'use strict';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;

class UniFiClient {
  constructor(settings = {}) { this.configure(settings); }

  configure(settings = {}) {
    this.baseUrl = String(settings.baseUrl || '').trim().replace(/\/+$/, '');
    this.apiKey = String(settings.apiKey || '').trim();
    this.site = String(settings.site || '').trim();
  }

  isConfigured() {
    try {
      const url = new URL(this.baseUrl);
      return url.protocol === 'https:' && Boolean(this.apiKey);
    } catch { return false; }
  }

  async request(path) {
    if (!this.isConfigured()) throw new Error('Enter the HTTPS console URL and API key in settings');
    if (!path.startsWith('/proxy/network/integration/v1/')) throw new Error('Blocked non-Integration API path');
    const base = new URL(this.baseUrl);
    const url = new URL(path, base);
    if (url.origin !== base.origin || url.protocol !== 'https:') throw new Error('Request URL must match the configured HTTPS console');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: { Accept: 'application/json', 'X-API-KEY': this.apiKey }
      });
      const length = Number(response.headers.get('content-length') || 0);
      if (length > MAX_RESPONSE_BYTES) throw new Error('UniFi response exceeded the size limit');
      if (!response.ok) {
        if (response.status === 401) throw new Error('API key rejected (HTTP 401)');
        if (response.status === 403) throw new Error('API key lacks permission (HTTP 403)');
        throw new Error(`UniFi API returned HTTP ${response.status}`);
      }
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('UniFi response exceeded the size limit');
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('UniFi returned invalid JSON'); }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('UniFi request timed out');
      if (error.cause?.code === 'CERT_HAS_EXPIRED') throw new Error('Console TLS certificate has expired');
      if (error.cause?.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.cause?.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
        throw new Error('Console uses an untrusted certificate. Trust its certificate/CA in the operating system, then retry.');
      }
      if (error.cause?.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
        throw new Error('Console certificate name does not match the URL. Use a hostname listed in the certificate.');
      }
      throw error;
    } finally { clearTimeout(timer); }
  }

  async getSites() {
    const response = await this.request('/proxy/network/integration/v1/sites');
    if (!Array.isArray(response?.data)) throw new Error('Unexpected sites response from UniFi');
    return response.data.map(site => ({ id: String(site.id || ''), name: String(site.name || site.internalReference || site.id || 'Unnamed site') })).filter(site => site.id);
  }

  async getActiveClients() {
    if (!this.site) throw new Error('Test the connection and select a site first');
    const response = await this.request(`/proxy/network/integration/v1/sites/${encodeURIComponent(this.site)}/clients?offset=0&limit=1`);
    if (!Number.isInteger(response?.totalCount) || response.totalCount < 0) throw new Error('Unexpected connected-clients response');
    return response.totalCount;
  }

  async getWanCounters() {
    throw new Error('Real-time WAN counters are not yet verified for this UniFi API version');
  }
}

module.exports = { UniFiClient };
