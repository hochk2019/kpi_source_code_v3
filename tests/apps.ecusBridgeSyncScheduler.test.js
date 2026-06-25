import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { createSyncScheduler } from '../apps/ecus-bridge/src/syncScheduler.js';

describe('SyncScheduler', () => {
  let scheduler;
  let syncFn;
  let logger;
  let clock;

  beforeEach(() => {
    vi.useFakeTimers();
    clock = new Date('2026-06-15T10:00:00Z');
    syncFn = vi.fn(async () => {});
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(() => {
    if (scheduler && typeof scheduler.stop === 'function') {
      scheduler.stop();
    }
    vi.useRealTimers();
  });

  function createScheduler(overrides = {}) {
    scheduler = createSyncScheduler({
      syncFn,
      logger,
      now: () => clock,
      ...overrides,
    });
    return scheduler;
  }

  describe('construction', () => {
    it('throws if syncFn is not provided', () => {
      expect(() => createSyncScheduler({})).toThrow('syncFn');
    });

    it('creates a scheduler with valid syncFn', () => {
      const s = createScheduler();
      expect(s.start).toBeTypeOf('function');
      expect(s.stop).toBeTypeOf('function');
      expect(s.updateSchedule).toBeTypeOf('function');
      expect(s.getStatus).toBeTypeOf('function');
      expect(s.isRunning).toBeTypeOf('function');
    });
  });

  describe('start / stop', () => {
    it('starts with a valid cron expression and reports running', () => {
      const s = createScheduler();
      s.start({ cronExpression: '*/5 * * * *', enabled: true });
      expect(s.isRunning()).toBe(true);
    });

    it('does not start when enabled=false', () => {
      const s = createScheduler();
      s.start({ cronExpression: '*/5 * * * *', enabled: false });
      expect(s.isRunning()).toBe(false);
    });

    it('stops a running scheduler', () => {
      const s = createScheduler();
      s.start({ cronExpression: '*/5 * * * *', enabled: true });
      s.stop();
      expect(s.isRunning()).toBe(false);
    });

    it('warns on invalid cron expression', () => {
      const s = createScheduler();
      s.start({ cronExpression: 'not-valid', enabled: true });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid cron expression'),
        expect.any(Object),
      );
    });
  });

  describe('getStatus (Requirement 9.4)', () => {
    it('returns initial idle status before start', () => {
      const s = createScheduler();
      const status = s.getStatus();
      expect(status.cronExpression).toBe('');
      expect(status.enabled).toBe(false);
      expect(status.lastSyncAt).toBeNull();
      expect(status.syncInProgress).toBe(false);
    });

    it('returns the current schedule config after start', () => {
      const s = createScheduler();
      s.start({ cronExpression: '0 */4 * * *', enabled: true });
      const status = s.getStatus();
      expect(status.cronExpression).toBe('0 */4 * * *');
      expect(status.enabled).toBe(true);
      expect(status.syncInProgress).toBe(false);
    });

    it('returns nextSyncAt as null when disabled', () => {
      const s = createScheduler();
      s.start({ cronExpression: '0 */4 * * *', enabled: false });
      const status = s.getStatus();
      expect(status.nextSyncAt).toBeNull();
    });
  });

  describe('updateSchedule — hot-reload (Requirement 9.5)', () => {
    it('changes the cron expression without restart', () => {
      const s = createScheduler();
      s.start({ cronExpression: '0 */4 * * *', enabled: true });
      expect(s.isRunning()).toBe(true);

      s.updateSchedule({ cronExpression: '0 */2 * * *', enabled: true });
      const status = s.getStatus();
      expect(status.cronExpression).toBe('0 */2 * * *');
      expect(s.isRunning()).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('hot-reload'),
        expect.any(Object),
      );
    });

    it('disables the scheduler via updateSchedule', () => {
      const s = createScheduler();
      s.start({ cronExpression: '0 */4 * * *', enabled: true });
      s.updateSchedule({ cronExpression: '0 */4 * * *', enabled: false });
      expect(s.isRunning()).toBe(false);
    });
  });

  describe('concurrency guard (Requirement 9.3 / Property 11)', () => {
    it('skips trigger if sync already in progress and logs warning', async () => {
      // Create a sync function that stays "in progress" until we resolve it
      let resolveSync;
      const slowSync = new Promise((resolve) => { resolveSync = resolve; });
      syncFn = vi.fn(() => slowSync);

      const s = createSyncScheduler({
        syncFn,
        logger,
        now: () => clock,
      });
      scheduler = s;

      s.start({ cronExpression: '* * * * * *', enabled: true });

      // Advance time to trigger the cron
      await vi.advanceTimersByTimeAsync(1100);

      // syncFn should have been called once
      expect(syncFn).toHaveBeenCalledTimes(1);

      // Advance time again — the first sync is still running
      await vi.advanceTimersByTimeAsync(1100);

      // syncFn should NOT have been called a second time (concurrency guard)
      expect(syncFn).toHaveBeenCalledTimes(1);

      // Warning should have been logged about skipping
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already in progress'),
        expect.any(Object),
      );

      // Resolve the sync and check status returns to idle
      resolveSync();
      await vi.advanceTimersByTimeAsync(0);
    });

    it('allows next trigger after previous sync completes', async () => {
      syncFn = vi.fn(async () => {});

      const s = createSyncScheduler({
        syncFn,
        logger,
        now: () => clock,
      });
      scheduler = s;

      s.start({ cronExpression: '* * * * * *', enabled: true });

      // First trigger
      await vi.advanceTimersByTimeAsync(1100);
      expect(syncFn).toHaveBeenCalledTimes(1);

      // Second trigger — first sync already completed
      await vi.advanceTimersByTimeAsync(1100);
      expect(syncFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('sync execution (Requirement 9.2)', () => {
    it('updates lastSyncAt after successful sync', async () => {
      const s = createScheduler();
      s.start({ cronExpression: '* * * * * *', enabled: true });

      await vi.advanceTimersByTimeAsync(1100);

      const status = s.getStatus();
      expect(status.lastSyncAt).toEqual(clock);
    });

    it('does not update lastSyncAt after failed sync', async () => {
      syncFn = vi.fn(async () => { throw new Error('network error'); });
      const s = createSyncScheduler({ syncFn, logger, now: () => clock });
      scheduler = s;

      s.start({ cronExpression: '* * * * * *', enabled: true });
      await vi.advanceTimersByTimeAsync(1100);

      const status = s.getStatus();
      expect(status.lastSyncAt).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('sync failed'),
        expect.objectContaining({ error: 'network error' }),
      );
    });

    it('resets syncInProgress to false even on failure', async () => {
      syncFn = vi.fn(async () => { throw new Error('timeout'); });
      const s = createSyncScheduler({ syncFn, logger, now: () => clock });
      scheduler = s;

      s.start({ cronExpression: '* * * * * *', enabled: true });
      await vi.advanceTimersByTimeAsync(1100);

      expect(s.getStatus().syncInProgress).toBe(false);
    });
  });
});
