import { fetchWithAuth } from '../auth/localAuth.js';

export const STORAGE_LIMIT_ERROR_MESSAGE =
  'Dung lượng dữ liệu vượt quá giới hạn máy chủ đồng bộ. Vui lòng chia nhỏ dữ liệu hoặc liên hệ quản trị viên để nâng giới hạn.';



function formatHttpError(response) {

  if (!response || typeof response.status !== 'number') {

    return 'Phản hồi HTTP không hợp lệ';

  }

  if (response.status === 413) {

    return STORAGE_LIMIT_ERROR_MESSAGE;

  }

  const statusText =

    typeof response.statusText === 'string' && response.statusText.trim()

      ? response.statusText.trim()

      : '';

  return statusText ? `HTTP ${response.status} ${statusText}` : `HTTP ${response.status}`;

}



const WRITE_RETRY_MAX_ATTEMPTS = 3;

const WRITE_RETRY_BASE_DELAY_MS = 1000;

const WRITE_RETRY_BACKOFF = 2;

const WRITE_RETRY_MAX_DELAY_MS = 8000;



function waitForRetry(ms) {

  if (!Number.isFinite(ms) || ms <= 0) {

    return Promise.resolve();

  }

  return new Promise((resolve) => {

    setTimeout(resolve, ms);

  });

}



function formatWriteKeyLabel(key) {

  return typeof key === 'string' && key ? `khóa "${key}"` : 'dữ liệu';

}



function describeSendWriteError(error, response) {

  if (error?.code === 'network') {

    const raw = typeof error?.message === 'string' && error.message

      ? error.message.replace(/^Không thể gửi dữ liệu đồng bộ:\s*/u, '')

      : 'Không thể kết nối máy chủ đồng bộ';

    return { detail: `Không thể kết nối máy chủ đồng bộ${raw ? ` (${raw})` : ''}`, code: 'network' };

  }

  if (error?.code === 'invalid-response') {

    return { detail: 'Máy chủ đồng bộ trả về dữ liệu không hợp lệ.', code: 'invalid-response' };

  }

  if (error?.code === 'http') {

    const status = Number.isFinite(error?.status) ? error.status : response?.status;

    const formatted = formatHttpError(response || error);

    if (status === 413) {

      return { detail: STORAGE_LIMIT_ERROR_MESSAGE, code: 'http-413' };

    }

    if (status >= 500) {

      return {

        detail: `Máy chủ đồng bộ gặp sự cố (${formatted}).`,

        code: 'http-server',

      };

    }

    if (status >= 400) {

      return {

        detail: `Yêu cầu bị máy chủ từ chối (${formatted}).`,

        code: 'http-client',

      };

    }

    return { detail: formatted, code: 'http' };

  }

  const fallback = typeof error?.message === 'string' && error.message

    ? error.message

    : 'Không rõ lỗi đồng bộ';

  return { detail: fallback, code: error?.code ?? 'unknown' };

}



function buildFriendlyWriteMessage(key, detail, attempts, maxAttempts) {

  const label = formatWriteKeyLabel(key);

  const attemptNote = maxAttempts > 1 ? ` (đã thử ${attempts}/${maxAttempts} lần)` : '';

  return `Không thể đồng bộ ${label} lên máy chủ: ${detail}${attemptNote}. Hệ thống sẽ tự thử lại. Nếu lỗi tiếp diễn, vui lòng kiểm tra kết nối mạng/VPN hoặc liên hệ CNTT.`;

}



function normalizeSyncError(error) {

  if (!error) {

    return { code: 'unknown' };

  }

  if (error?.code === 'http' && Number.isFinite(error?.status)) {

    if (error.status >= 500) {

      error.code = 'http-server';

    } else if (error.status >= 400) {

      error.code = error.status === 413 ? 'http-413' : 'http-client';

    }

  }

  if (!error?.code && error?.name === 'AbortError') {

    error.code = 'network';

  }

  if (!error?.code && error?.message && /Failed to fetch|NetworkError/i.test(error.message)) {

    error.code = 'network';

  }

  if (error?.code === undefined && !(error instanceof Error)) {

    error.code = 'unknown';

  }

  if (!error.code) {

    error.code = 'unknown';

  }

  return error;

}



