const DEFAULT_HEALTH_CACHE_MS = 5000;

function toDateValue(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  const date = new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

function toTimestamp(now) {
  return toDateValue(now()).toISOString();
}

function toTimeMs(now) {
  return toDateValue(now()).getTime();
}

function createBusyError(activeOperation) {
  const error = new Error(`ECUS bridge đang bận xử lý ${activeOperation}`);
  error.code = 'bridge_busy';
  error.activeOperation = activeOperation;
  return error;
}

function summarizeError(error, operation) {
  return {
    operation,
    message: error?.message || 'Unknown bridge error',
    code: error?.code || null,
    activeOperation: error?.activeOperation || null,
    health: error?.health || null,
  };
}

export function createStandaloneEcusBridgeHost({
  runtime,
  bridgeService = null,
  now = () => new Date(),
  healthCacheMs = DEFAULT_HEALTH_CACHE_MS,
} = {}) {
  if (!runtime || typeof runtime.previewSync !== 'function') {
    throw new Error('Standalone ECUS bridge host requires runtime.previewSync()');
  }
  if (typeof runtime.runSync !== 'function') {
    throw new Error('Standalone ECUS bridge host requires runtime.runSync()');
  }

  let activeOperation = null;
  let activePromise = null;
  let lastPreviewAt = null;
  let lastPreviewSummary = null;
  let lastRunAt = null;
  let lastRunSummary = null;
  let lastSuccessAt = null;
  let lastFailureAt = null;
  let lastFailure = null;
  let cachedHealth = null;
  let cachedHealthAtMs = 0;

  async function readHealth({ refreshHealth = false } = {}) {
    if (typeof bridgeService?.checkSqlServerHealth !== 'function') {
      return null;
    }

    const cacheWindowMs = Number(healthCacheMs);
    const canUseCache =
      !refreshHealth &&
      Number.isFinite(cacheWindowMs) &&
      cacheWindowMs >= 0 &&
      cachedHealth !== null &&
      toTimeMs(now) - cachedHealthAtMs <= cacheWindowMs;

    if (canUseCache) {
      return cachedHealth;
    }

    try {
      cachedHealth = await bridgeService.checkSqlServerHealth();
    } catch (error) {
      cachedHealth = {
        ok: false,
        state: 'error',
        message: error?.message || 'Không thể kiểm tra trạng thái SQL Server',
      };
    }
    cachedHealthAtMs = toTimeMs(now);
    return cachedHealth;
  }

  async function getStatus({ refreshHealth = false } = {}) {
    const health = await readHealth({ refreshHealth });
    return {
      busy: !!activePromise,
      activeOperation,
      health,
      lastPreviewAt,
      lastPreviewSummary,
      lastRunAt,
      lastRunSummary,
      lastSuccessAt,
      lastFailureAt,
      lastFailure,
    };
  }

  function startOperation(operation, runner) {
    if (activePromise) {
      if (activeOperation === operation) {
        return activePromise;
      }
      return Promise.reject(createBusyError(activeOperation));
    }

    if (operation === 'preview') {
      lastPreviewAt = toTimestamp(now);
    } else if (operation === 'run') {
      lastRunAt = toTimestamp(now);
    }

    activeOperation = operation;
    activePromise = (async () => {
      try {
        const result = await runner();
        if (operation === 'preview') {
          lastPreviewSummary = result ?? null;
        } else if (operation === 'run') {
          lastRunSummary = result ?? null;
        }
        lastSuccessAt = toTimestamp(now);
        lastFailureAt = null;
        lastFailure = null;
        return result;
      } catch (error) {
        lastFailureAt = toTimestamp(now);
        lastFailure = summarizeError(error, operation);
        throw error;
      } finally {
        activeOperation = null;
        activePromise = null;
      }
    })();

    return activePromise;
  }

  return {
    getStatus,
    isBusy() {
      return !!activePromise;
    },
    async waitForIdle() {
      if (!activePromise) {
        return null;
      }
      return activePromise;
    },
    previewSync(options = {}) {
      return startOperation('preview', () => runtime.previewSync(options));
    },
    runSync(options = {}) {
      return startOperation('run', () => runtime.runSync(options));
    },
  };
}
