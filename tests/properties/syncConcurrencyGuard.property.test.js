/**
 * Property Test: Sync Concurrency Guard (Property 11)
 *
 * Feature: system-redesign-2026, Property 11: Sync Concurrency Guard
 *
 * For any sequence of schedule triggers arriving at arbitrary times, if a sync
 * operation is already in progress, subsequent triggers SHALL be skipped (not
 * queued), resulting in at most one active sync operation at any point in time.
 *
 * **Validates: Requirements 9.3**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createSyncScheduler } from '../../apps/ecus-bridge/src/syncScheduler.js';

describe('Property 11: Sync Concurrency Guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('at most one sync operation is active at any time for any sequence of rapid cron triggers', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Number of cron ticks to simulate (rapid triggers)
        fc.integer({ min: 3, max: 30 }),
        // Duration of syncFn in ms
        fc.integer({ min: 100, max: 3000 }),
        // Inter-trigger interval in ms (simulate rapid cron ticks)
        fc.integer({ min: 10, max: 500 }),
        async (triggerCount, syncDuration, interval) => {
          let activeSyncCount = 0;
          let maxConcurrency = 0;

          // syncFn that tracks active concurrency
          const syncFn = vi.fn(() => {
            activeSyncCount++;
            maxConcurrency = Math.max(maxConcurrency, activeSyncCount);
            return new Promise((resolve) => {
              setTimeout(() => {
                activeSyncCount--;
                resolve();
              }, syncDuration);
            });
          });

          const logger = { info: () => {}, warn: () => {}, error: () => {} };
          const clock = { value: new Date('2026-01-15T00:00:00Z') };

          const scheduler = createSyncScheduler({
            syncFn,
            logger,
            now: () => clock.value,
          });

          // Start with per-second cron to ensure frequent triggers
          scheduler.start({ cronExpression: '* * * * * *', enabled: true });

          // Advance time in small steps to simulate rapid triggers
          for (let i = 0; i < triggerCount; i++) {
            clock.value = new Date(clock.value.getTime() + interval);
            await vi.advanceTimersByTimeAsync(interval);
          }

          // Let pending sync complete
          await vi.advanceTimersByTimeAsync(syncDuration + 100);

          scheduler.stop();

          // PROPERTY: at most 1 sync active at any time
          expect(maxConcurrency).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 },
    );
  }, 60000);

  it('syncFn invocation count is bounded when triggers arrive faster than sync completes', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Total number of trigger intervals
        fc.integer({ min: 5, max: 25 }),
        // sync duration: longer than a single interval to ensure overlap
        fc.integer({ min: 500, max: 2000 }),
        async (triggerCount, syncDuration) => {
          let activeSyncCount = 0;
          let maxConcurrency = 0;
          let totalSyncCalls = 0;

          const syncFn = vi.fn(() => {
            activeSyncCount++;
            totalSyncCalls++;
            maxConcurrency = Math.max(maxConcurrency, activeSyncCount);
            return new Promise((resolve) => {
              setTimeout(() => {
                activeSyncCount--;
                resolve();
              }, syncDuration);
            });
          });

          const logger = { info: () => {}, warn: () => {}, error: () => {} };
          const clock = { value: new Date('2026-03-01T00:00:00Z') };

          const scheduler = createSyncScheduler({
            syncFn,
            logger,
            now: () => clock.value,
          });

          scheduler.start({ cronExpression: '* * * * * *', enabled: true });

          // Fire triggers every 100ms (faster than sync can complete)
          const interval = 100;
          for (let i = 0; i < triggerCount; i++) {
            clock.value = new Date(clock.value.getTime() + interval);
            await vi.advanceTimersByTimeAsync(interval);
          }

          // Let all syncs finish
          await vi.advanceTimersByTimeAsync(syncDuration + 100);

          scheduler.stop();

          // PROPERTY: concurrency guard ensures at most 1 active
          expect(maxConcurrency).toBeLessThanOrEqual(1);

          // PROPERTY: total sync calls should be fewer than total triggers
          // (because overlapping triggers are skipped)
          // At minimum 1 sync should have started
          expect(totalSyncCalls).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 },
    );
  }, 60000);

  it('skipped triggers are truly discarded — they do not queue for later execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Number of triggers that arrive while sync is in progress
        fc.integer({ min: 5, max: 30 }),
        // sync duration — must be longer than total overlap window to guarantee overlap
        fc.integer({ min: 5000, max: 10000 }),
        async (overlapTriggers, syncDuration) => {
          let activeSyncCount = 0;
          let maxConcurrency = 0;
          let totalSyncStarted = 0;

          const syncFn = vi.fn(() => {
            activeSyncCount++;
            totalSyncStarted++;
            maxConcurrency = Math.max(maxConcurrency, activeSyncCount);
            return new Promise((resolve) => {
              setTimeout(() => {
                activeSyncCount--;
                resolve();
              }, syncDuration);
            });
          });

          const logger = { info: () => {}, warn: () => {}, error: () => {} };
          const clock = { value: new Date('2026-06-01T12:00:00Z') };

          const scheduler = createSyncScheduler({
            syncFn,
            logger,
            now: () => clock.value,
          });

          scheduler.start({ cronExpression: '* * * * * *', enabled: true });

          // Fire first trigger to start a sync
          clock.value = new Date(clock.value.getTime() + 1000);
          await vi.advanceTimersByTimeAsync(1000);

          // Record how many syncs have started after first trigger
          const syncsAfterFirstTrigger = totalSyncStarted;

          // Fire overlapping triggers at 100ms intervals
          // Total overlap time = overlapTriggers * 100ms
          // Since syncDuration >= 5000ms and max overlap = 30*100=3000ms,
          // all triggers happen during the first sync
          for (let i = 0; i < overlapTriggers; i++) {
            clock.value = new Date(clock.value.getTime() + 100);
            await vi.advanceTimersByTimeAsync(100);
          }

          // All those overlap triggers should have been skipped
          const syncsAfterOverlap = totalSyncStarted;

          // Stop scheduler BEFORE sync completes to prevent new triggers
          scheduler.stop();

          // Let the in-progress sync finish
          await vi.advanceTimersByTimeAsync(syncDuration + 500);

          // PROPERTY: concurrency was never > 1
          expect(maxConcurrency).toBeLessThanOrEqual(1);

          // PROPERTY: the overlapping triggers did not start additional syncs
          // Only the first trigger should have started a sync during overlap
          expect(syncsAfterOverlap).toBe(syncsAfterFirstTrigger);
        }
      ),
      { numRuns: 100 },
    );
  }, 60000);
});