async function sendWrite(base, key, value, options = {}) {

  const payload = value === null || value === undefined ? { value: null } : { value };

  const urlBase = base || '';

  const target = `${urlBase}/api/storage/${encodeURIComponent(key)}`;

  const maxAttempts = Number.isFinite(options?.maxAttempts)

    ? Math.max(1, Math.floor(options.maxAttempts))

    : WRITE_RETRY_MAX_ATTEMPTS;

  const baseDelay = Number.isFinite(options?.baseDelayMs) && options.baseDelayMs > 0

    ? options.baseDelayMs

    : WRITE_RETRY_BASE_DELAY_MS;

  const backoff = Number.isFinite(options?.backoff)

    ? Math.max(1, options.backoff)

    : WRITE_RETRY_BACKOFF;

  const attemptHistory = [];

  let attempt = 0;

  let lastError = null;

  while (attempt < maxAttempts) {

    attempt += 1;

    try {
      let response;
      try {
        response = await fetchWithAuth(target, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (networkError) {
        const wrapped = new Error(`Không thể gửi dữ liệu đồng bộ: ${networkError?.message ?? networkError}`);
        wrapped.code = 'network';
        if (networkError instanceof Error) {
          wrapped.cause = networkError;
        }
        throw wrapped;
      }
      if (!response || typeof response.ok !== 'boolean') {

        const invalidError = new Error('Không nhận được phản hồi hợp lệ từ máy chủ đồng bộ');

        invalidError.code = 'invalid-response';

        invalidError.response = response;
        throw invalidError;

      }

      if (!response.ok) {

        const httpError = new Error(formatHttpError(response));

        httpError.code = 'http';

        httpError.status = response.status;

        httpError.response = response;

        throw httpError;

      }

      return response;

    } catch (error) {

      const normalizedError = normalizeSyncError(error);

      if (normalizedError instanceof Error && normalizedError.cause === undefined && lastError instanceof Error) {

        normalizedError.cause = lastError;

      }

      const detail = describeSendWriteError(normalizedError, normalizedError?.response);

      attemptHistory.push({

        attempt,

        code: detail.code,

        message: detail.detail,

      });

      lastError = normalizedError instanceof Error ? normalizedError : new Error(String(normalizedError));

      if (attempt >= maxAttempts) {

        const friendlyMessage = buildFriendlyWriteMessage(key, detail.detail, attempt, maxAttempts);

        const finalError = new Error(friendlyMessage, {

          cause: normalizedError instanceof Error ? normalizedError : undefined,

        });

        finalError.attempts = attempt;

        finalError.maxAttempts = maxAttempts;

        finalError.friendlyMessage = friendlyMessage;

        finalError.history = attemptHistory;

        finalError.code = detail.code;

        finalError.rawError = normalizedError;

        throw finalError;

      }

      const delay = Math.min(

        WRITE_RETRY_MAX_DELAY_MS,

        Math.max(baseDelay, baseDelay * backoff ** (attempt - 1))

      );

      attemptHistory[attemptHistory.length - 1].nextDelayMs = delay;

      await waitForRetry(delay);

    }

  }

  return null;

}



export async function patchDeclRows(updates, options = {}) {

  const list = Array.isArray(updates) ? updates : [];

  if (list.length === 0) {

    return { ok: true, updated: 0 };

  }

  const base =

    normalizeBaseUrl(

      options.baseUrl ??

        options.apiBase ??

        apiBase ??

        (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE : '') ??

        ''

    ) || '';

  const target = `${base}/api/storage/${encodeURIComponent('decl_rows_v1')}`;

  const payload = {

    updates: list,

  };

  if (options && typeof options.actor === 'string') {

    payload.actor = options.actor;

  }

  if (options && typeof options.detail === 'string') {

    payload.detail = options.detail;

  }

  let response;

  try {

    response = await fetchWithAuth(target, {

      method: 'PATCH',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(payload),

    });

  } catch (error) {

    throw new Error(`Không thể gửi bản vá dữ liệu: ${error?.message ?? error}`, {

      cause: error instanceof Error ? error : undefined,

    });

  }

  if (!response || typeof response.ok !== 'boolean') {

    throw new Error('Không nhận được phản hồi hợp lệ từ máy chủ đồng bộ');

  }

  if (!response.ok) {

    throw new Error(formatHttpError(response));

  }

  let data = null;

  try {

    data = await response.json();

  } catch {

    data = null;

  }

  remoteEnabled = true;

  lastSyncError = null;

  emitSyncStatus();

  return data && typeof data === 'object' ? data : { ok: true };

}



const SHARED_KEYS = new Set([

  'decl_rows_v1',

  'mst_rows_v2',

  'mst_history_v1',

  'decl_history_v1',

  'decl_sync_history_v1',

  'kpi_rules_v2',

  'team_roster_v1',

  'audit_logs_v1',

  'import_logs_v1',

  'hq_agencies_v1',

  'hq_history_v1',

  'kpi_users_v1',

  'kpi_adjustments_v1',

  'kpi_adjustment_settings_v1',

  'kpi_report_schedule_v1',

  'ui_layout_config_v1',

]);



const cache = new Map();

const listeners = new Map();

const syncListeners = new Set();

let remoteEnabled = false;

let apiBase = '';

let bootstrapPromise = null;

const pendingWrites = new Map();

let flushPromise = null;

let retryTimer = null;

const RETRY_MIN_MS = 5000;

const RETRY_MAX_MS = 60000;

const SYNC_ERROR_LOG_LIMIT = 10;

let retryDelayMs = RETRY_MIN_MS;

let retryAttempts = 0;

let lastSyncError = null;

let lastErrorKey = null;

let lastErrorAt = null;

let nextRetryAt = null;

const syncErrorLog = [];



function clampRetryDelayMs(value) {

  if (!Number.isFinite(value) || value <= 0) {

    return null;

  }

  const ms = Math.floor(value);

  return Math.min(RETRY_MAX_MS, Math.max(RETRY_MIN_MS, ms));

}



function resolveSyncLogType(code) {

  const normalized = typeof code === 'string' ? code : '';

  if (normalized === 'http-client' || normalized === 'http-413') {

    return 'warning';

  }

  if (normalized === 'network' || normalized === 'http-server' || normalized === 'invalid-response') {

    return 'error';

  }

  return 'error';

}



let pendingSyncSnapshot = null;

let syncStatusScheduled = false;



function scheduleSyncStatusBroadcast() {

  if (syncStatusScheduled) {

    return;

  }

  syncStatusScheduled = true;

  const flush = () => {

    syncStatusScheduled = false;

    const snapshot = pendingSyncSnapshot ?? createSyncSnapshot();

    pendingSyncSnapshot = null;

    for (const listener of syncListeners) {

      try {

        listener(snapshot);

      } catch (err) {

        console.error('Shared storage sync listener error', err);

      }

    }

  };

  if (typeof queueMicrotask === 'function') {

    queueMicrotask(flush);

  } else {

    Promise.resolve().then(flush);

  }

}



function notify(key) {

  const subs = listeners.get(key);

  if (!subs) return;

  for (const fn of subs) {

    try {

      fn(cache.has(key) ? cache.get(key) : null);

    } catch (err) {

      console.error('Shared storage listener error', err);

    }

  }

}



function createSyncSnapshot() {

  return {

    remoteEnabled,

    pendingWrites: pendingWrites.size,

    waitingForBackend: pendingWrites.size > 0 && !remoteEnabled,

    lastError: lastSyncError,

    lastErrorKey,

    lastErrorAt,

    retryDelayMs,

    retryAttempts,

    nextRetryAt,

    errorLog: syncErrorLog.map((entry) => ({ ...entry })),

  };

}



function markSyncRecovered() {
  if (retryAttempts > 0) {

    updateCurrentSyncError({

      type: 'resolved',

      resolvedAt: Date.now(),

      nextRetryAt: null,

    });

  }

  retryAttempts = 0;

  lastErrorKey = null;

  lastErrorAt = null;

  nextRetryAt = null;

}



function computeRetryDelayMs(attempt) {

  const safeAttempt = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;

  const delay = RETRY_MIN_MS * 2 ** (safeAttempt - 1);

  return Math.min(RETRY_MAX_MS, Math.max(RETRY_MIN_MS, delay));

}



function normalizeIsoTimestamp(value) {

  if (typeof value === 'string' && value) {

    return value;

  }

  if (Number.isFinite(value)) {

    try {

      return new Date(value).toISOString();

    } catch {

      return new Date().toISOString();

    }

  }

  return new Date().toISOString();

}



function appendSyncErrorEntry(entry) {

  const record = {

    id:

      typeof entry?.id === 'string' && entry.id

        ? entry.id

        : `sync-err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,

    type: typeof entry?.type === 'string' ? entry.type : 'error',

    key: typeof entry?.key === 'string' && entry.key ? entry.key : null,

    message: typeof entry?.message === 'string' ? entry.message : '',

    attempts: Number.isFinite(entry?.attempts) ? Math.max(0, Math.floor(entry.attempts)) : 0,

    at: normalizeIsoTimestamp(entry?.at),

    nextRetryAt: entry?.nextRetryAt ? normalizeIsoTimestamp(entry.nextRetryAt) : null,

  };

  if (entry?.resolvedAt) {

    record.resolvedAt = normalizeIsoTimestamp(entry.resolvedAt);

  }

  syncErrorLog.unshift(record);

  if (syncErrorLog.length > SYNC_ERROR_LOG_LIMIT) {

    syncErrorLog.length = SYNC_ERROR_LOG_LIMIT;

  }

  return record;

}



function updateCurrentSyncError(patch = {}) {
  const current = syncErrorLog[0];

  if (!current) {

    return null;

  }

  if (typeof patch.type === 'string') {

    current.type = patch.type;

  }

  if (typeof patch.message === 'string' && patch.message) {

    current.message = patch.message;

  }

  if (Number.isFinite(patch.attempts)) {

    current.attempts = Math.max(0, Math.floor(patch.attempts));

  }

  if (patch.nextRetryAt !== undefined) {

    current.nextRetryAt =

      patch.nextRetryAt === null ? null : normalizeIsoTimestamp(patch.nextRetryAt);

  }

  if (patch.resolvedAt) {

    current.resolvedAt = normalizeIsoTimestamp(patch.resolvedAt);

  }

  return current;

}



function recordSyncFailure({

  key,

  message,

  code,

  attemptsOverride,

  retryDelayOverride,

  scheduleRetry: shouldScheduleRetry = true,

}) {

  const normalizedMessage =

    typeof message === 'string' && message.trim()

      ? message.trim()

      : 'Không thể kết nối backend';

  remoteEnabled = false;

  lastSyncError = normalizedMessage;

  lastErrorKey = typeof key === 'string' && key ? key : null;

  const now = Date.now();

  lastErrorAt = now;

  const attempts = Number.isFinite(attemptsOverride) && attemptsOverride > 0

    ? Math.max(1, Math.floor(attemptsOverride))

    : retryAttempts > 0

      ? retryAttempts + 1

      : 1;

  retryAttempts = attempts;

  const delayOverride = clampRetryDelayMs(retryDelayOverride);

  const delay = shouldScheduleRetry

    ? delayOverride ?? computeRetryDelayMs(attempts)

    : null;

  if (shouldScheduleRetry && delay !== null) {

    retryDelayMs = delay;

    nextRetryAt = now + delay;

  } else if (!shouldScheduleRetry) {

    nextRetryAt = null;

  }

  const logType = resolveSyncLogType(code);

  const nextRetryAtValue = shouldScheduleRetry && delay !== null ? now + delay : null;

  const current = syncErrorLog[0];

  if (current && current.key === lastErrorKey) {

    updateCurrentSyncError({

      type: logType,

      message: normalizedMessage,

      attempts,

      nextRetryAt: nextRetryAtValue,

    });

  } else {

    appendSyncErrorEntry({

      key: lastErrorKey,

      message: normalizedMessage,

      attempts,

      at: now,

      nextRetryAt: nextRetryAtValue,

      type: logType,

    });

  }

  emitSyncStatus();

  if (shouldScheduleRetry) {

    scheduleRetry();

  }

  return {

    attempts,

    delay: delay ?? null,

    nextRetryAt: nextRetryAtValue,

    message: normalizedMessage,

  };

}



function emitSyncStatus() {

  pendingSyncSnapshot = createSyncSnapshot();

  scheduleSyncStatusBroadcast();

  return pendingSyncSnapshot;

}



function normalizeBaseUrl(value) {

  if (typeof value !== 'string') {

    return '';

  }

  return value.endsWith('/') ? value.slice(0, -1) : value;

}



function applyRemoteSnapshot(data) {

  const entries = data && typeof data === 'object' ? Object.entries(data) : [];

  for (const [key, value] of entries) {

    if (value === null || value === undefined) {

      cache.delete(key);

    } else if (typeof value === 'string') {

      cache.set(key, value);

    } else {

      const stringValue = JSON.stringify(value);

      cache.set(key, stringValue);

    }

    notify(key);

  }

}



function scheduleRetry() {

  if (retryTimer || typeof fetch !== 'function') {

    return;

  }

  const base = typeof apiBase === 'string' ? apiBase : '';

  const delay = Math.max(RETRY_MIN_MS, retryDelayMs || RETRY_MIN_MS);

  nextRetryAt = Date.now() + delay;

  emitSyncStatus();

  retryTimer = setTimeout(async () => {

    retryTimer = null;

    nextRetryAt = null;

    emitSyncStatus();

    const ok = await bootstrapFromServer(base);

    if (!ok) {

      retryAttempts = retryAttempts > 0 ? retryAttempts + 1 : 1;

      retryDelayMs = computeRetryDelayMs(retryAttempts);

      const now = Date.now();

      const retryAtTs = now + retryDelayMs;

      lastErrorAt = now;

      const updated = updateCurrentSyncError({ attempts: retryAttempts, nextRetryAt: retryAtTs });

      if (!updated) {

        appendSyncErrorEntry({

          key: lastErrorKey,

          message: lastSyncError || 'Không thể kết nối backend',

          attempts: retryAttempts,

          at: lastErrorAt,

          nextRetryAt: retryAtTs,

        });

      }

      nextRetryAt = retryAtTs;

      emitSyncStatus();

      scheduleRetry();

      return;

    }

    emitSyncStatus();

  }, delay);

}





async function flushPending() {

  if (flushPromise || pendingWrites.size === 0 || typeof fetch !== 'function') {

    return flushPromise;

  }

  flushPromise = (async () => {

    while (pendingWrites.size > 0) {

      if (!remoteEnabled) {

        break;

      }

      const iterator = pendingWrites.entries().next();

      if (iterator.done) {

        break;

      }

      const [key, value] = iterator.value;

      pendingWrites.delete(key);

      try {

        const base = typeof apiBase === 'string' ? apiBase : '';

        await sendWrite(base, key, value);

        emitSyncStatus();

      } catch (err) {

        console.error('Không thể đồng bộ dữ liệu lên máy chủ', err);

        pendingWrites.set(key, value);

        const normalizedError = normalizeSyncError(err);

        const keyLabel = typeof key === 'string' && key ? `"${key}"` : '';

        const rawMessage = normalizedError?.message || 'Không thể kết nối backend';

        const preferredMessage =

          typeof normalizedError?.friendlyMessage === 'string' && normalizedError.friendlyMessage

            ? normalizedError.friendlyMessage

            : null;

        const friendlyMessage = preferredMessage

          || (keyLabel

            ? `Không thể đồng bộ khóa ${keyLabel} lên máy chủ: ${rawMessage}. Hệ thống sẽ tự thử lại.`

            : `Không thể đồng bộ dữ liệu lên máy chủ: ${rawMessage}. Hệ thống sẽ tự thử lại.`);

        const attemptsOverride =

          Number.isFinite(normalizedError?.attempts) && normalizedError.attempts > 0

            ? Math.max(1, Math.floor(normalizedError.attempts))

            : undefined;

        const retryDelayOverride = Array.isArray(normalizedError?.history) && normalizedError.history.length

          ? normalizedError.history[normalizedError.history.length - 1]?.nextDelayMs

          : undefined;

        recordSyncFailure({

          key,

          message: friendlyMessage,

          code: normalizedError?.code ?? 'unknown',

          attemptsOverride,

          retryDelayOverride,

        });

        break;

      }

    }

    flushPromise = null;

    emitSyncStatus();

  })();

  return flushPromise;

}



async function bootstrapFromServer(baseUrl) {

  if (bootstrapPromise) {

    return bootstrapPromise;

  }

  if (typeof fetch !== 'function') {

    return false;

  }

  const normalizedBase = normalizeBaseUrl(baseUrl ?? '');

  apiBase = normalizedBase;

  bootstrapPromise = (async () => {

    try {

      let response;

      try {

        response = await fetchWithAuth(`${normalizedBase}/api/bootstrap`, {

          cache: 'no-store',

        });

      } catch (error) {

        throw new Error(`Không thể tải bootstrap đồng bộ: ${error?.message ?? error}`, {

          cause: error instanceof Error ? error : undefined,

        });

      }

      if (!response || typeof response.ok !== 'boolean') {

        throw new Error('Không nhận được phản hồi hợp lệ từ máy chủ đồng bộ');

      }

      if (!response.ok) {

        throw new Error(formatHttpError(response));

      }

      let payload;

      try {

        payload = await response.json();

      } catch (error) {

        throw new Error('Không thể phân tích phản hồi JSON từ máy chủ đồng bộ', {

          cause: error instanceof Error ? error : undefined,

        });

      }

      applyRemoteSnapshot(payload?.data);

      remoteEnabled = true;

      lastSyncError = null;

      markSyncRecovered();

      retryDelayMs = RETRY_MIN_MS;

      emitSyncStatus();

      return true;

    } catch (err) {

      console.warn('Không thể đồng bộ dữ liệu từ máy chủ, sử dụng dữ liệu cục bộ.', err);

      const normalizedError = normalizeSyncError(err);

      const baseMessage = normalizedError?.message

        || (err instanceof Error ? err.message : String(err ?? 'Không thể kết nối backend'));

      const friendlyMessage = `${baseMessage}. Sử dụng dữ liệu cục bộ tạm thời, hệ thống sẽ thử đồng bộ lại.`;

      recordSyncFailure({

        key: '__bootstrap__',

        message: friendlyMessage,

        code: normalizedError?.code ?? 'network',

      });

      return false;

    } finally {

      bootstrapPromise = null;

    }

  })();

  const ok = await bootstrapPromise;

  if (ok) {

    await flushPending();

  } else {

    scheduleRetry();

  }

  return ok;

}



function queueSync(key, value) {

  if (!SHARED_KEYS.has(key) || typeof fetch !== 'function') {

    return;

  }

  pendingWrites.set(key, value === undefined ? null : value);

  emitSyncStatus();

  if (!remoteEnabled) {

    scheduleRetry();

    return;

  }

  flushPending();

}



export async function refreshSharedKeys(keys, options = {}) {

  const targets = Array.isArray(keys) && keys.length ? keys : Array.from(SHARED_KEYS);

  if (!targets.length) {

    return {};

  }

  const base =

    normalizeBaseUrl(

      options.baseUrl ??

        options.apiBase ??

        apiBase ??

        (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE : '') ??

        ''

    ) || '';

  const results = {};

  for (const key of targets) {

    const url = `${base}/api/storage/${encodeURIComponent(key)}`;

    let response;

    try {

      response = await fetchWithAuth(url, { method: 'GET' });

    } catch (error) {

      const normalizedError = normalizeSyncError(error);

      const baseMessage =

        normalizedError?.message

          || (error instanceof Error ? error.message : String(error ?? 'Không rõ lỗi'));

      const friendlyMessage =

        `Không thể tải ${formatWriteKeyLabel(key)} từ máy chủ: ${baseMessage}. Hệ thống sẽ tự thử lại.`;

      recordSyncFailure({

        key,

        message: friendlyMessage,

        code: normalizedError?.code ?? 'network',

      });

      const thrownError = new Error(friendlyMessage, {

        cause: error instanceof Error ? error : undefined,

      });

      if (normalizedError?.code) {

        thrownError.code = normalizedError.code;

      }

      throw thrownError;

    }

    if (!response || typeof response.ok !== 'boolean') {

      const message = 'Không nhận được phản hồi hợp lệ từ máy chủ đồng bộ.';

      const friendlyMessage = `${message} Hệ thống sẽ tự thử lại.`;

      recordSyncFailure({

        key,

        message: friendlyMessage,

        code: 'invalid-response',

      });

      const invalidResponseError = new Error(friendlyMessage);

      invalidResponseError.code = 'invalid-response';

      throw invalidResponseError;

    }

    if (!response.ok) {

      const message = formatHttpError(response);

      const httpError = normalizeSyncError({

        code: 'http',

        status: response.status,

        message,

      });

      const friendlyMessage = `${message}. Hệ thống sẽ tự thử lại.`;

      recordSyncFailure({

        key,

        message: friendlyMessage,

        code: httpError.code,

      });

      const errorToThrow = new Error(friendlyMessage);

      errorToThrow.code = httpError.code;

      errorToThrow.status = response.status;

      throw errorToThrow;

    }

    let payload;

    try {

      payload = await response.json();

    } catch (error) {

      const baseMessage = error instanceof Error ? error.message : String(error ?? 'Không rõ lỗi');

      const friendlyMessage =

        `Không thể phân tích phản hồi JSON cho ${formatWriteKeyLabel(key)}: ${baseMessage}. Hệ thống sẽ tự thử lại.`;

      recordSyncFailure({

        key,

        message: friendlyMessage,

        code: 'invalid-response',

      });

      throw new Error(friendlyMessage, {

        cause: error instanceof Error ? error : undefined,

      });

    }

    const raw = payload?.raw;

    if (raw === null || raw === undefined) {

      cache.delete(key);

    } else if (typeof raw === 'string') {

      cache.set(key, raw);

    } else {

      cache.set(key, JSON.stringify(raw));

    }

    notify(key);

    results[key] = payload?.value ?? null;

  }

  remoteEnabled = true;

  lastSyncError = null;

  markSyncRecovered();

  retryDelayMs = RETRY_MIN_MS;

  emitSyncStatus();

  return results;

}



export function getItem(key) {

  return cache.has(key) ? cache.get(key) : null;

}



export function updateCachedItem(key, value) {

  if (!key) {

    return null;

  }

  if (value === null || value === undefined) {

    cache.delete(key);

    notify(key);

    return null;

  }

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

  cache.set(key, stringValue);

  notify(key);

  return stringValue;

}



export function setItem(key, value) {

  const stringValue = value === null || value === undefined ? null : String(value);

  if (stringValue === null) {

    cache.delete(key);

  } else {

    cache.set(key, stringValue);

  }

  notify(key);

  queueSync(key, stringValue);

  return stringValue;

}



export function removeItem(key) {

  cache.delete(key);

  notify(key);

  queueSync(key, null);

}



export async function waitForSharedWrites(options = {}) {

  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 2000;

  const start = Date.now();

  let backoffMs = 20;

  while (pendingWrites.size > 0) {

    const promise = flushPending();

    if (promise) {

      try {

        await promise;

      } catch (err) {

        console.warn('Không thể hoàn tất đồng bộ dữ liệu chia sẻ', err);

      }

    }

    if (pendingWrites.size === 0) {

      break;

    }

    if (!remoteEnabled) {

      break;

    }

    if (Date.now() - start >= timeoutMs) {

      break;

    }

    await new Promise((resolve) => setTimeout(resolve, backoffMs));

    backoffMs = Math.min(backoffMs * 2, 200);

  }

  return pendingWrites.size === 0;

}



export function subscribe(key, listener) {

  const fn = typeof listener === 'function' ? listener : null;

  if (!fn) return () => {};

  if (!listeners.has(key)) {

    listeners.set(key, new Set());

  }

  listeners.get(key).add(fn);

  return () => {

    const subs = listeners.get(key);

    if (!subs) return;

    subs.delete(fn);

    if (subs.size === 0) {

      listeners.delete(key);

    }

  };

}



export async function initSharedStorage(options = {}) {

  const baseUrl =

    options.baseUrl ??

    options.apiBase ??

    (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE : '') ??

    '';

  const normalizedBase = normalizeBaseUrl(baseUrl);

  apiBase = normalizedBase;

  if (typeof fetch !== 'function') {

    return false;

  }

  return bootstrapFromServer(normalizedBase);

}



export function clearStorageCache() {

  cache.clear();

}



export const sharedStorageKeys = SHARED_KEYS;



export function getSyncStatus() {

  return createSyncSnapshot();

}



export function subscribeSyncStatus(listener) {

  const fn = typeof listener === 'function' ? listener : null;

  if (!fn) {

    return () => {};

  }

  syncListeners.add(fn);

  const emitInitial = () => {

    try {

      fn(createSyncSnapshot());

    } catch (err) {

      console.error('Shared storage sync listener error', err);

    }

  };

  if (typeof queueMicrotask === 'function') {

    queueMicrotask(emitInitial);

  } else {

    Promise.resolve().then(emitInitial);

  }

  return () => {

    syncListeners.delete(fn);

  };

}

