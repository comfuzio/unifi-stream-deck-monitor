# UniFi Stream Deck Monitor

A local Stream Deck plugin for monitoring UniFi Network on a UniFi Cloud Gateway Fiber (UCG-Fiber).

## Features

- WAN download and upload rates in Mbps, calculated from counter deltas (not cumulative byte totals).
- Connected-client count from UniFi Network's active-client endpoint.
- Independent actions and polling lifecycles for bandwidth and client count.
- Local-only API access; credentials are stored in Stream Deck action settings, not committed to files.
- Configurable console URL, site name, polling interval, and optional self-signed certificate acceptance.

## Status

Early implementation. UniFi OS / Network API endpoints can vary by UniFi OS and Network versions. Validate against your console before relying on the readings. The plugin does not upload data to a third party.

## Requirements

- Elgato Stream Deck desktop app with legacy Node.js plugin support.
- Node.js runtime supplied by Stream Deck.
- UniFi OS console account with read-only access where supported.
- UCG-Fiber reachable from the computer running Stream Deck.

## Install for development

1. Clone this repository.
2. Run `npm install`.
3. Copy or symlink `com.comfuzio.unifi-monitor.sdPlugin` into the Stream Deck plugins directory:
   - Windows: `%APPDATA%\\Elgato\\StreamDeck\\Plugins\\`
   - macOS: `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`
4. Restart Stream Deck and add **UniFi Bandwidth** or **UniFi Clients** to a key.
5. Configure the console URL (for example `https://192.168.50.1`), username, password, and site name in the action's property inspector.

## API and security notes

The plugin calls UniFi OS locally using `/api/auth/login`, then queries Network endpoints through `/proxy/network/api/s/{site}/stat/...`. Endpoints and response fields differ across releases; failures are shown on the key and logged to the plugin console.

For a self-signed certificate, enable **Allow self-signed TLS certificate** only for a trusted, private management network. This disables certificate verification for this plugin's requests and should not be used over untrusted networks. Prefer a trusted certificate when possible.

Use a dedicated local admin account with the minimum privileges available. Never publish credentials in issues, screenshots, logs, or repository files. Passwords are kept in Stream Deck action settings on the local machine; protect the operating-system account accordingly.

## How rates are calculated

The plugin samples WAN byte counters and calculates `(currentBytes - previousBytes) * 8 / elapsedSeconds / 1,000,000`. The first sample establishes a baseline and displays `--`; counter resets or negative deltas reset the baseline. This reports decimal Mbps.

## Development

```sh
npm install
npm test
```

MIT licensed. See [LICENSE](LICENSE).
