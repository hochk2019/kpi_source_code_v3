// HealthMonitor — ECUS Bridge observability and sync history tracking.
//
// Implements the HealthMonitor interface from the design document:
//   - getHealth()        → HealthReport
//   - recordSync(entry)  → persist SyncHistoryEntry to SQLite
//   - checkStaleData(thresholdHours) → boolean stale-data alert
//   - computeStats(windowDays) → { average, p95 }
//
// Satisfies Requirements 10.1 (health endpoint data), 10.2 (sync history log),
// 10.3 (stale-data alert), 10.4 (average + p95 duration stats),
// 10.5 (SQL Server degradation reporting).
//
// Persistence uses better-sqlite3 consistent with the existing bridge modules
// (retryQueue.js). The ecus_sync_history table stores every sync outcome.

import { randomUUID } from 'node:crypto';

/**
 * @typedef {Object} SyncHistoryEntry
 * @property {string} [id]
 * @property {Date|string} startedAt
 * @property {Date|string} completedAt
 * @property {number} rowsFetched
 * @property {number} rowsCommitted
 * @property {'success'|'failure'|'partial'} outcome
 * @property {string} [errorMessage]
 * @property {number} durationMs
 */

/**
 * @typedef {Object} HealthReport
 * @property {'healthy'|'degraded'|'unhealthy'} status
 * @property {'connected'|'disconnected'|'degraded'} connectionStatus
 * @property {string|null} lastSuccessfulSync   ISO-8601 or null
 * @property {number} queueDepth
 * @property {number} errorCount
 * @property {number} averageSyncDurationMs
 * @property {number} p95SyncDurationMs
 * @property {boolean} staleDataAlert
 * @property {string} [degradationDetails]
 */

/** Default stale-data threshold: 24 hours (Requirement 10.3). */
const DEFAULT_STALE_THRESHOLD_HOURS = 24;

/** Default statistics window: 7 days (Requirement 10.4). */
const DEFAULT_STATS_WINDOW_DAYS = 7;

/**
 * Ensure the `ecus_sync_history` table exists.
 * @param {import('better-sqlite3').Database} db
 */
