// Durable Retry Queue — ECUS Bridge (Task 10.3)
//
// Implements SQLite-backed retry queue with FIFO processing and dead-lettering.
// Satisfies Requirements 8.2 (persist failed sync requests), 8.3 (FIFO
// processing on connectivity restore), and 8.5 (dead-letter after 3 failures).
//
// This module exports a factory that returns a queue adapter conforming to the
// interface expected by `createRetryEngine({ queue })`.

import { randomUUID } from 'node:crypto';

/**
 * @typedef {Object} RetryQueueItem
 * @property {string} id
 * @property {unknown} payload
 * @property {string} createdAt       ISO-8601 timestamp
 * @property {number} attemptCount
 * @property {string|null} lastAttemptAt  ISO-8601 or null
 * @property {string|null} lastError
 * @property {'pending'|'processing'|'dead-lettered'} status
 */

/**
 * @typedef {Object} QueueProcessingResult
 * @property {number} processed       Items successfully processed
 * @property {number} failed          Items that failed this run
 * @property {number} deadLettered    Items moved to dead-letter
 */

/** Maximum consecutive queue failures before dead-lettering (Req 8.5). */
const MAX_QUEUE_FAILURES = 3;

/**
 * Ensure the `ecus_retry_queue` table exists.
 * Uses SQLite-compatible DDL (TEXT for timestamps, JSON for payload).
 * @param {import('better-sqlite3').Database} db
 */
