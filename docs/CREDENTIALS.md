# Credential storage, permissions, and privacy

## What the plugin stores

The UniFi Integration API key is stored using the operating system's native credential store through `@napi-rs/keyring`:

- Windows: Windows Credential Manager.
- macOS: Keychain.

Stream Deck action settings contain a random credential reference, the console HTTPS URL, site ID, and refresh interval. They do **not** contain the API key. The plugin retrieves the key locally when it needs to make a request. The key necessarily exists in the plugin process's memory while it is in use.

The plugin does not require the user's UniFi account password.

## Permissions requested

Create a UniFi Integration API key with the minimum read-only permissions offered by the console that allow:

- listing/discovering sites;
- reading the connected-client list/count.

The WAN-throughput action is still disabled pending verification of a supported live-counter endpoint. Do not grant write, administrator, configuration-management, or client-control permissions for this plugin. If UniFi's permission UI does not let you grant the required read-only scopes separately, review the available scopes carefully before creating a key.

The plugin does not need Windows administrator rights, macOS administrator rights, `sudo`, or a privileged background service. It makes HTTPS GET requests to the console URL you configure. TLS certificate validation remains enabled.

## Windows 11: view or remove the saved key

The easiest option is the plugin's **Forget saved API key** button in the Stream Deck action settings. This removes the credential and clears its reference from that action. Monitoring stops until a key is entered and saved again.

To inspect or remove it manually:

1. Open Start and search for **Credential Manager**.
2. Select **Windows Credentials**.
3. Look for a generic credential associated with `com.comfuzio.unifi-stream-deck-monitor`.
4. Expand the matching entry and choose **Remove**.

The credential account name is an opaque random ID, so use the service name to identify the entry. Do not delete unrelated credentials. If you remove it manually, reopen the plugin settings, enter the API key again, test the connection, and save.

Windows Credential Manager normally protects the credential for the current Windows user. The plugin should not ask for an administrator password each time it starts.

## macOS: view or remove the saved key

The easiest option is **Forget saved API key** in the Stream Deck action settings.

To inspect or remove it manually:

1. Open **Keychain Access** using Spotlight.
2. Search for `com.comfuzio.unifi-stream-deck-monitor`.
3. Find the matching password item and remove it. Its account is an opaque random ID.
4. Reopen the plugin settings, enter the API key again, test the connection, and save.

Keychain access is governed by macOS's per-user Keychain permissions. The first access or a changed/unrecognized plugin build may cause macOS to ask whether Stream Deck/the plugin may access the item. A routine launch should not require an administrator password. If macOS repeatedly prompts on every launch, do not blindly approve every prompt; cancel and investigate the signing/build identity and Keychain access settings. The current development prototype is not yet a signed production distribution, so prompt behavior must be validated on the packaged release.

## Changing, revoking, or resetting a key

- **Replace it:** enter the new key in the API-key field, test the connection, select the site, then save. Leave the field blank to keep the existing key.
- **Revoke it in UniFi:** delete/revoke the API key in UniFi Network's Integrations settings. The plugin will then report an authentication failure. Create a replacement key and save it in the plugin.
- **Reset locally:** use **Forget saved API key**, then enter and save a replacement.
- **If the credential becomes unavailable:** re-enter the key and save. No settings file needs to be edited.

If you configure multiple Stream Deck action instances, each instance may have its own credential reference. Use the forget control in the action you are resetting, and inspect Credential Manager/Keychain Access only if you need to clean up a stale item manually.

## Network traffic and telemetry

The plugin's intended and current monitoring traffic goes directly from the computer running Stream Deck to the HTTPS console URL configured by the user. The source contains no telemetry, analytics, crash-reporting upload, or Comfuzio-hosted service integration. It does not intentionally send the API key, client data, or monitoring results to Comfuzio or another third party.

As with any open-source software, users can inspect the source and build they install. Stream Deck itself and the operating system remain separate software and may have their own network behavior; this plugin does not control those products.

The API key is sent only in the `X-API-KEY` header to the configured UniFi console. TLS verification is enabled and redirects are rejected. Never share your API key in screenshots, logs, or issue reports.