function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ecus_sync_history (
      id              TEXT PRIMARY KEY,
      started_at      TEXT NOT NULL,
      completed_at    TEXT NOT NULL,
      rows_fetched    INTEGER NOT NULL,
      rows_committed  INTEGER NOT NULL,
      outcome         TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'partial')),
      error_message   TEXT,
      duration_ms     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sync_history_started
      ON ecus_sync_history(started_at DESC);
  `);
}

/**
 * Convert a Date or ISO string to ISO-8601 string.
 * @param {Date|string} value
 * @returns {string}
 */
function toISO(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * Check whether data is stale: (now - lastSync) > threshold.
 *
 * Pure function for Property 13: returns true iff elapsed > threshold.
 * Monotonic: if true for threshold T, also true for any T' < T.
 *
 * @param {string|null} lastSyncISO  ISO-8601 timestamp of last successful sync, or null.
 * @param {number} thresholdHours    Threshold in hours.
 * @param {string} nowISO            Current time as ISO-8601 string.
 * @returns {boolean}
 */
export function isStale(lastSyncISO, thresholdHours, nowISO) {
  if (!lastSyncISO) return true;
  const lastSyncTime = new Date(lastSyncISO).getTime();
  if (Number.isNaN(lastSyncTime)) return true;
  const currentTime = new Date(nowISO).getTime();
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  return (currentTime - lastSyncTime) > thresholdMs;
}

/**
 * Compute average and p95 duration from a sorted ascending array.
 *
 * Property 14: average = sum/count, p95 = ceil(0.95 * count)-th smallest value
 * (1-indexed), which maps to index ceil(0.95 * count) - 1 in 0-indexed array.
 *
 * @param {number[]} sortedDurations  Array sorted ascending.
 * @returns {{ average: number, p95: number }}
 */
export function computeDurationStats(sortedDurations) {
  if (!sortedDurations || sortedDurations.length === 0) {
    return { average: 0, p95: 0 };
  }
  const count = sortedDurations.length;
  const sum = sortedDurations.reduce((acc, d) => acc + d, 0);
  const average = sum / count;
  const p95Index = Math.ceil(0.95 * count) - 1;
  const p95 = sortedDurations[Math.min(Math.max(0, p95Index), count - 1)];
  return { average, p95 };
}

/**
 * Create a HealthMonitor instance backed by SQLite.
 *
 * @param {Object} deps
 * @param {import('better-sqlite3').Database} deps.db
 *   An open better-sqlite3 database handle.
 * @param {() => string} [deps.now]
 *   Clock returning ISO-8601 string. Injectable for tests.
 * @param {() => string} [deps.generateId]
 *   ID generator. Defaults to randomUUID.
 * @param {{ warn?: Function, info?: Function, error?: Function }} [deps.logger]
 *   Structured logger. Defaults to console.
 * @param {() => Promise<number>} [deps.getQueueDepth]
 *   Returns current retry queue depth. Defaults to 0.
 * @param {() => Promise<{connected: boolean, degraded?: boolean, details?: string}>} [deps.getConnectionStatus]
 *   Returns current SQL Server connection status.
 * @param {number} [deps.staleThresholdHours]
 *   Default stale-data threshold in hours. Overridable per-call.
 */
export function createHealthMonitor({
  db,
  now = () => new Date().toISOString(),
  generateId = () => randomUUID(),
  logger = console,
  getQueueDepth = async () => 0,
  getConnectionStatus = async () => ({ connected: true }),
  staleThresholdHours = DEFAULT_STALE_THRESHOLD_HOURS,
} = {}) {
  if (!db) {
    throw new Error('createHealthMonitor requires a better-sqlite3 database handle (deps.db)');
  }

  const log = {
    warn: typeof logger?.warn === 'function' ? logger.warn.bind(logger) : () => {},
    info: typeof logger?.info === 'function' ? logger.info.bind(logger) : () => {},
    error: typeof logger?.error === 'function' ? logger.error.bind(logger) : () => {},
  };

  ensureSchema(db);

  // Prepared statements
  const stmtInsert = db.prepare(`
    INSERT INTO ecus_sync_history (id, started_at, completed_at, rows_fetched, rows_committed, outcome, error_message, duration_ms)
    VALUES (@id, @startedAt, @completedAt, @rowsFetched, @rowsCommitted, @outcome, @errorMessage, @durationMs)
  `);

  const stmtLastSuccessfulSync = db.prepare(`
    SELECT completed_at AS completedAt
    FROM ecus_sync_history
    WHERE outcome = 'success'
    ORDER BY started_at DESC
    LIMIT 1
  `);

  const stmtErrorCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM ecus_sync_history
    WHERE outcome = 'failure'
  `);

  const stmtDurationsInWindow = db.prepare(`
    SELECT duration_ms AS durationMs
    FROM ecus_sync_history
    WHERE started_at >= @windowStart
    ORDER BY duration_ms ASC
  `);

  /**
   * Record a completed sync operation (Requirement 10.2).
   *
   * Property 12: Every recorded entry has non-null startedAt, completedAt,
   * rowsFetched, rowsCommitted, outcome, durationMs.
   *
   * @param {Omit<SyncHistoryEntry, 'id'>} entry
   * @returns {Promise<void>}
   */
  async function recordSync(entry) {
    const id = generateId();
    const startedAt = toISO(entry.startedAt);
    const completedAt = toISO(entry.completedAt);
    const rowsFetched = Number(entry.rowsFetched) || 0;
    const rowsCommitted = Number(entry.rowsCommitted) || 0;
    const outcome = entry.outcome;
    const errorMessage = entry.errorMessage || null;
    const durationMs = Number(entry.durationMs) || 0;

    stmtInsert.run({
      id,
      startedAt,
      completedAt,
      rowsFetched,
      rowsCommitted,
      outcome,
      errorMessage,
      durationMs,
    });

    log.info('[health-monitor] recorded sync', { id, outcome, durationMs });
  }

  /**
   * Check if data is stale — time since last successful sync exceeds threshold.
   *
   * Property 13: Returns true iff (now - lastSyncTime) > threshold.
   * Monotonic: if true for threshold T, also true for any T' < T.
   *
   * @param {number} [thresholdHours]  Threshold in hours. Defaults to configured value.
   * @returns {boolean}
   */
  function checkStaleData(thresholdHours) {
    const threshold = typeof thresholdHours === 'number' && thresholdHours > 0
      ? thresholdHours
      : staleThresholdHours;

    const row = stmtLastSuccessfulSync.get();
    const lastSyncISO = row?.completedAt || null;
    return isStale(lastSyncISO, threshold, now());
  }

  /**
   * Compute average and p95 sync duration over a given window.
   *
   * Property 14:
   *   average = sum / count
   *   p95 = ceil(0.95 * count)-th smallest value (1-indexed)
   *
   * @param {number} [windowDays]  Number of days to look back. Defaults to 7.
   * @returns {{ average: number, p95: number }}
   */
  function computeStats(windowDays) {
    const days = typeof windowDays === 'number' && windowDays > 0
      ? windowDays
      : DEFAULT_STATS_WINDOW_DAYS;

    const currentTime = new Date(now());
    const windowStart = new Date(currentTime.getTime() - days * 24 * 60 * 60 * 1000);
    const windowStartISO = windowStart.toISOString();

    const rows = stmtDurationsInWindow.all({ windowStart: windowStartISO });
    const sortedDurations = rows.map((r) => r.durationMs);
    return computeDurationStats(sortedDurations);
  }

  /**
   * Get the full health report (Requirement 10.1).
   *
   * @returns {Promise<HealthReport>}
   */
  async function getHealth() {
    const connStatus = await getConnectionStatus();
    const queueDepth = await getQueueDepth();
    const staleAlert = checkStaleData();
    const stats = computeStats();

    const lastSuccessRow = stmtLastSuccessfulSync.get();
    const lastSuccessfulSync = lastSuccessRow?.completedAt || null;

    const errorRow = stmtErrorCount.get();
    const errorCount = errorRow?.count || 0;

    // Determine connection status string
    let connectionStatus = 'connected';
    if (connStatus.degraded) {
      connectionStatus = 'degraded';
    } else if (!connStatus.connected) {
      connectionStatus = 'disconnected';
    }

    // Determine overall health status
    let status = 'healthy';
    if (connectionStatus === 'disconnected' || staleAlert) {
      status = 'unhealthy';
    } else if (connectionStatus === 'degraded' || queueDepth > 0) {
      status = 'degraded';
    }

    /** @type {HealthReport} */
    const report = {
      status,
      connectionStatus,
      lastSuccessfulSync,
      queueDepth,
      errorCount,
      averageSyncDurationMs: stats.average,
      p95SyncDurationMs: stats.p95,
      staleDataAlert: staleAlert,
    };

    // Requirement 10.5: Include degradation details from SQL Server
    if (connStatus.details) {
      report.degradationDetails = connStatus.details;
    }

    return report;
  }

  return { getHealth, recordSync, checkStaleData, computeStats };
}

export default createHealthMonitor;
