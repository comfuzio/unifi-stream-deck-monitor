# UniFi API notes

The plugin currently uses the local UniFi OS login endpoint and legacy Network API routes:

- `POST /api/auth/login`
- `GET /proxy/network/api/s/{site}/stat/sta` for active stations
- `GET /proxy/network/api/s/{site}/stat/health` as an initial candidate source for WAN byte counters

The active-station endpoint is a commonly used legacy Network API route. WAN byte counters are less consistent across UniFi OS / Network releases and gateway models. In particular, `stat/health` may not expose interface byte counters on a given version. The code deliberately reports an API/schema error rather than silently treating cumulative totals as rates.

For UCG-Fiber validation, capture a redacted response from your own console for the WAN interface/traffic endpoint available in your Network version. Remove cookies, tokens, usernames, public IPs, MAC addresses, hostnames, and other identifying data before sharing. Do not publish credentials or an unredacted API dump.

The current implementation uses a local console URL and does not send telemetry to an external service. The optional self-signed certificate setting disables TLS verification for this plugin's API connection; enable it only on a trusted private management network.
