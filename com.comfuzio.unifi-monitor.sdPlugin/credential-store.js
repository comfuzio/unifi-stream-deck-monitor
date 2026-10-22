'use strict';

const { Entry } = require('@napi-rs/keyring');
const SERVICE = 'com.comfuzio.unifi-stream-deck-monitor';
function entryFor(id) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Saved credential reference is missing or invalid');
  return new Entry(SERVICE, id);
}
function getSecret(id) {
  if (!id) return null;
  const entry = entryFor(id);
  try { return entry.getPassword() || null; }
  catch (error) {
    if (/not found|no entry|could not find|credential.*not found/i.test(String(error.message))) return null;
    throw new Error('The operating-system credential store could not be read. Check its access permissions and try again.');
  }
}
function saveSecret(id, secret) {
  if (typeof secret !== 'string' || !secret.trim()) throw new Error('Enter a non-empty UniFi API key.');
  entryFor(id).setPassword(secret.trim());
}
function deleteSecret(id) {
  if (!id) return;
  const entry = entryFor(id);
  try { entry.deletePassword(); }
  catch (error) {
    if (!/not found|no entry|could not find|credential.*not found/i.test(String(error.message))) throw new Error('The saved credential could not be removed from the operating-system credential store.');
  }
}
module.exports = { getSecret, saveSecret, deleteSecret };
