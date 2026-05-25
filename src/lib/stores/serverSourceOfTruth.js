// serverSourceOfTruth.js
// Server-as-source-of-truth utilities for cache management

const SERVER_SYNC_KEY = "__server_sync_meta__";
const SYNC_INTERVAL_MS = 30000; // 30 seconds default

/**
 * Get last server sync metadata for a data key
 * @param {string} dataKey - The localStorage key for the data
 * @param {Function} getItem - localStorage getItem function
 * @returns {{lastServerSyncAt: number|null, serverVersion: number|null, etag: string|null}}
 */
export function getServerSyncMeta(dataKey, getItem = defaultGetItem()) {
  const raw = getItem(SERVER_SYNC_KEY);
  if (!raw) return { lastServerSyncAt: null, serverVersion: null, etag: null };

  try {
    const allMeta = JSON.parse(raw);
    return allMeta[dataKey] || { lastServerSyncAt: null, serverVersion: null, etag: null };
  } catch {
    return { lastServerSyncAt: null, serverVersion: null, etag: null };
  }
}

/**
 * Update server sync metadata after successful sync
 * @param {string} dataKey
 * @param {{serverVersion?: number, etag?: string}} meta
 * @param {Function} setItem - localStorage setItem function
 * @param {Function} getItem - localStorage getItem function
 */
export function updateServerSyncMeta(
  dataKey,
  { serverVersion = null, etag = null } = {},
  setItem = defaultSetItem(),
  getItem = defaultGetItem()
) {
  const raw = getItem(SERVER_SYNC_KEY);
  let allMeta = {};

  try {
    if (raw) allMeta = JSON.parse(raw);
  } catch {
    allMeta = {};
  }

  allMeta[dataKey] = {
    lastServerSyncAt: Date.now(),
    serverVersion: serverVersion ?? allMeta[dataKey]?.serverVersion ?? null,
    etag: etag ?? allMeta[dataKey]?.etag ?? null,
  };

  try {
    setItem(SERVER_SYNC_KEY, JSON.stringify(allMeta));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Check if local cache is stale compared to server
 * @param {string} dataKey
 * @param {number} maxAgeMs - Max age before considered stale
 * @param {Function} getItem
 * @returns {boolean} true if cache is stale or missing
 */
export function isCacheStale(dataKey, maxAgeMs = SYNC_INTERVAL_MS, getItem = defaultGetItem()) {
  const meta = getServerSyncMeta(dataKey, getItem);
  if (!meta.lastServerSyncAt) return true;

  return Date.now() - meta.lastServerSyncAt > maxAgeMs;
}

/**
 * Detect conflict between local and server data using version/etag
 * @param {string} dataKey
 * @param {number} localVersion
 * @param {string} localEtag
 * @param {Function} getItem
 * @returns {{hasConflict: boolean, serverVersion: number|null, serverEtag: string|null}}
 */
export function detectConflict(dataKey, localVersion, localEtag, getItem = defaultGetItem()) {
  const meta = getServerSyncMeta(dataKey, getItem);

  if (!meta.lastServerSyncAt) {
    return { hasConflict: false, serverVersion: null, serverEtag: null };
  }

  const hasVersionConflict =
    meta.serverVersion !== null && localVersion !== null && localVersion < meta.serverVersion;

  const hasEtagConflict =
    meta.etag !== null && localEtag !== null && localEtag !== meta.etag;

  return {
    hasConflict: hasVersionConflict || hasEtagConflict,
    serverVersion: meta.serverVersion,
    serverEtag: meta.etag,
  };
}

/**
 * Strategy: Server wins - always use server data on conflict
 * @param {*} localData
 * @param {*} serverData
 * @returns {*} serverData
 */
export function resolveConflictServerWins(localData, serverData) {
  return serverData;
}

/**
 * Strategy: Last write wins based on timestamp
 * @param {*} localData
 * @param {number} localUpdatedAt
 * @param {*} serverData
 * @param {number} serverUpdatedAt
 * @returns {*} whichever is newer
 */
export function resolveConflictLastWriteWins(
  localData,
  localUpdatedAt,
  serverData,
  serverUpdatedAt
) {
  return localUpdatedAt >= serverUpdatedAt ? localData : serverData;
}

/**
 * Clear all server sync metadata
 * @param {Function} setItem
 */
export function clearServerSyncMeta(setItem = defaultSetItem()) {
  try {
    setItem(SERVER_SYNC_KEY, JSON.stringify({}));
  } catch {
    // Ignore
  }
}

// Default implementations (for browser environment)
function defaultGetItem() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage.getItem.bind(window.localStorage);
  }
  return () => null;
}

function defaultSetItem() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage.setItem.bind(window.localStorage);
  }
  return () => {};
}

// Constants
export { SERVER_SYNC_KEY, SYNC_INTERVAL_MS };
