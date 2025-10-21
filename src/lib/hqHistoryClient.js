import { fetchWithAuth } from '../auth/localAuth.js';
import {
  HQ_HISTORY_KEY,
  HQ_HISTORY_LIMIT,
  getHQHistoryEntries,
  normalizeMST,
} from './store.js';
import { setItem as setSharedItem, waitForSharedWrites } from './storageClient.js';

function normalizeHistoryField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = `${value}`.trim();
  return str;
}

function ensureTimestamp(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function buildHistoryId(entry) {
  const base = normalizeHistoryField(entry?.id);
  if (base) {
    return base;
  }
  const mst = normalizeMST(entry?.mst);
  const field = normalizeHistoryField(entry?.field);
  const type = normalizeHistoryField(entry?.type);
  const timestamp = ensureTimestamp(entry?.timestamp) || new Date().toISOString();
  const from = normalizeHistoryField(entry?.from);
  const to = normalizeHistoryField(entry?.to);
  return `${mst || 'mst'}:${field}:${type}:${timestamp}:${from}:${to}`;
}

export function mergeHqHistoryEntries(existing = [], incoming = [], { limit = HQ_HISTORY_LIMIT } = {}) {
  const byId = new Map();
  const push = (entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const mst = normalizeMST(entry.mst);
    if (!mst) {
      return;
    }
    const timestamp = ensureTimestamp(entry.timestamp) || new Date().toISOString();
    const normalized = {
      id: buildHistoryId(entry),
      mst,
      field: normalizeHistoryField(entry.field) || 'field',
      from: normalizeHistoryField(entry.from),
      to: normalizeHistoryField(entry.to),
      actor: normalizeHistoryField(entry.actor) || 'system',
      timestamp,
      type: normalizeHistoryField(entry.type) || 'update',
    };
    byId.set(normalized.id, normalized);
  };

  for (const entry of existing) {
    push(entry);
  }
  for (const entry of incoming) {
    push(entry);
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  if (!Number.isFinite(limit) || limit <= 0) {
    return merged;
  }
  return merged.slice(0, limit);
}

function normalizeQueryValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(',');
  }
  const str = `${value}`.trim();
  return str;
}

function buildHistoryQuery(params = {}) {
  const query = new URLSearchParams();
  const entries = [
    ['mst', params.mst],
    ['field', params.field],
    ['type', params.type],
    ['actor', params.actor],
    ['from', params.from],
    ['to', params.to],
    ['q', params.q],
  ];
  for (const [key, raw] of entries) {
    const value = normalizeQueryValue(raw);
    if (value) {
      query.set(key, value);
    }
  }
  if (params.limit !== undefined && params.limit !== null) {
    const limit = Number.parseInt(params.limit, 10);
    if (Number.isFinite(limit) && limit > 0) {
      query.set('limit', String(limit));
    }
  }
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export async function fetchHQHistoryEntries(options = {}) {
  const query = buildHistoryQuery(options);
  const response = await fetchWithAuth(`/api/hq/history${query}`, {
    cache: 'no-store',
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  const total = Number.isFinite(payload?.total) ? payload.total : entries.length;
  const limit = Number.isFinite(payload?.limit) ? payload.limit : entries.length;
  return { entries, total, limit };
}

export async function refreshHQHistoryCache(options = {}) {
  try {
    await waitForSharedWrites({ timeoutMs: 1500 });
  } catch (err) {
    console.warn('Không thể chờ đồng bộ dữ liệu trước khi tải lịch sử Đại lý HQ', err);
  }
  const { entries } = await fetchHQHistoryEntries(options);
  const existing = getHQHistoryEntries(HQ_HISTORY_LIMIT);
  const merged = mergeHqHistoryEntries(existing, entries, { limit: HQ_HISTORY_LIMIT });
  try {
    setSharedItem(HQ_HISTORY_KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn('Không thể cập nhật bộ nhớ chia sẻ lịch sử Đại lý HQ', err);
  }
  return merged;
}
