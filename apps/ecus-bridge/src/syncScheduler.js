// SyncScheduler — ECUS Bridge cron-based auto-sync with hot-reload.
//
// Implements Requirements 9.1–9.5:
//   9.1 — Configurable cron-based schedule for automatic synchronization.
//   9.2 — Executes the full Sync_Pipeline without user intervention.
//   9.3 — Concurrency guard: skips trigger if sync already in progress, logs warning.
//   9.4 — Exposes current schedule, last sync, next sync, syncInProgress via status.
//   9.5 — Hot-reload: updateSchedule() applies new schedule without restart.
//
// Property 11 (Sync Concurrency Guard): at most one sync active at any time.
//
// NOTE: Plain ESM JavaScript — no TypeScript build step. JSDoc typedefs mirror
// the interfaces from the design document.

import cron from 'node-cron';

/**
 * @typedef {Object} SchedulerConfig
 * @property {string} cronExpression  Cron expression (e.g. "0 *\/4 * * *").
 * @property {boolean} enabled        Whether the scheduler should be active.
 */

/**
 * @typedef {Object} SchedulerStatus
 * @property {string} cronExpression
 * @property {boolean} enabled
 * @property {Date|null} lastSyncAt
 * @property {Date|null} nextSyncAt
 * @property {boolean} syncInProgress
 */

/**
 * Compute the next execution time from a cron expression using node-cron
 * internals, or return null if unavailable.
 *
 * @param {string} cronExpression
 * @param {() => Date} now
 * @returns {Date|null}
 */
function computeNextSyncAt(cronExpression, now) {
  try {
    // node-cron v4 exposes a .nextDate() helper on tasks, but for status
    // reporting when the job may not yet be started we do a lightweight
    // calculation. We create a temporary task, grab the next date, then stop.
    const tempTask = cron.schedule(cronExpression, () => {}, { scheduled: false });
    if (typeof tempTask.nextDate === 'function') {
      const next = tempTask.nextDate();
      // node-cron v4 returns a luxon DateTime or a Date depending on version.
      if (next instanceof Date) return next;
      if (next && typeof next.toJSDate === 'function') return next.toJSDate();
      if (next && typeof next.toDate === 'function') return next.toDate();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a SyncScheduler instance.
 *
 * @param {Object} deps
 * @param {() => Promise<void>} deps.syncFn
 *   The function that executes the full sync pipeline (fetch → preview → commit).
 * @param {{ warn?: Function, info?: Function, error?: Function }} [deps.logger]
 *   Structured logger. Defaults to `console`.
 * @param {() => Date} [deps.now]
 *   Clock function for timestamps. Injectable for deterministic tests.
 * @returns {{ start: Function, stop: Function, updateSchedule: Function, getStatus: Function, isRunning: Function }}
 */
export function createSyncScheduler({ syncFn, logger = console, now = () => new Date() } = {}) {
  if (typeof syncFn !== 'function') {
    throw new Error('createSyncScheduler requires deps.syncFn — the sync pipeline function');
  }

  const log = {
    warn: typeof logger?.warn === 'function' ? logger.warn.bind(logger) : () => {},
    info: typeof logger?.info === 'function' ? logger.info.bind(logger) : () => {},
    error: typeof logger?.error === 'function' ? logger.error.bind(logger) : () => {},
  };

  /** @type {SchedulerConfig} */
  let config = { cronExpression: '', enabled: false };

  /** @type {import('node-cron').ScheduledTask | null} */
  let cronTask = null;

  /** @type {boolean} */
  let syncInProgress = false;

  /** @type {Date|null} */
  let lastSyncAt = null;

  /**
   * Internal handler invoked on each cron tick.
   * Enforces concurrency guard (Property 11 / Requirement 9.3).
   */
  async function onTick() {
    if (syncInProgress) {
      log.warn('[sync-scheduler] sync already in progress — skipping scheduled trigger', {
        timestamp: now().toISOString(),
        cronExpression: config.cronExpression,
      });
      return;
    }

    syncInProgress = true;
    log.info('[sync-scheduler] scheduled sync starting', {
      timestamp: now().toISOString(),
      cronExpression: config.cronExpression,
    });

    try {
      await syncFn();
      lastSyncAt = now();
      log.info('[sync-scheduler] scheduled sync completed', {
        timestamp: now().toISOString(),
        lastSyncAt: lastSyncAt.toISOString(),
      });
    } catch (error) {
      log.error('[sync-scheduler] scheduled sync failed', {
        timestamp: now().toISOString(),
        error: error?.message || String(error),
      });
    } finally {
      syncInProgress = false;
    }
  }

  /**
   * Create and start the internal cron task.
   * @param {string} cronExpression
   */
  function createCronTask(cronExpression) {
    if (cronTask) {
      cronTask.stop();
      cronTask = null;
    }

    if (!cronExpression || !cron.validate(cronExpression)) {
      log.warn('[sync-scheduler] invalid cron expression, scheduler not started', {
        cronExpression,
      });
      return;
    }

    cronTask = cron.schedule(cronExpression, onTick, {
      scheduled: true,
    });
  }

  /**
   * Start the scheduler with the given config.
   * @param {SchedulerConfig} schedulerConfig
   */
  function start(schedulerConfig) {
    config = {
      cronExpression: schedulerConfig?.cronExpression || '',
      enabled: schedulerConfig?.enabled !== false,
    };

    if (config.enabled) {
      createCronTask(config.cronExpression);
      log.info('[sync-scheduler] started', {
        cronExpression: config.cronExpression,
      });
    }
  }

  /**
   * Stop the scheduler. Does NOT abort an in-progress sync.
   */
  function stop() {
    if (cronTask) {
      cronTask.stop();
      cronTask = null;
    }
    config.enabled = false;
    log.info('[sync-scheduler] stopped');
  }

  /**
   * Hot-reload the schedule without a service restart (Requirement 9.5).
   * Replaces the running cron task with the new schedule.
   *
   * @param {SchedulerConfig} schedulerConfig
   */
  function updateSchedule(schedulerConfig) {
    const newCron = schedulerConfig?.cronExpression || '';
    const newEnabled = schedulerConfig?.enabled !== false;

    config = { cronExpression: newCron, enabled: newEnabled };

    if (cronTask) {
      cronTask.stop();
      cronTask = null;
    }

    if (newEnabled) {
      createCronTask(newCron);
      log.info('[sync-scheduler] schedule updated (hot-reload)', {
        cronExpression: newCron,
      });
    } else {
      log.info('[sync-scheduler] schedule updated — disabled');
    }
  }

  /**
   * Get the current scheduler status (Requirement 9.4).
   * @returns {SchedulerStatus}
   */
  function getStatus() {
    return {
      cronExpression: config.cronExpression,
      enabled: config.enabled,
      lastSyncAt,
      nextSyncAt: config.enabled ? computeNextSyncAt(config.cronExpression, now) : null,
      syncInProgress,
    };
  }

  /**
   * Whether the scheduler is currently running (cron task active).
   * @returns {boolean}
   */
  function isRunning() {
    return config.enabled && cronTask !== null;
  }

  return { start, stop, updateSchedule, getStatus, isRunning };
}

export default createSyncScheduler;
