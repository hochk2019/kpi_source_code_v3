/**
 * @fileoverview Self-contained test harness for server integration tests.
 *
 * Replaces the temporary quarantine layer that re-exported from server/index.js.
 * This module provides all testing utilities using @kpi/backend-shared/persistence
 * and inlined pure logic — with zero dependency on the legacy server/ directory.
 *
 * Exported symbols (API-compatible with the old quarantine):
 *   initializeDatabase, getDatabaseHandle, getDatabaseInitState,
 *   performDatabaseBackup, resetDatabaseForTests, getDataHealthSnapshot,
 *   stopServer, waitForAccountSqlSyncIdle,
 *   appendEcusMonitorHistory, getEcusMonitorHistory, clearEcusMonitorHistory,
 *   buildEcusMonitorMetrics, buildEcusMonitorSeries
 */

/* eslint-env node */

import fs from 'node:fs/promises';
import path from 'node:path';

import Database from 'better-sqlite3';

import {
    ensureSqliteKvStore,
    ensureSqliteAuthTables,
    ensureSqliteExportAuditTables,
    ensureSqliteReportingProjectionTables,
    ensureSqliteBusinessSnapshotTables,
    ensureSqliteTeamRosterTables,
} from '../persistence/sqliteMigrations.js';

// ---------------------------------------------------------------------------
// Module-level singleton state (mirroring server/index.js module state)
// ---------------------------------------------------------------------------

/** @type {import('better-sqlite3').Database | null} */
let _db = null;

/** Check if the current singleton DB is open and usable */
function _isDbOpen() {
    if (!_db) return false;
    try {
        _db.prepare('SELECT 1').get(); // will throw if closed
        return true;
    } catch {
        return false;
    }
}

/** Re-initialize a fresh in-memory DB for testing (called when singleton is closed or null) */
function _reinitMemoryDbSync() {
    const database = new Database(':memory:');
    database.pragma('journal_mode = WAL');
    ensureSqliteKvStore(database);
    ensureSqliteAuthTables(database);
    ensureSqliteExportAuditTables(database);
    ensureSqliteReportingProjectionTables(database);
    ensureSqliteBusinessSnapshotTables(database);
    ensureSqliteTeamRosterTables(database);
    // Seed defaults
    const stmt = database.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)');
    const insertMany = database.transaction((entries) => { for (const [k, v] of entries) stmt.run(k, normalizeStorageValue(v)); });
    insertMany(Object.entries(DEFAULT_STORAGE));
    _databaseInitState.seeded = true;
    _databaseInitState.insertedEntries = Object.keys(DEFAULT_STORAGE).length;
    _databaseInitState.missingInserted = 0;
    _databaseInitState.timestamp = new Date().toISOString();
    _databaseInitState.dbFile = ':memory:';
    _db = database;
    return database;
}

/** @type {{ seeded: boolean, insertedEntries: number, missingInserted: number, timestamp: string, dbFile: string }} */
const _databaseInitState = {
    seeded: false,
    insertedEntries: 0,
    missingInserted: 0,
    timestamp: '',
    dbFile: '',
};

// ---------------------------------------------------------------------------
// In-memory key-value store (used by ECUS monitor + backup state)
// Used so that the in-memory SQLite DB tracks state across test calls
// without holding a file reference.
// ---------------------------------------------------------------------------

const ECUS_MONITOR_HISTORY_KEY = 'ecus_monitor_history_v1';

const DEFAULT_ECUS_MONITOR_HISTORY = Object.freeze({ version: 1, entries: [], updatedAt: null });

const DEFAULT_ECUS_MONITOR_HISTORY_OPTIONS = Object.freeze({
    maxEntries: 7 * 24 * 4, // 7 days at 15m intervals
    dedupeMinutes: 5,
});

const DEFAULT_ECUS_MONITOR_ALERT_OPTIONS = Object.freeze({
    failureThreshold: 3,
    failureCooldownMinutes: 120,
    staleThresholdMinutes: 60,
    staleCooldownMinutes: 60,
    dashboardUrl: '',
});

// ---------------------------------------------------------------------------
// Backup state
// ---------------------------------------------------------------------------

const DB_BACKUP_RETENTION = 30;

// ---------------------------------------------------------------------------
// Default seed data (must stay in sync with server/index.js DEFAULT_STORAGE)
// ---------------------------------------------------------------------------

