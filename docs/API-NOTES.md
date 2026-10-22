# UniFi API notes

## Verified on the target console

The project owner tested this local Integration API request against a UCG-Fiber running UniFi Network 10.6.106:

- `GET /proxy/network/integration/v1/sites`
- Header: `X-API-KEY: <key>`
- Header: `Accept: application/json`

The console returned HTTP 200 and one site, `Default`, with ID `88f7af54-98f8-306a-a1c7-c9349722b1f6`. The same request without the API-key header returned HTTP 401, as expected. TLS validation also succeeded when the console certificate was supplied explicitly to curl. This proves local API-key authentication and site discovery; it does not prove the WAN throughput endpoint.

## Connected clients

Documented endpoint:

`GET /proxy/network/integration/v1/sites/{siteId}/clients?offset=0&limit=200`

The response is paginated and includes `totalCount`. The client count should use pagination metadata where supported rather than assuming the first page contains all clients. This endpoint is read-only.

## WAN throughput

The documented `GET /v1/sites/{siteId}/wans` endpoint returns WAN interface definitions (IDs and names), not a live traffic rate. The Site Manager ISP metrics endpoint reports interval-based metrics (for example, 5-minute data), so it must not be presented as real-time throughput.

The previous prototype guessed that legacy `/proxy/network/api/s/{site}/stat/health` might expose WAN byte counters. That guess is not a verified implementation and must not be used as the basis for a release. Identify a reliable local source of live WAN counters on the target Network version, validate its schema, and add fixture-backed tests before enabling the bandwidth action.

## TLS and onboarding

The owner's console uses a self-signed certificate whose SAN includes `unifi.local`, but not the console IP address. A temporary local curl test worked by supplying the PEM certificate and resolving `unifi.local` to the console IP for that request. This is a diagnostic technique, not an acceptable setup requirement for normal users.

The release flow should keep TLS verification enabled and offer an understandable certificate setup. Do not add an option that globally disables certificate validation. Never ask users to publish API keys, PEM private keys, or unredacted client data.
