'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRates, formatMbps } = require('../com.comfuzio.unifi-monitor.sdPlugin/rates');

test('calculates Mbps from counter deltas and elapsed time', () => {
  const previous = { rxBytes: 1_000_000, txBytes: 2_000_000, sampledAt: 1000 };
  const current = { rxBytes: 2_000_000, txBytes: 2_500_000, sampledAt: 2000 };
  assert.deepEqual(calculateRates(previous, current), { downloadMbps: 8, uploadMbps: 4 });
});

test('first sample, counter reset, or invalid elapsed time returns null', () => {
  assert.equal(calculateRates(null, { rxBytes: 10, txBytes: 10, sampledAt: 1000 }), null);
  assert.equal(calculateRates({ rxBytes: 10, txBytes: 10, sampledAt: 2000 }, { rxBytes: 5, txBytes: 15, sampledAt: 1000 }), null);
  assert.equal(calculateRates({ rxBytes: 10, txBytes: 10, sampledAt: 1000 }, { rxBytes: 5, txBytes: 15, sampledAt: 2000 }), null);
});

test('formats values compactly', () => {
  assert.equal(formatMbps(0), '0.0');
  assert.equal(formatMbps(12.345), '12.3');
});