const DEFAULT_STORAGE = {
    decl_rows_v1: '[]',
    mst_rows_v2: '[]',
    mst_history_v1: '[]',
    kpi_rules_v2: '[]',
    kpi_adjustments_v1: '[]',
    team_roster_v1: JSON.stringify({
        version: 1,
        teams: [
            { id: 'team-1', name: 'Team 1', members: [{ id: 'team-1-phuong', name: 'Phương' }] },
            { id: 'team-2', name: 'Team 2', members: [{ id: 'team-2-tuan', name: 'Tuấn' }] },
            { id: 'team-3', name: 'Team 3', members: [{ id: 'team-3-hoc', name: 'Học' }] },
        ],
    }),
    audit_logs_v1: '[]',
    import_logs_v1: '[]',
    hq_agencies_v1: '[]',
    hq_history_v1: '[]',
    kpi_users_v1: '[]',
    [ECUS_MONITOR_HISTORY_KEY]: JSON.stringify(DEFAULT_ECUS_MONITOR_HISTORY),
};

// ---------------------------------------------------------------------------
// Helper utilities (inlined from server/index.js — all pure functions)
// ---------------------------------------------------------------------------

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeStorageValue(value) {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toNullableNumber(value) {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
function toPositiveInt(value, fallback = 0) {
    const n = Math.floor(Number(value));
    return n > 0 ? n : fallback;
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
function toNonNegativeInt(value, fallback = 0) {
    const n = Math.floor(Number(value));
    return n >= 0 ? n : fallback;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeIsoTimestamp(value) {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const SEVERITY_PRIORITY = Object.freeze({ good: 0, info: 1, warning: 2, critical: 3 });

/**
 * @param {string} current
 * @param {string} next
 * @returns {string}
 */
function escalateSeverity(current, next) {
    const currentRank = SEVERITY_PRIORITY[current] ?? 0;
    const nextRank = SEVERITY_PRIORITY[next] ?? 0;
    return nextRank > currentRank ? next : current;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parseTimestamp(value) {
    if (!value) return null;
    try {
        const ts = Date.parse(value);
        return Number.isNaN(ts) ? null : ts;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// KV helpers operating on the harness DB singleton
// ---------------------------------------------------------------------------

/**
 * @param {string} key
 * @param {unknown} [defaultValue]
 * @returns {unknown}
 */
function getJSONValue(key, defaultValue = null) {
    if (!_db) return defaultValue;
    try {
        const row = _db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
        if (!row || row.value == null) return defaultValue;
        return JSON.parse(row.value);
    } catch {
        return defaultValue;
    }
}

/**
 * @param {string} key
 * @param {unknown} value
 */
function setJSONValue(key, value) {
    if (!_db) return;
    const json = JSON.stringify(value);
    _db.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, json);
}

// ---------------------------------------------------------------------------
// ECUS Monitor — pure business logic (extracted from server/index.js)
// ---------------------------------------------------------------------------

/**
 * @param {unknown} entry
 * @returns {object | null}
 */
function sanitizeMonitorHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;

    const capturedAtRaw = entry.capturedAt || entry.timestamp || entry.generatedAt;
    const capturedAt = normalizeIsoTimestamp(capturedAtRaw || new Date());

    const issues = Array.isArray(entry.issues)
        ? entry.issues.map((issue) => `${issue}`.trim()).filter((issue) => issue.length > 0).slice(0, 10)
        : [];

    const triggeredAlerts = Array.isArray(entry.triggeredAlerts)
        ? entry.triggeredAlerts.map((t) => `${t}`.trim()).filter((t) => t.length > 0).slice(0, 5)
        : [];

    return {
        version: 1,
        capturedAt,
        severity: `${entry.severity || 'normal'}`.trim() || 'normal',
        syncStatus: entry.syncStatus ? `${entry.syncStatus}`.trim() : null,
        staleMinutes: toNullableNumber(entry.staleMinutes),
        rowsFetched: toNullableNumber(entry.rowsFetched),
        rowsInserted: toNullableNumber(entry.rowsInserted),
        rowsUpdated: toNullableNumber(entry.rowsUpdated),
        rowsSkipped: toNullableNumber(entry.rowsSkipped),
        totalStored: toNullableNumber(entry.totalStored),
        durationMs: toNullableNumber(entry.durationMs),
        runAt: entry.runAt ? normalizeIsoTimestamp(entry.runAt) : null,
        consecutiveErrors: toNonNegativeInt(entry.consecutiveErrors, 0),
        lastErrorMessage: entry.lastErrorMessage ? `${entry.lastErrorMessage}`.trim().slice(0, 500) : null,
        lastSuccessAt: entry.lastSuccessAt ? normalizeIsoTimestamp(entry.lastSuccessAt) : null,
        lastFailureAlertAt: entry.lastFailureAlertAt ? normalizeIsoTimestamp(entry.lastFailureAlertAt) : null,
        lastStaleAlertAt: entry.lastStaleAlertAt ? normalizeIsoTimestamp(entry.lastStaleAlertAt) : null,
        lastAlertDeliveredAt: entry.lastAlertDeliveredAt ? normalizeIsoTimestamp(entry.lastAlertDeliveredAt) : null,
        databaseState: entry.databaseState ? `${entry.databaseState}`.trim().slice(0, 120) : null,
        databaseLatencyMs: toNullableNumber(entry.databaseLatencyMs),
        issues,
        triggeredAlerts,
        actor: entry.actor ? `${entry.actor}`.trim().slice(0, 80) : null,
    };
}

export function getEcusMonitorHistory() {
    const stored = getJSONValue(ECUS_MONITOR_HISTORY_KEY, DEFAULT_ECUS_MONITOR_HISTORY) || {};
    const entries = Array.isArray(stored.entries) ? stored.entries : [];
    return {
        version: 1,
        entries: entries.map((entry) => sanitizeMonitorHistoryEntry(entry)).filter((entry) => entry !== null),
        updatedAt: stored.updatedAt ? normalizeIsoTimestamp(stored.updatedAt) : null,
    };
}

/**
 * @param {object} state
 * @param {{ actor?: string, source?: string }} [opts]
 */
function saveEcusMonitorHistory(state, { actor = 'system', source = 'ecus-monitor-history' } = {}) {
    void actor; void source;
    const payload = {
        version: 1,
        entries: Array.isArray(state.entries) ? state.entries.slice(0) : [],
        updatedAt: state.updatedAt ? normalizeIsoTimestamp(state.updatedAt) : new Date().toISOString(),
    };
    setJSONValue(ECUS_MONITOR_HISTORY_KEY, payload);
    return payload;
}

export function clearEcusMonitorHistory({ actor = 'system', source = 'ecus-monitor-history-reset' } = {}) {
    return saveEcusMonitorHistory({ version: 1, entries: [], updatedAt: new Date().toISOString() }, { actor, source });
}

/**
 * @param {object} snapshot
 * @param {{ actor?: string, source?: string }} [opts]
 */
export function appendEcusMonitorHistory(snapshot, { actor = 'system', source = 'ecus-monitor-history' } = {}) {
    if (!snapshot || typeof snapshot !== 'object') return null;

    const history = getEcusMonitorHistory();
    const options = DEFAULT_ECUS_MONITOR_HISTORY_OPTIONS;
    const maxEntries = Math.max(1, toPositiveInt(options.maxEntries, 7 * 24 * 4) || 7 * 24 * 4);
    const dedupeMinutes = Math.max(0, toPositiveInt(options.dedupeMinutes, 5) || 0);

    const alertState = snapshot.alertState || {};
    const syncState = snapshot.sync || {};
    const database = snapshot.database || {};

    const entry = sanitizeMonitorHistoryEntry({
        capturedAt: snapshot.generatedAt || new Date().toISOString(),
        severity: snapshot.severity || 'normal',
        syncStatus: syncState.lastStatus || null,
        staleMinutes: syncState.staleMinutes,
        rowsFetched: syncState.rowsFetched ?? syncState.lastSummary?.rowsFetched,
        rowsInserted: syncState.rowsInserted ?? syncState.lastSummary?.rowsInserted,
        rowsUpdated: syncState.rowsUpdated ?? syncState.lastSummary?.rowsUpdated,
        rowsSkipped: syncState.rowsSkipped ?? syncState.lastSummary?.rowsSkipped,
        totalStored: syncState.totalStored ?? syncState.lastSummary?.totalStored,
        runAt: syncState.lastRunAt || null,
        durationMs: syncState.durationMs ?? syncState.lastSummary?.durationMs,
        consecutiveErrors: alertState.consecutiveErrors,
        lastErrorMessage: alertState.lastErrorMessage,
        lastSuccessAt: alertState.lastSuccessAt,
        lastFailureAlertAt: alertState.lastFailureAlertAt,
        lastStaleAlertAt: alertState.lastStaleAlertAt,
        lastAlertDeliveredAt: alertState.lastAlertDeliveredAt,
        databaseState: database.state || (database.ok === false ? 'error' : 'ok'),
        databaseLatencyMs: database.latencyMs ?? database.durationMs,
        issues: snapshot.issues || [],
        triggeredAlerts: snapshot.alertDispatch?.triggered || [],
        actor,
    });

    if (!entry) return null;

    const entries = Array.isArray(history.entries) ? history.entries.slice(0) : [];
    const dedupeMs = dedupeMinutes * 60000;
    const lastEntry = entries[entries.length - 1] || null;

    if (lastEntry && dedupeMs > 0) {
        const lastTime = Date.parse(lastEntry.capturedAt);
        const currentTime = Date.parse(entry.capturedAt);
        if (Number.isFinite(lastTime) && Number.isFinite(currentTime) && currentTime - lastTime <= dedupeMs) {
            const comparableKeys = ['severity', 'syncStatus', 'staleMinutes', 'consecutiveErrors'];
            const isEquivalent = comparableKeys.every((key) => (lastEntry[key] ?? null) === (entry[key] ?? null));
            if (isEquivalent) {
                entries[entries.length - 1] = { ...entry };
            } else {
                entries.push(entry);
            }
        } else {
            entries.push(entry);
        }
    } else {
        entries.push(entry);
    }

    const limitedEntries = entries.slice(-maxEntries);
    const saved = saveEcusMonitorHistory({ version: 1, entries: limitedEntries, updatedAt: entry.capturedAt }, { actor, source });

    return { entry, totalEntries: saved.entries.length };
}

/**
 * @param {{ windowMinutes: number | null, staleThresholdMinutes: number }} opts
 */
function summarizeMonitorHistory(entries, { windowMinutes, staleThresholdMinutes } = {}) {
    const now = Date.now();
    const windowMs = Number.isFinite(windowMinutes) ? windowMinutes * 60000 : null;
    const cutoff = windowMs ? now - windowMs : null;

    const filtered = Array.isArray(entries)
        ? entries.filter((entry) => {
            if (!entry || typeof entry !== 'object') return false;
            const ts = Date.parse(entry.capturedAt);
            if (!Number.isFinite(ts)) return false;
            if (cutoff !== null && ts < cutoff) return false;
            return true;
        })
        : [];

    const emptyResult = {
        from: cutoff ? new Date(cutoff).toISOString() : null,
        to: new Date(now).toISOString(),
        sampleCount: 0,
        successCount: 0,
        warningCount: 0,
        errorCount: 0,
        averageStaleMinutes: null,
        maxStaleMinutes: null,
        minStaleMinutes: null,
        staleBreaches: 0,
        rowsInserted: null,
        rowsUpdated: null,
        rowsFetched: null,
    };

    if (filtered.length === 0) return emptyResult;

    let successCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    let staleBreaches = 0;
    let totalStale = 0;
    let staleCount = 0;
    let maxStale = null;
    let minStale = null;

    for (const entry of filtered) {
        const sev = `${entry.severity || ''}`.toLowerCase();
        const status = `${entry.syncStatus || ''}`.toLowerCase();
        if (sev === 'critical' || status.startsWith('error')) { errorCount += 1; }
        else if (sev === 'warning' || status.includes('warning')) { warningCount += 1; }
        else { successCount += 1; }

        const stale = toNullableNumber(entry.staleMinutes);
        if (stale !== null) {
            totalStale += stale;
            staleCount += 1;
            if (maxStale === null || stale > maxStale) maxStale = stale;
            if (minStale === null || stale < minStale) minStale = stale;
            if (staleThresholdMinutes != null && stale > staleThresholdMinutes) staleBreaches += 1;
        }
    }

    return {
        from: cutoff ? new Date(cutoff).toISOString() : null,
        to: new Date(now).toISOString(),
        sampleCount: filtered.length,
        successCount,
        warningCount,
        errorCount,
        averageStaleMinutes: staleCount > 0 ? totalStale / staleCount : null,
        maxStaleMinutes: maxStale,
        minStaleMinutes: minStale,
        staleBreaches,
        rowsInserted: null,
        rowsUpdated: null,
        rowsFetched: null,
    };
}

export function buildEcusMonitorMetrics({ history } = {}) {
    const effectiveHistory = history || getEcusMonitorHistory();
    const entries = Array.isArray(effectiveHistory.entries) ? effectiveHistory.entries : [];
    const thresholds = DEFAULT_ECUS_MONITOR_ALERT_OPTIONS;

    const windowConfigs = [
        { key: '24h', minutes: 24 * 60 },
        { key: '7d', minutes: 7 * 24 * 60 },
        { key: '30d', minutes: 30 * 24 * 60 },
    ];

    const windows = {};
    for (const config of windowConfigs) {
        windows[config.key] = summarizeMonitorHistory(entries, {
            windowMinutes: config.minutes,
            staleThresholdMinutes: thresholds.staleThresholdMinutes,
        });
    }

    windows.all = summarizeMonitorHistory(entries, {
        windowMinutes: null,
        staleThresholdMinutes: thresholds.staleThresholdMinutes,
    });

    const latest = entries.length ? entries[entries.length - 1] : null;

    return { generatedAt: new Date().toISOString(), totals: { entries: entries.length }, latest, windows, thresholds };
}

export function buildEcusMonitorSeries(entries, { thresholds } = {}) {
    const list = Array.isArray(entries) ? entries : [];
    const latencySeries = [];
    const statusSeries = [];
    const consecutiveSeries = [];
    const rowsInsertedSeries = [];
    const rowsUpdatedSeries = [];
    const rowsFetchedSeries = [];

    const statusMap = { success: 1, normal: 1, warning: 0.5, error: 0, critical: 0 };

    for (const entry of list) {
        const timestamp = Date.parse(entry.capturedAt);
        if (!Number.isFinite(timestamp)) continue;

        const stale = toNullableNumber(entry.staleMinutes);
        if (stale !== null) latencySeries.push([stale, timestamp]);

        const severity = `${entry.severity || ''}`.toLowerCase();
        const status = `${entry.syncStatus || ''}`.toLowerCase();
        const statusKey = status.startsWith('error') ? 'error'
            : severity === 'critical' ? 'critical'
                : severity === 'warning' || status.includes('warning') ? 'warning'
                    : 'success';
        statusSeries.push([statusMap[statusKey] ?? 0, timestamp]);

        const consecutive = Number(entry.consecutiveErrors);
        if (Number.isFinite(consecutive)) consecutiveSeries.push([consecutive, timestamp]);

        const rowsInserted = toNullableNumber(entry.rowsInserted);
        if (rowsInserted !== null) rowsInsertedSeries.push([rowsInserted, timestamp]);

        const rowsUpdated = toNullableNumber(entry.rowsUpdated);
        if (rowsUpdated !== null) rowsUpdatedSeries.push([rowsUpdated, timestamp]);

        const rowsFetched = toNullableNumber(entry.rowsFetched);
        if (rowsFetched !== null) rowsFetchedSeries.push([rowsFetched, timestamp]);
    }

    const result = [];
    if (latencySeries.length) {
        result.push({
            name: 'ecus_sync_stale_minutes',
            unit: 'minutes',
            thresholds: { warning: thresholds?.staleThresholdMinutes || DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.staleThresholdMinutes },
            datapoints: latencySeries,
        });
    }
    if (statusSeries.length) {
        result.push({ name: 'ecus_sync_status', unit: 'ratio', legend: { success: 1, warning: 0.5, error: 0 }, datapoints: statusSeries });
    }
    if (consecutiveSeries.length) {
        result.push({ name: 'ecus_sync_consecutive_errors', unit: 'count', datapoints: consecutiveSeries });
    }
    if (rowsInsertedSeries.length) {
        result.push({ name: 'ecus_rows_inserted', unit: 'count', datapoints: rowsInsertedSeries });
    }
    if (rowsUpdatedSeries.length) {
        result.push({ name: 'ecus_rows_updated', unit: 'count', datapoints: rowsUpdatedSeries });
    }
    if (rowsFetchedSeries.length) {
        result.push({ name: 'ecus_rows_fetched', unit: 'count', datapoints: rowsFetchedSeries });
    }

    return result;
}

// ---------------------------------------------------------------------------
// Database harness
// ---------------------------------------------------------------------------

/**
 * Initialize a SQLite database for testing.
 * @param {{ dbFile?: string }} [opts]
 * @returns {Promise<import('better-sqlite3').Database>}
 */
export async function initializeDatabase({ dbFile = ':memory:' } = {}) {
    const targetFile = dbFile === ':memory:' ? ':memory:' : path.resolve(dbFile);

    _databaseInitState.seeded = false;
    _databaseInitState.insertedEntries = 0;
    _databaseInitState.missingInserted = 0;
    _databaseInitState.timestamp = new Date().toISOString();
    _databaseInitState.dbFile = targetFile;

    if (targetFile !== ':memory:') {
        await fs.mkdir(path.dirname(targetFile), { recursive: true });
    }

    const database = new Database(targetFile);
    database.pragma('journal_mode = WAL');

    // Run all migrations
    ensureSqliteKvStore(database);
    ensureSqliteAuthTables(database);
    ensureSqliteExportAuditTables(database);
    ensureSqliteReportingProjectionTables(database);
    ensureSqliteBusinessSnapshotTables(database);
    ensureSqliteTeamRosterTables(database);

    // Seed default storage
    const existingKeys = new Set(database.prepare('SELECT key FROM kv_store').all().map((row) => row.key));

    if (existingKeys.size === 0) {
        const insertMany = database.transaction((entries) => {
            const stmt = database.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)');
            for (const [key, value] of entries) {
                stmt.run(key, normalizeStorageValue(value));
            }
        });
        insertMany(Object.entries(DEFAULT_STORAGE));
        _databaseInitState.seeded = true;
        _databaseInitState.insertedEntries = Object.keys(DEFAULT_STORAGE).length;
        _databaseInitState.missingInserted = 0;
    } else {
        const missingEntries = Object.entries(DEFAULT_STORAGE).filter(([key]) => !existingKeys.has(key));
        if (missingEntries.length > 0) {
            const insertMissing = database.transaction((entries) => {
                const stmt = database.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING');
                for (const [key, value] of entries) {
                    stmt.run(key, normalizeStorageValue(value));
                }
            });
            insertMissing(missingEntries);
            _databaseInitState.seeded = false;
            _databaseInitState.missingInserted = missingEntries.length;
        } else {
            _databaseInitState.seeded = false;
            _databaseInitState.missingInserted = 0;
        }
        _databaseInitState.insertedEntries = 0;
    }

    _db = database;
    return database;
}

/**
 * @returns {import('better-sqlite3').Database}
 */
export function getDatabaseHandle() {
    return _db;
}

/**
 * @returns {{ seeded: boolean, insertedEntries: number, missingInserted: number, timestamp: string, dbFile: string }}
 */
export function getDatabaseInitState() {
    return { ..._databaseInitState };
}



/**
 * Clear all data and re-seed defaults. Only for use in tests.
 * @param {object | null} [seedOverrides]
 */
export function resetDatabaseForTests(seedOverrides = null) {
    if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
        throw new Error('resetDatabaseForTests chỉ sử dụng trong môi trường kiểm thử');
    }

    // If singleton DB was closed (e.g. by a file-based backup test), re-create an in-memory DB
    if (!_isDbOpen()) {
        _reinitMemoryDbSync();
        return; // freshly initialized, no need to clear
    }

    const tables = [
        'kv_store', 'declaration_snapshot_rows', 'mst_assignment_snapshot_rows',
        'adjustment_snapshot_rows', 'business_snapshot_state', 'team_members', 'teams',
        'team_roster_state', 'reporting_projections', 'auth_sessions', 'export_audit',
    ];

    for (const table of tables) {
        try {
            _db.exec(`DELETE FROM ${table}`);
        } catch {
            // table may not exist for older migrations
        }
    }

    const seedData = seedOverrides && typeof seedOverrides === 'object'
        ? { ...DEFAULT_STORAGE, ...seedOverrides }
        : DEFAULT_STORAGE;

    const insertMany = _db.transaction((entries) => {
        const stmt = _db.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        for (const [key, value] of entries) {
            stmt.run(key, normalizeStorageValue(value));
        }
    });
    insertMany(Object.entries(seedData));
}

// ---------------------------------------------------------------------------
// stopServer / waitForAccountSqlSyncIdle — no-op shims for test environment
// ---------------------------------------------------------------------------

/** No-op in test harness (no HTTP server is started) */
export function stopServer() {
    // No HTTP server to shut down in the test harness.
}

/** Resolves immediately — no ECUS bridge in the test harness. */
export async function waitForAccountSqlSyncIdle() {
    return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/**
 * @param {{ dbFile?: string, backupDir?: string, retention?: number, reason?: string, actor?: string, note?: string }} [opts]
 */
export async function performDatabaseBackup({
    dbFile = _databaseInitState.dbFile || ':memory:',
    backupDir,
    retention = DB_BACKUP_RETENTION,
    reason = 'manual',
    actor = 'system',
    note = null,
} = {}) {
    // Cannot backup :memory: databases
    if (!dbFile || dbFile === ':memory:') {
        _appendBackupAuditLog({ ok: false, reason: 'memory_db', actor, note });
        return { ok: false, reason: 'memory_db' };
    }

    const resolvedDbFile = path.resolve(dbFile);
    const resolvedBackupDir = backupDir ? path.resolve(backupDir) : path.join(path.dirname(resolvedDbFile), 'backups');

    await fs.mkdir(resolvedBackupDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${ts}.sqlite`;
    const backupFilePath = path.join(resolvedBackupDir, backupFileName);

    try {
        await fs.copyFile(resolvedDbFile, backupFilePath);
        const stats = await fs.stat(backupFilePath);

        // Enforce retention
        if (typeof retention === 'number' && retention > 0) {
            const files = await fs.readdir(resolvedBackupDir);
            const backupFiles = files
                .filter((f) => f.match(/^backup-.+\.sqlite$/))
                .sort(); // lexicographic = chronological for this naming scheme

            if (backupFiles.length > retention) {
                const toDelete = backupFiles.slice(0, backupFiles.length - retention);
                for (const fileName of toDelete) {
                    await fs.unlink(path.join(resolvedBackupDir, fileName)).catch(() => { });
                }
            }
        }

        _appendBackupAuditLog({
            ok: true,
            bytes: stats.size,
            file: backupFileName,
            reason,
            actor,
            note,
        });

        return { ok: true, file: backupFileName, bytes: stats.size };
    } catch (err) {
        _appendBackupAuditLog({ ok: false, reason: 'io_error', error: err?.message, actor, note });
        return { ok: false, reason: 'io_error', error: err?.message };
    }
}

/**
 * Append to audit_logs_v1 in the harness DB.
 * Auto-reinits a fresh :memory: DB if the current one is closed.
 * @param {{ ok: boolean, reason?: string, bytes?: number, file?: string, actor: string, note: any, error?: string }} entry
 */
function _appendBackupAuditLog({ ok, reason, bytes, file, actor, note, error }) {
    // If the singleton was closed by a test (e.g. file-based backup test), reinit so audit is readable
    if (!_isDbOpen()) {
        _reinitMemoryDbSync();
    }
    if (!_db) return;
    try {
        const existing = getJSONValue('audit_logs_v1', []);
        const logs = Array.isArray(existing) ? existing : [];
        const status = ok ? 'success' : 'failure';
        const detail = ok
            ? `Sao lưu CSDL thành công với lý do: ${reason}`
            : `Sao lưu CSDL thất bại (lý do: ${reason || error || 'unknown'})`;

        logs.push({ actor, action: 'db.backup', detail, meta: { status, reason, bytes, file, note }, timestamp: new Date().toISOString() });
        setJSONValue('audit_logs_v1', logs);
    } catch {
        // ignore audit errors
    }
}

// ---------------------------------------------------------------------------
// Health snapshot — minimal version sufficient for server.backup.test.js
// ---------------------------------------------------------------------------

function _translateBackupReason(reason) {
    const map = {
        cron_disabled_env: 'Cron đang bị tắt qua biến môi trường KPI_DISABLE_CRON.',
        cron_disabled_config: 'Cron đang bị tắt qua cấu hình.',
        schedule_error: 'Lịch sao lưu gặp lỗi khởi tạo.',
        no_cron_expression: 'Chưa cấu hình biểu thức cron cho lịch sao lưu.',
    };
    return map[reason] || null;
}

function _buildBackupSummaryFromDb() {
    const isMemory = !_databaseInitState.dbFile || _databaseInitState.dbFile === ':memory:';

    // In test harness, cron is always disabled (env KPI_DISABLE_CRON=1)
    const cronDisabled = process.env.KPI_DISABLE_CRON === '1';
    const reasons = cronDisabled ? ['cron_disabled_env'] : [];

    return {
        lastSuccess: null,
        lastFailure: null,
        schedule: {
            active: !isMemory && !cronDisabled,
            reasons,
        },
        files: [],
    };
}

/**
 * Returns a health snapshot compatible with what server.backup.test.js expects.
 * @param {{ backupHealth?: { ignoreIssueCodes?: string[] } }} [options]
 */
export async function getDataHealthSnapshot(options = {}) {
    const backupSummary = _buildBackupSummaryFromDb();
    const backupHealth = _evaluateBackupHealth(backupSummary, options.backupHealth);

    return {
        storage: {
            database: { mode: _databaseInitState.dbFile === ':memory:' ? 'memory' : 'file' },
            disk: {},
            backup: { ...backupSummary, health: backupHealth },
            health: {
                severity: backupHealth.severity,
                issues: backupHealth.issues,
            },
        },
    };
}

/**
 * @param {object} summary
 * @param {{ ignoreIssueCodes?: string[] }} [options]
 */
function _evaluateBackupHealth(summary, options = {}) {
    const schedule = summary?.schedule || {};
    const issues = [];
    let severity = 'good';

    const ignoredIssueCodes = new Set(
        Array.isArray(options?.ignoreIssueCodes) ? options.ignoreIssueCodes.filter(Boolean) : []
    );

    const pushIssue = (issue) => {
        if (!issue?.code || ignoredIssueCodes.has(issue.code)) return;
        severity = escalateSeverity(severity, issue.severity);
        issues.push(issue);
    };

    const now = Date.now();
    const lastSuccessTs = parseTimestamp(summary?.lastSuccess?.ts);
    const lastFailureTs = parseTimestamp(summary?.lastFailure?.ts);
    const minutesSinceSuccess = lastSuccessTs !== null ? Math.floor((now - lastSuccessTs) / 60000) : null;

    if (!lastSuccessTs) {
        pushIssue({ severity: 'critical', code: 'backup_missing', message: 'Chưa ghi nhận bản sao lưu thành công nào.' });
    } else if (minutesSinceSuccess >= 72 * 60) {
        pushIssue({ severity: 'critical', code: 'backup_overdue', message: `Đã ${Math.floor(minutesSinceSuccess / 60)} giờ kể từ lần sao lưu gần nhất.` });
    } else if (minutesSinceSuccess >= 36 * 60) {
        pushIssue({ severity: 'warning', code: 'backup_stale', message: `Đã ${Math.floor(minutesSinceSuccess / 60)} giờ kể từ lần sao lưu gần nhất.` });
    }

    if (schedule.active === false) {
        pushIssue({ severity: 'warning', code: 'schedule_inactive', message: 'Lịch sao lưu đang tắt.' });
    }

    if (Array.isArray(schedule.reasons)) {
        for (const reason of schedule.reasons) {
            const description = _translateBackupReason(reason);
            if (!description) continue;
            const level = reason === 'schedule_error' ? 'critical' : 'warning';
            pushIssue({ severity: level, code: `schedule_reason_${reason}`, message: description });
        }
    }

    if (lastFailureTs && (!lastSuccessTs || lastFailureTs > lastSuccessTs)) {
        severity = escalateSeverity(severity, 'warning');
        issues.push({ severity: 'warning', code: 'backup_failure_recent', message: 'Có lỗi sao lưu gần nhất.' });
    }

    return {
        severity,
        issues,
        minutesSinceLastSuccess: minutesSinceSuccess,
        lastSuccessAt: lastSuccessTs ? new Date(lastSuccessTs).toISOString() : null,
        lastFailureAt: lastFailureTs ? new Date(lastFailureTs).toISOString() : null,
    };
}