function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ecus_retry_queue (
      id             TEXT PRIMARY KEY,
      payload        TEXT NOT NULL,
      created_at     TEXT NOT NULL,
      attempt_count  INTEGER NOT NULL DEFAULT 0,
      last_attempt   TEXT,
      last_error     TEXT,
      status         TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'dead-lettered'))
    );
    CREATE INDEX IF NOT EXISTS idx_retry_queue_status
      ON ecus_retry_queue(status, created_at);
  `);
}

/**
 * Create a durable retry-queue adapter backed by a better-sqlite3 Database.
 *
 * @param {Object} deps
 * @param {import('better-sqlite3').Database} deps.db
 *   An open better-sqlite3 database handle.
 * @param {(request: unknown) => Promise<unknown>} deps.processor
 *   Async function that executes a sync request. Throws on failure.
 * @param {{ warn?: Function, info?: Function, error?: Function }} [deps.logger]
 *   Structured logger. Defaults to console.
 * @param {(alert: { type: string, item: RetryQueueItem }) => void} [deps.onAlert]
 *   Callback invoked when an item is dead-lettered (alert emission, Req 8.5).
 * @param {() => string} [deps.now]
 *   Clock returning ISO-8601 string. Defaults to `() => new Date().toISOString()`.
 * @param {() => string} [deps.generateId]
 *   ID generator. Defaults to randomUUID.
 */
export function createRetryQueue({
  db,
  processor,
  logger = console,
  onAlert,
  now = () => new Date().toISOString(),
  generateId = () => randomUUID(),
} = {}) {
  if (!db) {
    throw new Error('createRetryQueue requires a better-sqlite3 database handle (deps.db)');
  }
  if (typeof processor !== 'function') {
    throw new Error('createRetryQueue requires a processor function (deps.processor)');
  }

  const log = {
    warn: typeof logger?.warn === 'function' ? logger.warn.bind(logger) : () => {},
    info: typeof logger?.info === 'function' ? logger.info.bind(logger) : () => {},
    error: typeof logger?.error === 'function' ? logger.error.bind(logger) : () => {},
  };

  ensureSchema(db);

  // Prepared statements for performance
  const stmtInsert = db.prepare(`
    INSERT INTO ecus_retry_queue (id, payload, created_at, attempt_count, last_attempt, last_error, status)
    VALUES (@id, @payload, @createdAt, 0, NULL, NULL, 'pending')
  `);

  const stmtSelectPending = db.prepare(`
    SELECT id, payload, created_at AS createdAt, attempt_count AS attemptCount,
           last_attempt AS lastAttemptAt, last_error AS lastError, status
    FROM ecus_retry_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `);

  const stmtUpdateProcessing = db.prepare(`
    UPDATE ecus_retry_queue SET status = 'processing' WHERE id = @id
  `);

  const stmtMarkSuccess = db.prepare(`
    DELETE FROM ecus_retry_queue WHERE id = @id
  `);

  const stmtMarkFailed = db.prepare(`
    UPDATE ecus_retry_queue
    SET attempt_count = @attemptCount,
        last_attempt = @lastAttempt,
        last_error = @lastError,
        status = 'pending'
    WHERE id = @id
  `);

  const stmtDeadLetter = db.prepare(`
    UPDATE ecus_retry_queue
    SET attempt_count = @attemptCount,
        last_attempt = @lastAttempt,
        last_error = @lastError,
        status = 'dead-lettered'
    WHERE id = @id
  `);

  const stmtCountPending = db.prepare(`
    SELECT COUNT(*) AS count FROM ecus_retry_queue WHERE status = 'pending'
  `);

  /**
   * Persist a failed sync request to the durable queue (Requirement 8.2).
   * @param {unknown} request  The sync request payload to enqueue.
   * @returns {Promise<string>} The generated queue item ID.
   */
  async function enqueue(request) {
    const id = generateId();
    const createdAt = now();
    const payload = JSON.stringify(request);
    stmtInsert.run({ id, payload, createdAt });
    log.info('[retry-queue] enqueued failed sync request', { id, createdAt });
    return id;
  }

  /**
   * Process all pending queue items in FIFO order — earliest createdAt first
   * (Requirement 8.3). Dead-letters items after MAX_QUEUE_FAILURES consecutive
   * failures (Requirement 8.5).
   *
   * @returns {Promise<QueueProcessingResult>}
   */
  async function processQueue() {
    const pending = stmtSelectPending.all();
    let processed = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const row of pending) {
      const item = {
        id: row.id,
        payload: JSON.parse(row.payload),
        createdAt: row.createdAt,
        attemptCount: row.attemptCount,
        lastAttemptAt: row.lastAttemptAt,
        lastError: row.lastError,
        status: row.status,
      };

      // Mark as processing
      stmtUpdateProcessing.run({ id: item.id });

      try {
        await processor(item.payload);
        // Success → remove from queue
        stmtMarkSuccess.run({ id: item.id });
        processed += 1;
        log.info('[retry-queue] processed queue item successfully', { id: item.id });
      } catch (err) {
        const newAttemptCount = item.attemptCount + 1;
        const lastAttempt = now();
        const lastError = err instanceof Error ? err.message : String(err);

        if (newAttemptCount >= MAX_QUEUE_FAILURES) {
          // Dead-letter (Requirement 8.5)
          stmtDeadLetter.run({
            id: item.id,
            attemptCount: newAttemptCount,
            lastAttempt,
            lastError,
          });
          deadLettered += 1;

          const deadLetteredItem = {
            ...item,
            attemptCount: newAttemptCount,
            lastAttemptAt: lastAttempt,
            lastError,
            status: 'dead-lettered',
          };

          log.error('[retry-queue] item dead-lettered after max failures', {
            id: item.id,
            attemptCount: newAttemptCount,
            lastError,
          });

          // Emit alert notification (Requirement 8.5)
          if (typeof onAlert === 'function') {
            try {
              onAlert({ type: 'dead-lettered', item: deadLetteredItem });
            } catch {
              // Alert emission should not break queue processing
            }
          }
        } else {
          // Back to pending for next processQueue() call
          stmtMarkFailed.run({
            id: item.id,
            attemptCount: newAttemptCount,
            lastAttempt,
            lastError,
          });
          failed += 1;
          log.warn('[retry-queue] queue item failed, will retry', {
            id: item.id,
            attemptCount: newAttemptCount,
            lastError,
          });
        }
      }
    }

    return { processed, failed, deadLettered };
  }

  /**
   * Get the current number of pending items in the queue.
   * @returns {Promise<number>}
   */
  async function getQueueDepth() {
    const row = stmtCountPending.get();
    return row?.count ?? 0;
  }

  return { enqueue, processQueue, getQueueDepth };
}

export default createRetryQueue;
