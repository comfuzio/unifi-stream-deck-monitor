'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('credential store wrapper rejects invalid references and empty secrets', () => {
  const store = require('../com.comfuzio.unifi-monitor.sdPlugin/credential-store');
  assert.throws(() => store.getSecret('../bad'), /invalid/);
  assert.throws(() => store.saveSecret('00000000-0000-4000-8000-000000000000', '  '), /non-empty/);
  assert.doesNotThrow(() => store.deleteSecret(''));
});
