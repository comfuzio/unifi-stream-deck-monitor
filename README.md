# UniFi Stream Deck Monitor

An open-source Elgato Stream Deck plugin for monitoring a local UniFi Network console, including the UCG-Fiber.

## What we're building

- **Connected clients:** count clients reported by the documented UniFi Network Integration API.
- **WAN bandwidth:** real-time download/upload throughput. This remains under validation against supported UniFi API data; the plugin must not present historical ISP metrics or guessed counters as live traffic.
- **Friendly setup:** enter the console address and API key, test the connection, and discover/select the site in the settings UI. No PowerShell or manual site-ID lookup should be needed for normal setup.
- **Local-first:** requests go directly to the configured console. No telemetry or third-party cloud service is required.

## Status

**Development prototype — not yet a release-ready install.** The earlier prototype used legacy login/API routes and a TLS option that disabled certificate verification. Those are not acceptable foundations for a security-conscious release. The implementation is being migrated to the official Integration API and a secure, guided setup flow. Do not use this repository version as a production monitoring tool until the API migration and tests are complete.

## Planned first-run experience

1. Add either UniFi action to a Stream Deck key.
2. Enter the local console URL and an API key created in UniFi Network → Integrations.
3. Select **Test connection**. The plugin checks TLS and authentication and gives a useful error if either fails.
4. The plugin discovers available sites; choose one from a list rather than typing an internal ID.
5. Add the bandwidth and client-count keys as needed.

Users should not need to run terminal commands, copy API responses, or manually edit JSON files. A self-signed certificate must be handled explicitly and safely; certificate verification will not be silently disabled.

## Requirements

- Elgato Stream Deck desktop application.
- A UniFi OS console running a compatible UniFi Network API.
- A UniFi Integration API key with the minimum permissions needed for read-only monitoring.
- The computer running Stream Deck must be able to reach the console over HTTPS.

## Security principles

- Use the official UniFi Integration API and API-key authentication; do not ask for the user's UniFi account password.
- Monitoring only: no configuration changes, client actions, or other write endpoints.
- HTTPS certificate validation stays enabled. No `rejectUnauthorized: false`, insecure `-k` equivalent, or unrestricted URL redirects.
- Validate the configured host and restrict requests to expected read-only API paths.
- Bound request duration and response size; avoid logging API keys, certificate contents, or sensitive client data.
- Keep dependencies maintained and test supported Node.js runtimes in CI.

## Development

Use a currently supported Node.js LTS version compatible with the installed Stream Deck desktop runtime. Run:

```sh
npm ci
npm test
npm run check
```

See [API notes](docs/API-NOTES.md) for the verified API surface and remaining implementation work.

MIT licensed. See [LICENSE](LICENSE).
