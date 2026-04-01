import { fetchWithAuth } from '../auth/localAuth.js';
import { SHARED_LIGHT_BOOTSTRAP_MODE } from '../../packages/domain/src/bootstrapStorageKeys.js';
import { createSyncError, normalizeSyncError } from './storageSyncErrors.js';

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



function isAuthErrorResponse(response) {

  return response?.status === 401 || response?.status === 403;

}



async function sendWrite(base, key, value) {

  const payload = value === null || value === undefined ? { value: null } : { value };

  const urlBase = base || '';

  const target = `${urlBase}/api/storage/${encodeURIComponent(key)}`;

  let response;

  try {

    response = await fetchWithAuth(target, {

      method: 'PUT',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(payload),

    });

  } catch (error) {

    throw createSyncError({
      code: 'write_request_failed',
      message: `Không thể gửi dữ liệu đồng bộ: ${error?.message ?? error}`,
      retryable: true,
      hint: 'Kiểm tra mạng/VPN nội bộ rồi thử lại.',
      cause: error,
    });

  }

  if (!response || typeof response.ok !== 'boolean') {

    throw createSyncError({
      code: 'invalid_response',
      message: 'Không nhận được phản hồi hợp lệ từ máy chủ đồng bộ',
      retryable: true,
    });

  }

  if (!response.ok) {

    if (isAuthErrorResponse(response)) {

      throw createSyncError({
        code: 'auth_required',
        status: response.status,
        message: 'Phiên đăng nhập đã hết hạn hoặc không đủ quyền đồng bộ.',
        retryable: false,
        hint: 'Vui lòng đăng nhập lại để tiếp tục đồng bộ.',
      });

    }

    const formatted = formatHttpError(response);
    const isRetryableStatus = response.status === 408 || response.status === 429 || response.status >= 500;

    throw createSyncError({
      code: isRetryableStatus ? 'http_retryable' : 'http_non_retryable',
      status: response.status,
      message: formatted,
      retryable: isRetryableStatus,
      hint: isRetryableStatus ? 'Máy chủ đồng bộ sẽ tự thử lại sau ít giây.' : '',
    });

  }

  return response;

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

  clearSyncErrorState();

  emitSyncStatus();

  return data && typeof data === 'object' ? data : { ok: true };

}



const SHARED_KEYS = new Set([

  'decl_rows_v1',

  'mst_rows_v2',

  'mst_history_v1',

  'decl_history_v1',

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

  'kpi_command_center_pins_v1',

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

let retryDelayMs = RETRY_MIN_MS;

let lastSyncError = null;
let lastSyncErrorCode = null;
let lastSyncErrorHint = '';
let lastSyncErrorRetryable = true;

let nextRetryAt = null;
let lastRollbackInfo = null;



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
    lastErrorCode: lastSyncErrorCode,
    lastErrorHint: lastSyncErrorHint,
    lastErrorRetryable: lastSyncErrorRetryable,

    retryDelayMs,

    nextRetryAt,
    lastRollback: lastRollbackInfo,

  };

}



function emitSyncStatus() {

  pendingSyncSnapshot = createSyncSnapshot();

  scheduleSyncStatusBroadcast();

  return pendingSyncSnapshot;

}



function clearSyncErrorState() {

  lastSyncError = null;
  lastSyncErrorCode = null;
  lastSyncErrorHint = '';
  lastSyncErrorRetryable = true;

}



function setSyncErrorState(error, options = {}) {

  const normalized = normalizeSyncError(error, {
    storageLimitMessage: STORAGE_LIMIT_ERROR_MESSAGE,
    defaultMessage: options.defaultMessage,
  });

  lastSyncError = normalized.message;
  lastSyncErrorCode = normalized.code;
  lastSyncErrorHint = normalized.hint || '';
  lastSyncErrorRetryable = normalized.retryable !== false;

  return normalized;

}



function normalizeBaseUrl(value) {

  if (typeof value !== 'string') {

    return '';

  }

  return value.endsWith('/') ? value.slice(0, -1) : value;

}



