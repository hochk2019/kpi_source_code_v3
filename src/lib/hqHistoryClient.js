import { fetchWithAuth } from '@/auth/localAuth.js';
import { HQ_HISTORY_KEY } from './store.js';
import { setItem as setSharedItem } from './storageClient.js';

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
  const { entries } = await fetchHQHistoryEntries(options);
  try {
    setSharedItem(HQ_HISTORY_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('Không thể cập nhật bộ nhớ chia sẻ lịch sử Đại lý HQ', err);
  }
  return entries;
}
