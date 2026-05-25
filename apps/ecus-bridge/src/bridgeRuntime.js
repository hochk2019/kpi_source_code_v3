function normalizeRange({ from, to } = {}) {
  return {
    from: `${from ?? ''}`.trim(),
    to: `${to ?? ''}`.trim(),
  };
}

function normalizeTaxCodeList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => `${value ?? ''}`.trim())
    .filter(Boolean);
}

function normalizeLimit(limit, fallback) {
  const numeric = Number(limit);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }
  const fallbackNumeric = Number(fallback);
  if (Number.isFinite(fallbackNumeric) && fallbackNumeric > 0) {
    return Math.floor(fallbackNumeric);
  }
  return undefined;
}

async function ensureBridgeReady(bridgeService) {
  if (typeof bridgeService?.checkSqlServerHealth !== 'function') {
    return null;
  }
  const health = await bridgeService.checkSqlServerHealth();
  if (health && health.ok === false) {
    const error = new Error(health.message || 'Standalone ECUS bridge is not ready');
    error.health = health;
    throw error;
  }
  return health;
}

async function collectFetchedRows(bridgeService, range, config, options) {
  const rows = [];
  for await (const batch of bridgeService.fetchDeclarations(range, config, options)) {
    if (Array.isArray(batch) && batch.length) {
      rows.push(...batch);
    }
  }
  return rows;
}

export function createStandaloneEcusBridgeRuntime({ bridgeService, apiClient } = {}) {
  if (!bridgeService || typeof bridgeService.fetchDeclarations !== 'function') {
    throw new Error('Standalone ECUS bridge runtime requires bridgeService.fetchDeclarations()');
  }
  if (!apiClient || typeof apiClient.fetchSyncConfig !== 'function') {
    throw new Error('Standalone ECUS bridge runtime requires apiClient.fetchSyncConfig()');
  }

  async function loadRows({ from, to, limit } = {}) {
    const range = normalizeRange({ from, to });
    const config = await apiClient.fetchSyncConfig();
    await ensureBridgeReady(bridgeService);

    const options = {
      limit: normalizeLimit(limit, config?.batchSize),
      includeTaxCodesSet: new Set(normalizeTaxCodeList(config?.includeTaxCodes)),
      excludeTaxCodesSet: new Set(normalizeTaxCodeList(config?.excludeTaxCodes)),
    };

    const rawRows = await collectFetchedRows(bridgeService, range, config, options);
    return { config, rawRows, range, limit: options.limit };
  }

  return {
    async previewSync({ from, to, limit } = {}) {
      const { config, rawRows, range, limit: effectiveLimit } = await loadRows({ from, to, limit });
      return apiClient.previewDeclarations({
        rawRows,
        range,
        limit: effectiveLimit,
        fetchedTotal: rawRows.length,
        config,
      });
    },

    async runSync({ actor = 'bridge-service', reason = 'manual', from, to, limit } = {}) {
      const { config, rawRows, range, limit: effectiveLimit } = await loadRows({ from, to, limit });
      return apiClient.commitDeclarations({
        rawRows,
        range,
        limit: effectiveLimit,
        fetchedTotal: rawRows.length,
        actor,
        reason,
        config,
      });
    },
  };
}
