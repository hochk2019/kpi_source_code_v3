import { fetchWithAuth } from '../auth/localAuth.js';
import { SHARED_LIGHT_BOOTSTRAP_MODE } from '../../packages/domain/src/bootstrapStorageKeys.js';

export const STORAGE_LIMIT_ERROR_MESSAGE = 'Dung lượng dữ liệu vượt quá giới hạn máy chủ.';
const SHARED_SYNC_BASE_PATH = '/api/v4/shared-sync';

// Cache for synchronous reads (to quickly render UI on load)
const cache = new Map();
const listeners = new Map();

let apiBase = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE || '' : '';

function normalizeBaseUrl(base) {
  if (!base) return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export function subscribe(key, listener) {
  const fn = typeof listener === 'function' ? listener : null;
  if (!fn) return () => { };
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => {
    const subs = listeners.get(key);
    if (subs) {
      subs.delete(fn);
      if (subs.size === 0) listeners.delete(key);
    }
  };
}

function notify(key) {
  const subs = listeners.get(key);
  if (!subs) return;
  const value = cache.has(key) ? cache.get(key) : null;
  for (const fn of subs) {
    try { fn(value); } catch (err) { console.error('Shared storage listener error', err); }
  }
}

export function getItem(key) {
  return cache.has(key) ? cache.get(key) : null;
}

export function updateCachedItem(key, value) {
  if (!key) return null;
  if (value === null || value === undefined) {
    cache.delete(key);
  } else {
    cache.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  notify(key);
  return getItem(key);
}

// --------------------- Direct API Operations ---------------------

export async function setItem(key, value) {
  const payload = value === null || value === undefined ? { value: null } : { value };
  const target = `${normalizeBaseUrl(apiBase)}${SHARED_SYNC_BASE_PATH}/storage/${encodeURIComponent(key)}`;

  const response = await fetchWithAuth(target, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save ${key}: HTTP ${response.status}`);
  }

  // Success: Update cache instantly
  updateCachedItem(key, value);
  return value;
}

export async function removeItem(key) {
  await setItem(key, null);
}

export async function patchDeclRows(updates, options = {}) {
  const list = Array.isArray(updates) ? updates : [];
  if (list.length === 0) return { ok: true, updated: 0 };

  const target = `${normalizeBaseUrl(apiBase)}${SHARED_SYNC_BASE_PATH}/declarations`;
  const payload = { updates: list };
  if (options?.actor) payload.actor = options.actor;
  if (options?.detail) payload.detail = options.detail;

  const response = await fetchWithAuth(target, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Ghi nhận dữ liệu khai báo thất bại: HTTP ${response.status}`);
  }
  return await response.json();
}

export async function initSharedStorage(options = {}) {
  // Previously triggered background worker loops -> Now just updates api base.
  apiBase = options.baseUrl ?? apiBase;
  return true;
}

export async function refreshSharedKeys(keys) {
  const targets = Array.isArray(keys) ? keys : [keys];
  const results = {};

  await Promise.allSettled(
    targets.map(async (key) => {
      const url = `${normalizeBaseUrl(apiBase)}${SHARED_SYNC_BASE_PATH}/storage/${encodeURIComponent(key)}`;
      const response = await fetchWithAuth(url, { method: 'GET' });
      if (!response.ok) throw new Error('Fetch failed');

      const payload = await response.json();
      const raw = payload?.raw;

      if (raw === null || raw === undefined) {
        updateCachedItem(key, null);
        results[key] = null;
      } else {
        updateCachedItem(key, raw);
        results[key] = payload?.value ?? null;
      }
    })
  );

  return results;
}

// --------------------- Stub Operations ---------------------
// Removed offline queue logic. Keeping empty functions so exports don't break App.js and helpers.
export function clearStorageCache() { cache.clear(); }
export function getSyncStatus() { return { remoteEnabled: true, waitingForBackend: false, queueSize: 0 }; }
export function subscribeSyncStatus() { return () => { }; }
export async function waitForSharedWrites() { return true; }
export function resetStorageClientForTests() { clearStorageCache(); }
export const sharedStorageKeys = new Set([
  'decl_rows_v1', 'mst_rows_v2', 'mst_history_v1', 'decl_history_v1',
  'kpi_rules_v2', 'team_roster_v1', 'audit_logs_v1', 'import_logs_v1',
  'hq_agencies_v1', 'hq_history_v1', 'kpi_users_v1', 'kpi_adjustments_v1',
  'kpi_adjustment_settings_v1', 'kpi_report_schedule_v1', 'kpi_command_center_pins_v1',
  'ui_layout_config_v1'
]);

