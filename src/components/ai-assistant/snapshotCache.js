const SNAPSHOT_CACHE_STORAGE_KEY = 'aiSnapshotCache.v1';
const SNAPSHOT_CACHE_VERSION = 1;
const SNAPSHOT_CACHE_TTL_MS = 5 * 60 * 1000;
const SNAPSHOT_CACHE_MAX_ENTRIES = 6;

function getSnapshotCacheStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage || null;
  } catch {
    return null;
  }
}

export function readLocalSnapshotCache() {
  const storage = getSnapshotCacheStorage();
  if (!storage) {
    return { version: SNAPSHOT_CACHE_VERSION, entries: [] };
  }
  try {
    const raw = storage.getItem(SNAPSHOT_CACHE_STORAGE_KEY);
    if (!raw) {
      return { version: SNAPSHOT_CACHE_VERSION, entries: [] };
    }
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return { version: SNAPSHOT_CACHE_VERSION, entries };
  } catch {
    return { version: SNAPSHOT_CACHE_VERSION, entries: [] };
  }
}

export function writeLocalSnapshotCache(cache) {
  const storage = getSnapshotCacheStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(SNAPSHOT_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // bỏ qua lỗi ghi bộ nhớ phiên
  }
}

export function pruneLocalSnapshotCache(now = Date.now()) {
  const cache = readLocalSnapshotCache();
  const entries = [];
  for (const entry of cache.entries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const key = typeof entry.key === 'string' ? entry.key : '';
    if (!key) {
      continue;
    }
    const cachedAt = Number(entry.cachedAt);
    if (!Number.isFinite(cachedAt)) {
      continue;
    }
    if (SNAPSHOT_CACHE_TTL_MS > 0 && now - cachedAt > SNAPSHOT_CACHE_TTL_MS) {
      continue;
    }
    if (!entry.snapshot || typeof entry.snapshot !== 'object') {
      continue;
    }
    entries.push({ key, cachedAt, snapshot: entry.snapshot });
  }
  entries.sort((a, b) => b.cachedAt - a.cachedAt);
  if (entries.length > SNAPSHOT_CACHE_MAX_ENTRIES) {
    entries.length = SNAPSHOT_CACHE_MAX_ENTRIES;
  }
  if (entries.length !== cache.entries.length) {
    writeLocalSnapshotCache({ version: SNAPSHOT_CACHE_VERSION, entries });
  }
  return { version: SNAPSHOT_CACHE_VERSION, entries };
}

export function getLocalSnapshotCacheEntry(cacheKey, now = Date.now()) {
  if (!cacheKey) {
    return null;
  }
  const cache = pruneLocalSnapshotCache(now);
  const entry = cache.entries.find((item) => item.key === cacheKey);
  if (!entry) {
    return null;
  }
  try {
    return {
      key: entry.key,
      cachedAt: entry.cachedAt,
      snapshot: JSON.parse(JSON.stringify(entry.snapshot)),
    };
  } catch {
    return null;
  }
}

export function storeLocalSnapshotCacheEntry(cacheKey, snapshot, now = Date.now()) {
  if (!cacheKey || !snapshot || typeof snapshot !== 'object') {
    return;
  }
  let serialized = null;
  try {
    serialized = JSON.parse(JSON.stringify(snapshot));
  } catch {
    return;
  }
  const cache = pruneLocalSnapshotCache(now);
  const entries = cache.entries.filter((entry) => entry.key !== cacheKey);
  entries.unshift({ key: cacheKey, cachedAt: now, snapshot: serialized });
  if (entries.length > SNAPSHOT_CACHE_MAX_ENTRIES) {
    entries.length = SNAPSHOT_CACHE_MAX_ENTRIES;
  }
  writeLocalSnapshotCache({ version: SNAPSHOT_CACHE_VERSION, entries });
}

export function buildSnapshotCacheKey(params = {}) {
  const from = typeof params.from === 'string' ? params.from : '';
  const to = typeof params.to === 'string' ? params.to : '';
  return `${from}|${to}`;
}
