import { fetchWithAuth } from '@/auth/localAuth.js';

async function sendWrite(base, key, value) {
  const payload = value === null || value === undefined ? { value: null } : { value };
  const urlBase = base || '';
  const target = `${urlBase}/api/storage/${encodeURIComponent(key)}`;
  const response = await fetchWithAuth(target, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

const SHARED_KEYS = new Set([
  'decl_rows_v1',
  'mst_rows_v2',
  'mst_history_v1',
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
let retryDelayMs = RETRY_MIN_MS;
let lastSyncError = null;
let nextRetryAt = null;

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
    retryDelayMs,
    nextRetryAt,
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
        emitSyncStatus();
      } catch (err) {
        console.error('Không thể đồng bộ dữ liệu lên máy chủ', err);
        pendingWrites.set(key, value);
        remoteEnabled = false;
        lastSyncError = err?.message || 'Không thể kết nối backend';
        retryDelayMs = Math.min(Math.max(Math.floor(retryDelayMs * 1.5), RETRY_MIN_MS), RETRY_MAX_MS);
        emitSyncStatus();
        scheduleRetry();
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
      const response = await fetchWithAuth(`${normalizedBase}/api/bootstrap`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      applyRemoteSnapshot(payload?.data);
      remoteEnabled = true;
      lastSyncError = null;
      emitSyncStatus();
      retryDelayMs = RETRY_MIN_MS;
      return true;
    } catch (err) {
      console.warn('Không thể đồng bộ dữ liệu từ máy chủ, sử dụng dữ liệu cục bộ.', err);
      remoteEnabled = false;
      lastSyncError = err?.message || 'Không thể kết nối backend';
      emitSyncStatus();
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
    const response = await fetchWithAuth(url, { method: 'GET' });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      lastSyncError = error.message;
      remoteEnabled = false;
      emitSyncStatus();
      throw error;
    }
    const payload = await response.json();
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
  emitSyncStatus();
  return results;
}

export function getItem(key) {
  return cache.has(key) ? cache.get(key) : null;
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
