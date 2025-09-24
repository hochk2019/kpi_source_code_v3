const SHARED_KEYS = new Set([
  'decl_rows_v1',
  'mst_rows_v2',
  'kpi_rules_v2',
  'team_roster_v1',
  'audit_logs_v1',
  'import_logs_v1',
  'kpi_users_v1',
]);

const cache = new Map();
const listeners = new Map();
let remoteEnabled = false;
let apiBase = '';
let initPromise = null;

function getLocalStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
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

function writeLocal(key, value) {
  const store = getLocalStorage();
  if (!store) return;
  if (value === null || value === undefined) {
    store.removeItem(key);
  } else {
    store.setItem(key, value);
  }
}

function queueSync(key, value) {
  if (!remoteEnabled || !SHARED_KEYS.has(key) || !apiBase) {
    return;
  }
  const payload = value === null || value === undefined ? { value: null } : { value };
  fetch(`${apiBase}/api/storage/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error('Không thể đồng bộ dữ liệu lên máy chủ', err);
  });
}

export function getItem(key) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  const store = getLocalStorage();
  const value = store ? store.getItem(key) : null;
  if (value !== null && value !== undefined) {
    cache.set(key, value);
  }
  return value;
}

export function setItem(key, value) {
  const stringValue = value === null || value === undefined ? null : String(value);
  if (stringValue === null) {
    cache.delete(key);
    writeLocal(key, null);
  } else {
    cache.set(key, stringValue);
    writeLocal(key, stringValue);
  }
  notify(key);
  queueSync(key, stringValue);
  return stringValue;
}

export function removeItem(key) {
  cache.delete(key);
  writeLocal(key, null);
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
  if (initPromise) {
    return initPromise;
  }
  const baseUrl = options.baseUrl ?? options.apiBase ?? (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE : '') ?? '';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  if (typeof fetch !== 'function') {
    return false;
  }

  initPromise = (async () => {
    try {
      const response = await fetch(`${normalizedBase}/api/bootstrap`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) {
          cache.delete(key);
          writeLocal(key, null);
        } else if (typeof value === 'string') {
          cache.set(key, value);
          writeLocal(key, value);
        } else {
          const stringValue = JSON.stringify(value);
          cache.set(key, stringValue);
          writeLocal(key, stringValue);
        }
        notify(key);
      }
      apiBase = normalizedBase || '';
      remoteEnabled = true;
      return true;
    } catch (err) {
      console.warn('Không thể đồng bộ dữ liệu từ máy chủ, sử dụng dữ liệu cục bộ.', err);
      remoteEnabled = false;
      apiBase = normalizedBase || '';
      return false;
    }
  })();

  return initPromise;
}

export function clearStorageCache() {
  cache.clear();
}

export const sharedStorageKeys = SHARED_KEYS;
