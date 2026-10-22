# UniFi API notes

## Verified on the target console

The project owner tested this local Integration API request against a UCG-Fiber running UniFi Network 10.6.106:

- `GET /proxy/network/integration/v1/sites`
- Header: `X-API-KEY: <key>`
- Header: `Accept: application/json`

The console returned HTTP 200 and one site, `Default`, with ID `88f7af54-98f8-306a-a1c7-c9349722b1f6`. The same request without the API-key header returned HTTP 401, as expected. TLS validation also succeeded when the console certificate was supplied explicitly to curl. This proves local API-key authentication and site discovery; it does not prove any live traffic endpoint.

## Connected clients and user-defined targets

Documented endpoint:

`GET /proxy/network/integration/v1/sites/{siteId}/clients?offset=0&limit=1`

The response is paginated and includes `totalCount`. The current implementation reads `totalCount` to avoid downloading client details just to count clients.

The documented client-list and client-detail endpoints expose connected-client records. Client details include fields such as client ID, name, IP address, MAC address, connection type, connection time, and uplink device ID. This is a reasonable foundation for a future device picker and for matching a configured MAC/IP target against currently connected clients.

Important limitations:

- The API documentation does not describe a per-client live traffic-statistics endpoint in the client section.
- A client-list result is not proof of an IP conflict.
- IP and MAC selectors should remain distinct. IPs can change; MAC/client identifiers are generally better identity keys when available.
- Subnet/CIDR matching can only classify records whose IP address is present; it does not independently discover every device on a layer-2 network.

## Device statistics: promising, but not yet proven for WAN throughput

The supplied UniFi Network API 10.6.106 documentation lists:

`GET /v1/sites/{siteId}/devices/{deviceId}/statistics/latest`

Its documented response includes device health metrics and an `uplink` object with `txRateBps` and `rxRateBps`. This is a documented real-time-rate source for an adopted UniFi device's uplink statistics.

Before using it for a WAN-speed key, verify on the target UCG-Fiber that:
1. The gateway appears in the adopted-device list and has a usable device ID.
2. The returned uplink rate represents the desired traffic direction and interface.
3. The values update at a useful cadence and have consistent units/semantics on the supported Network version.

Until these checks are made on a real console, do not label this as verified WAN throughput. Even if suitable for gateway uplink rates, this endpoint describes adopted UniFi devices; it does not establish per-client traffic attribution.

## Firewall blocks and security events

The supplied API documentation describes firewall policy configuration, including a `loggingEnabled` property that causes matching traffic to generate syslog entries sent to a remote syslog server. That is a configuration capability, not an API endpoint for reading a history of blocked connections.

The supplied API reference did not identify a documented read endpoint for firewall-block event history or IP-conflict events. These features need a separate source investigation, potentially including a supported local event/log endpoint or an explicitly configured syslog receiver. We must not silently change firewall configuration or enable logging as part of a read-only monitoring plugin.

## WAN interface definitions versus traffic metrics

The documented `GET /v1/sites/{siteId}/wans` endpoint returns WAN interface definitions, including identifiers and names. It does not itself document live traffic rates. The Site Manager ISP metrics endpoint reports interval-based metrics (for example, five-minute data), so it must not be presented as instantaneous throughput.

The previous prototype guessed that legacy `/proxy/network/api/s/{site}/stat/health` might expose WAN byte counters. That guess is not a verified implementation.

## Current API capability assessment

| Capability | Evidence in supplied Network API 10.6.106 documentation | Current conclusion |
|---|---|---|
| Discover sites | `GET /v1/sites` | Documented; tested successfully on target console |
| Connected-client count | `GET /v1/sites/{siteId}/clients` with `totalCount` | Documented; existing implementation uses it |
| Client identity (IP/MAC/name) | Client list/detail endpoints | Documented; suitable basis for a future target picker |
| Adopted UniFi device state/details | `GET /v1/sites/{siteId}/devices` and device detail | Documented; can support future device-health checks after live validation |
| Adopted device uplink rate | `GET /v1/sites/{siteId}/devices/{deviceId}/statistics/latest` | Documented; promising, but gateway/interface meaning must be validated on target hardware |
| Per-client traffic rate/volume | No such endpoint identified in the supplied client section | Not established |
| Firewall-block history | Firewall policy can emit syslog when logging is enabled; no read-history endpoint identified | Requires separate source/integration research |
| IP-conflict events | No documented event endpoint identified | Requires separate source/integration research |
| WAN interface definitions | `GET /v1/sites/{siteId}/wans` | Documented; not a live-rate endpoint |

## TLS and onboarding

The owner's console uses a self-signed certificate whose SAN includes `unifi.local`, but not the console IP address. A temporary local curl test worked by supplying the PEM certificate and resolving `unifi.local` to the console IP for that request. This is a diagnostic technique, not an acceptable setup requirement for normal users.

The plugin keeps standard TLS verification enabled and does not offer an insecure bypass. The current prototype requires a certificate trusted by the operating system and a URL whose hostname matches the certificate; a more guided certificate onboarding flow remains to be implemented.

## Credential storage and remaining validation

The current implementation uses `@napi-rs/keyring` to store API keys in Windows Credential Manager or macOS Keychain. Action settings persist only a random credential reference, not the key. A migration path moves a key left by the earlier development prototype into the OS store and overwrites the action settings without the secret.

This code path has unit-level CI coverage, but platform-specific credential behavior must still be tested on Windows 11 and macOS with the actual Stream Deck runtime and packaged plugin. In particular, confirm Keychain prompts do not recur on each launch after the plugin is signed and distributed. The plugin should not require administrator privileges.

The property inspector supports replacing a saved key and forgetting it. See [Credential storage, permissions, and privacy](CREDENTIALS.md) for user instructions and manual recovery steps.

Never publish API keys, private keys, or unredacted client data.