function isBrowserRuntime() {

  return typeof window !== 'undefined' && typeof window.location !== 'undefined';

}



function shouldPreferDevProxy(baseUrl) {

  if (!baseUrl || !isBrowserRuntime()) {

    return false;

  }

  if (typeof import.meta === 'undefined' || import.meta.env?.DEV !== true) {

    return false;

  }

  if (!/^https?:\/\//i.test(baseUrl)) {

    return false;

  }

  try {

    return new URL(baseUrl).origin !== window.location.origin;

  } catch {

    return false;

  }

}



function resolveRemoteBaseUrl(baseUrl) {

  const normalized = normalizeBaseUrl(baseUrl ?? '');

  return shouldPreferDevProxy(normalized) ? '' : normalized;

}



function canUseRemoteSync(baseUrl) {

  if (typeof fetch !== 'function') {

    return false;

  }

  if (isBrowserRuntime()) {

    return true;

  }

  return /^https?:\/\//i.test(normalizeBaseUrl(baseUrl ?? ''));

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

  if (!canUseRemoteSync(base)) {

    nextRetryAt = null;

    emitSyncStatus();

    return;

  }

  if (!lastSyncErrorRetryable) {

    nextRetryAt = null;
    emitSyncStatus();
    return;

  }

  nextRetryAt = Date.now() + retryDelayMs;

  emitSyncStatus();

  retryTimer = setTimeout(async () => {

    retryTimer = null;

    nextRetryAt = null;

    emitSyncStatus();

    const ok = await bootstrapFromServer(base);

    if (!ok) {

      retryDelayMs = Math.min(

        Math.max(Math.floor(retryDelayMs * 1.5), RETRY_MIN_MS),

        RETRY_MAX_MS,

      );

      scheduleRetry();

    }

    emitSyncStatus();

  }, retryDelayMs);

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
        lastRollbackInfo = null;
        clearSyncErrorState();

        emitSyncStatus();

      } catch (err) {

        console.error('Không thể đồng bộ dữ liệu lên máy chủ', err);

        const hasNewerPendingValue = pendingWrites.has(key);
        if (!hasNewerPendingValue) {
          pendingWrites.set(key, value);
        }
        lastRollbackInfo = {
          key,
          at: Date.now(),
          restoredPreviousValue: !hasNewerPendingValue,
        };

        remoteEnabled = false;

        const normalized = setSyncErrorState(err, {
          defaultMessage: 'Không thể kết nối backend đồng bộ.',
        });
        if (normalized.retryable) {
          retryDelayMs = Math.min(Math.max(Math.floor(retryDelayMs * 1.5), RETRY_MIN_MS), RETRY_MAX_MS);
        } else {
          retryDelayMs = RETRY_MIN_MS;
        }

        emitSyncStatus();

        if (normalized.retryable) {
          scheduleRetry();
        }

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

  const normalizedBase = resolveRemoteBaseUrl(baseUrl ?? '');

  apiBase = normalizedBase;

  if (!canUseRemoteSync(normalizedBase)) {

    remoteEnabled = false;

    clearSyncErrorState();

    nextRetryAt = null;

    emitSyncStatus();

    return false;

  }

  bootstrapPromise = (async () => {

    try {

      let response;

      try {

        response = await fetchWithAuth(
          `${normalizedBase}/api/bootstrap?mode=${encodeURIComponent(SHARED_LIGHT_BOOTSTRAP_MODE)}`,
          {

            cache: 'no-store',

          }
        );

      } catch (error) {

        throw new Error(`Không thể tải bootstrap đồng bộ: ${error?.message ?? error}`, {

          cause: error instanceof Error ? error : undefined,

        });

      }

      if (!response || typeof response.ok !== 'boolean') {

        throw new Error('Không nhận được phản hồi hợp lệ từ máy chủ đồng bộ');

      }

      if (!response.ok) {

        if (isAuthErrorResponse(response)) {

          remoteEnabled = false;

          clearSyncErrorState();

          emitSyncStatus();

          retryDelayMs = RETRY_MIN_MS;

          return false;

        }

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

      lastRollbackInfo = null;
      clearSyncErrorState();

      emitSyncStatus();

      if (Array.isArray(payload?.deferredKeys) && payload.deferredKeys.length > 0) {

        try {

          await refreshSharedKeys(payload.deferredKeys, { baseUrl: normalizedBase });

        } catch (error) {

          console.warn('Không thể làm mới dữ liệu bootstrap trì hoãn.', error);

          scheduleRetry();

        }

      }

      retryDelayMs = RETRY_MIN_MS;

      return true;

    } catch (err) {

      console.warn('Không thể đồng bộ dữ liệu từ máy chủ, sử dụng dữ liệu cục bộ.', err);

      remoteEnabled = false;

      setSyncErrorState(err, {
        defaultMessage: 'Không thể đồng bộ dữ liệu từ máy chủ, hệ thống sẽ dùng dữ liệu cục bộ.',
      });

      emitSyncStatus();

      return false;

    } finally {

      bootstrapPromise = null;

    }

  })();

  const ok = await bootstrapPromise;

  if (ok) {

    await flushPending();

  } else if (lastSyncError) {

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

  const targets = Array.isArray(keys) && keys.length ? Array.from(new Set(keys)) : Array.from(SHARED_KEYS);

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

  const entries = await Promise.all(
    targets.map(async (key) => {

      const url = `${base}/api/storage/${encodeURIComponent(key)}`;

      let response;

      try {

        response = await fetchWithAuth(url, { method: 'GET' });

      } catch (error) {

        const message = `Không thể tải khóa đồng bộ "${key}": ${error?.message ?? error}`;

        remoteEnabled = false;
        setSyncErrorState(error, { defaultMessage: message });

        emitSyncStatus();

        throw new Error(message, { cause: error instanceof Error ? error : undefined });

      }

      if (!response || typeof response.ok !== 'boolean') {

        const message = 'Không nhận được phản hồi hợp lệ từ máy chủ đồng bộ';

        remoteEnabled = false;
        setSyncErrorState(new Error(message), { defaultMessage: message });

        emitSyncStatus();

        throw new Error(message);

      }

      if (!response.ok) {

        const message = formatHttpError(response);

        remoteEnabled = false;
        setSyncErrorState(createSyncError({
          code: response.status === 413 ? 'payload_too_large' : 'http_non_retryable',
          status: response.status,
          message,
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        }), { defaultMessage: message });

        emitSyncStatus();

        throw new Error(message);

      }

      let payload;

      try {

        payload = await response.json();

      } catch (error) {

        const message = `Không thể phân tích phản hồi JSON cho khóa đồng bộ "${key}"`;

        remoteEnabled = false;
        setSyncErrorState(error, { defaultMessage: message });

        emitSyncStatus();

        throw new Error(message, { cause: error instanceof Error ? error : undefined });

      }

      return [key, payload];

    })
  );

  for (const [key, payload] of entries) {

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

  clearSyncErrorState();

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

  const normalizedBase = resolveRemoteBaseUrl(baseUrl);

  apiBase = normalizedBase;

  if (typeof fetch !== 'function') {

    return false;

  }

  return bootstrapFromServer(normalizedBase);

}



export function clearStorageCache() {

  cache.clear();

}



export function resetStorageClientForTests() {

  if (retryTimer) {

    clearTimeout(retryTimer);

    retryTimer = null;

  }

  cache.clear();

  pendingWrites.clear();

  remoteEnabled = false;

  apiBase = '';

  bootstrapPromise = null;

  flushPromise = null;

  retryDelayMs = RETRY_MIN_MS;

  clearSyncErrorState();

  nextRetryAt = null;
  lastRollbackInfo = null;

  pendingSyncSnapshot = null;

  syncStatusScheduled = false;

  emitSyncStatus();

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

