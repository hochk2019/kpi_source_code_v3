// src/lib/crdtTracker.js

// A simple Vector Clock & Last-Write-Wins (LWW) CRDT Tracker for Key-Value sync.
// Track logical time and client ID to perform safe merging of shared-sync data.

const CRDT_STORAGE_KEY = '__sync_crdt_metadata_v1';
let crdtMeta = {};
let localClientId = '';

export function initCrdt(clientId = Math.random().toString(36).slice(2, 8)) {
    localClientId = clientId;
    try {
        const raw = localStorage.getItem(CRDT_STORAGE_KEY);
        if (raw) {
            crdtMeta = JSON.parse(raw);
        }
    } catch (err) {
        crdtMeta = {};
    }
}

function saveCrdtMeta() {
    try {
        localStorage.setItem(CRDT_STORAGE_KEY, JSON.stringify(crdtMeta));
    } catch (e) { }
}

/**
 * Update the vector clock and timestamp for a locally modified key.
 */
export function recordLocalUpdate(key) {
    if (!crdtMeta[key]) {
        crdtMeta[key] = { clock: 0, ts: 0, clientId: localClientId };
    }
    crdtMeta[key].clock += 1;
    crdtMeta[key].ts = Date.now();
    crdtMeta[key].clientId = localClientId;
    saveCrdtMeta();
}

/**
 * When receiving a remote payload, decide whether to overwrite local cache.
 * Returns true if the remote value should WIN. 
 * Returns false if the local value is newer (so we should keep local and re-sync later).
 */
export function resolveRemoteConflict(key, remoteTs) {
    const local = crdtMeta[key];
    if (!local) return true; // No local modifications, remote wins

    const rTs = Number(remoteTs) || 0;
    // If local timestamp is older than the snapshot generated time (remoteTs), 
    // or if local hasn't been updated in 10 minutes, remote wins.
    if (rTs > local.ts || Date.now() - local.ts > 10 * 60 * 1000) {
        // Remote wins
        return true;
    }

    // Local wins (last-write-wins locally)
    return false;
}

/**
 * Returns the CRDT envelope for a write operation, so the server can reflect it if supported.
 */
export function wrapCrdtPayload(value, key) {
    const meta = crdtMeta[key] || { clock: 1, ts: Date.now(), clientId: localClientId };
    return {
        _crdt: meta,
        value: value
    };
}
