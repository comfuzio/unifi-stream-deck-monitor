'use strict';

function calculateRates(previous, current) {
  if (!previous || !current) return null;
  const elapsedSeconds = (current.sampledAt - previous.sampledAt) / 1000;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return null;
  const rxDelta = current.rxBytes - previous.rxBytes;
  const txDelta = current.txBytes - previous.txBytes;
  if (rxDelta < 0 || txDelta < 0) return null;
  return {
    downloadMbps: (rxDelta * 8) / elapsedSeconds / 1_000_000,
    uploadMbps: (txDelta * 8) / elapsedSeconds / 1_000_000
  };
}

function formatMbps(value) {
  if (!Number.isFinite(value) || value < 0) return '--';
  if (value >= 1000) return (value / 1000).toFixed(2) + ' G';
  return value.toFixed(1);
}

module.exports = { calculateRates, formatMbps };
