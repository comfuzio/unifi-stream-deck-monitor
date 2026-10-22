# UniFi API notes

## Verified on the target console

The project owner tested this local Integration API request against a UCG-Fiber running UniFi Network 10.6.106:

- `GET /proxy/network/integration/v1/sites`
- Header: `X-API-KEY: <key>`
- Header: `Accept: application/json`

The console returned HTTP 200 and one site, `Default`, with ID `88f7af54-98f8-306a-a1c7-c9349722b1f6`. The same request without the API-key header returned HTTP 401, as expected. TLS validation also succeeded when the console certificate was supplied explicitly to curl. This proves local API-key authentication and site discovery; it does not prove the WAN throughput endpoint.

## Connected clients

Documented endpoint:

`GET /proxy/network/integration/v1/sites/{siteId}/clients?offset=0&limit=1`

The response is paginated and includes `totalCount`. The current implementation reads `totalCount) to avoid downloading client details just to count clients. The endpoint is read-only.

## WAN throughput

The documented `GET /v1/sites/{siteId}/wans` endpoint returns WAN interface definitions (IDs and names), not a live traffic rate. The Site Manager ISP metrics endpoint reports interval-based metrics (for example, 5-minute data), so it must not be presented as real-time throughput.

The previous prototype guessed that legacy `/proxy/network/api/s/{site}/stat/health` might expose WAN byte counters. That guess is not a verified implementation. The bandwidth action is deliberately disabled until a reliable source of live WAN counters on the target Network version is identified, validated, and covered by fixture-backed tests.

## TLS and onboarding

The owner's console uses a self-signed certificate whose SAN includes `unifi.local`, but not the console IP address. A temporary local curl test worked by supplying the PEM certificate and resolving `unifi.local` to the console IP for that request. This is a diagnostic technique, not an acceptable setup requirement for normal users.

The plugin keeps standard TLS verification enabled and does not offer an insecure bypass. The current prototype requires a certificate trusted by the operating system and a URL whose hostname matches the certificate; a more guided certificate onboarding flow remains to be implemented.

## Credential-storage limitation

The API key is currently entered through the property inspector and persisted with the action's Stream Deck settings. Treat this as a development-stage compromise, not a claim of encrypted secret storage. Before a public release, move the API key to an OS credential store where supported, avoid persisting it in per-action settings, and test the credential lifecycle on Windows and macOS.

Never publish API keys, private keys, or unredacted client data.
