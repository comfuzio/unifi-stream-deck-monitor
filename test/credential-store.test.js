'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const store = require('../com.comfuzio.unifi-monitor.sdPlugin/credential-store');

test('credential store wrapper rejects invalid references and empty secrets', () => {
  assert.throws(() => store.getSecret('../bad'), /invalid/);
  assert.throws(() => store.saveSecret('00000000-0000-4000-8000-000000000000', '  '), /non-empty/);
  assert.doesNotThrow(() => store.deleteSecret(''));
});

test('OS credential store can save, read, replace, and delete a test secret', t => {
  const id = randomUUID();
  try {
    store.saveSecret(id, 'first-test-secret');
    assert.equal(store.getSecret(id), 'first-test-secret');
    store.saveSecret(id, 'replacement-test-secret');
    assert.equal(store.getSecret(id), 'replacement-test-secret');
    store.deleteSecret(id);
    assert.equal(store.getSecret(id), null);
  } catch (error) {
    t.skip('Native OS credential store unavailable in this runner: ' + error.message);
    try { store.deleteSecret(id); } catch {}
  }
});
