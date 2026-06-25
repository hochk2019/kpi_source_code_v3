import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createHealthMonitor } from '../apps/ecus-bridge/src/healthMonitor.js';

describe('HealthMonitor', () => {
  /** @type {import('better-sqlite3').Database} */
  let db;
  let fixedNow;
  let idCounter;

  beforeEach(() => {
    db = new Database(':memory:');
    fixedNow = '2026-06-15T12:00:00.000Z';
    idCounter = 0;
  });

  afterEach(() => {
    db.close();
  });

  function createMonitor(overrides = {}) {
    return createHealthMonitor({
      db,
      now: () => fixedNow,
      generateId: () => `test-id-${++idCounter}`,
      logger: { warn: () => {}, info: () => {}, error: () => {} },
      ...overrides,
    });
  }

  describe('recordSync', () => {
    it('records a successful sync entry', async () => {
      const monitor = createMonitor();
      await monitor.recordSync({
        startedAt: new Date('2026-06-15T11:00:00.000Z'),
        completedAt: new Date('2026-06-15T11:05:00.000Z'),
        rowsFetched: 100,
        rowsCommitted: 95,
        outcome: 'success',
        durationMs: 300000,
      });

      const row = db.prepare('SELECT * FROM ecus_sync_history WHERE id = ?').get('test-id-1');
      expect(row).toBeTruthy();
      expect(row.started_at).toBe('2026-06-15T11:00:00.000Z');
      expect(row.completed_at).toBe('2026-06-15T11:05:00.000Z');
      expect(row.rows_fetched).toBe(100);
      expect(row.rows_committed).toBe(95);
      expect(row.outcome).toBe('success');
      expect(row.duration_ms).toBe(300000);
      expect(row.error_message).toBeNull();
    });

    it('records a failed sync entry with error message', async () => {
      const monitor = createMonitor();
      await monitor.recordSync({
        startedAt: '2026-06-15T11:00:00.000Z',
        completedAt: '2026-06-15T11:00:05.000Z',
        rowsFetched: 0,
        rowsCommitted: 0,
        outcome: 'failure',
        errorMessage: 'Connection timeout',
        durationMs: 5000,
      });

      const row = db.prepare('SELECT * FROM ecus_sync_history WHERE id = ?').get('test-id-1');
      expect(row.outcome).toBe('failure');
      expect(row.error_message).toBe('Connection timeout');
    });
  });

  describe('checkStaleData', () => {
    it('returns true when no successful sync exists', () => {
      const monitor = createMonitor();
      expect(monitor.checkStaleData(24)).toBe(true);
    });

    it('returns true when last sync exceeds threshold', async () => {
      const monitor = createMonitor();
      // Last sync 25 hours ago
      await monitor.recordSync({
        startedAt: '2026-06-14T10:00:00.000Z',
        completedAt: '2026-06-14T10:05:00.000Z',
        rowsFetched: 50,
        rowsCommitted: 50,
        outcome: 'success',
        durationMs: 300000,
      });

      expect(monitor.checkStaleData(24)).toBe(true);
    });

    it('returns false when last sync is within threshold', async () => {
      const monitor = createMonitor();
      // Last sync 1 hour ago
      await monitor.recordSync({
        startedAt: '2026-06-15T11:00:00.000Z',
        completedAt: '2026-06-15T11:05:00.000Z',
        rowsFetched: 50,
        rowsCommitted: 50,
        outcome: 'success',
        durationMs: 300000,
      });

      expect(monitor.checkStaleData(24)).toBe(false);
    });

    it('ignores failed syncs for stale-data calculation', async () => {
      const monitor = createMonitor();
      // Only a recent failure, no success
      await monitor.recordSync({
        startedAt: '2026-06-15T11:50:00.000Z',
        completedAt: '2026-06-15T11:50:05.000Z',
        rowsFetched: 0,
        rowsCommitted: 0,
        outcome: 'failure',
        errorMessage: 'error',
        durationMs: 5000,
      });

      expect(monitor.checkStaleData(24)).toBe(true);
    });

    it('uses default threshold when no argument provided', async () => {
      const monitor = createMonitor({ staleThresholdHours: 1 });
      // Last sync 2 hours ago
      await monitor.recordSync({
        startedAt: '2026-06-15T09:00:00.000Z',
        completedAt: '2026-06-15T09:05:00.000Z',
        rowsFetched: 50,
        rowsCommitted: 50,
        outcome: 'success',
        durationMs: 300000,
      });

      expect(monitor.checkStaleData()).toBe(true);
    });
  });

  describe('computeStats', () => {
    it('returns zeros when no history exists', () => {
      const monitor = createMonitor();
      const stats = monitor.computeStats(7);
      expect(stats.average).toBe(0);
      expect(stats.p95).toBe(0);
    });

    it('computes average correctly for single entry', async () => {
      const monitor = createMonitor();
      await monitor.recordSync({
        startedAt: '2026-06-15T10:00:00.000Z',
        completedAt: '2026-06-15T10:05:00.000Z',
        rowsFetched: 100,
        rowsCommitted: 100,
        outcome: 'success',
        durationMs: 5000,
      });

      const stats = monitor.computeStats(7);
      expect(stats.average).toBe(5000);
      expect(stats.p95).toBe(5000);
    });

    it('computes average = sum/count for multiple entries', async () => {
      const monitor = createMonitor();
      const durations = [1000, 2000, 3000, 4000, 5000];
      for (const d of durations) {
        await monitor.recordSync({
          startedAt: '2026-06-15T10:00:00.000Z',
          completedAt: '2026-06-15T10:05:00.000Z',
          rowsFetched: 10,
          rowsCommitted: 10,
          outcome: 'success',
          durationMs: d,
        });
      }

      const stats = monitor.computeStats(7);
      expect(stats.average).toBe(3000); // (1000+2000+3000+4000+5000) / 5 = 3000
    });

    it('computes p95 correctly (ceil(0.95*count)-th sorted value)', async () => {
      const monitor = createMonitor();
      // 20 entries with durations 100..2000
      for (let i = 1; i <= 20; i++) {
        await monitor.recordSync({
          startedAt: '2026-06-15T10:00:00.000Z',
          completedAt: '2026-06-15T10:05:00.000Z',
          rowsFetched: 10,
          rowsCommitted: 10,
          outcome: 'success',
          durationMs: i * 100,
        });
      }

      const stats = monitor.computeStats(7);
      // p95 index = ceil(0.95 * 20) - 1 = ceil(19) - 1 = 18 (0-indexed)
      // sorted: [100, 200, ..., 1900, 2000] → index 18 = 1900
      expect(stats.p95).toBe(1900);
    });

    it('excludes entries outside the window', async () => {
      const monitor = createMonitor();
      // Entry 8 days ago (outside 7-day window)
      await monitor.recordSync({
        startedAt: '2026-06-07T10:00:00.000Z',
        completedAt: '2026-06-07T10:05:00.000Z',
        rowsFetched: 10,
        rowsCommitted: 10,
        outcome: 'success',
        durationMs: 99999,
      });
      // Entry within window
      await monitor.recordSync({
        startedAt: '2026-06-15T10:00:00.000Z',
        completedAt: '2026-06-15T10:05:00.000Z',
        rowsFetched: 10,
        rowsCommitted: 10,
        outcome: 'success',
        durationMs: 2000,
      });

      const stats = monitor.computeStats(7);
      expect(stats.average).toBe(2000);
      expect(stats.p95).toBe(2000);
    });
  });

  describe('getHealth', () => {
    it('returns healthy status when connected with recent sync', async () => {
      const monitor = createMonitor({
        getConnectionStatus: async () => ({ connected: true }),
        getQueueDepth: async () => 0,
      });

      // Record a recent successful sync
      await monitor.recordSync({
        startedAt: '2026-06-15T11:50:00.000Z',
        completedAt: '2026-06-15T11:55:00.000Z',
        rowsFetched: 100,
        rowsCommitted: 100,
        outcome: 'success',
        durationMs: 300000,
      });

      const report = await monitor.getHealth();
      expect(report.status).toBe('healthy');
      expect(report.connectionStatus).toBe('connected');
      expect(report.lastSuccessfulSync).toBe('2026-06-15T11:55:00.000Z');
      expect(report.queueDepth).toBe(0);
      expect(report.staleDataAlert).toBe(false);
    });

    it('returns unhealthy when disconnected', async () => {
      const monitor = createMonitor({
        getConnectionStatus: async () => ({ connected: false }),
        getQueueDepth: async () => 0,
      });

      await monitor.recordSync({
        startedAt: '2026-06-15T11:50:00.000Z',
        completedAt: '2026-06-15T11:55:00.000Z',
        rowsFetched: 100,
        rowsCommitted: 100,
        outcome: 'success',
        durationMs: 300000,
      });

      const report = await monitor.getHealth();
      expect(report.status).toBe('unhealthy');
      expect(report.connectionStatus).toBe('disconnected');
    });

    it('returns degraded when connection is degraded', async () => {
      const monitor = createMonitor({
        getConnectionStatus: async () => ({ connected: true, degraded: true, details: 'High latency' }),
        getQueueDepth: async () => 0,
      });

      await monitor.recordSync({
        startedAt: '2026-06-15T11:50:00.000Z',
        completedAt: '2026-06-15T11:55:00.000Z',
        rowsFetched: 100,
        rowsCommitted: 100,
        outcome: 'success',
        durationMs: 300000,
      });

      const report = await monitor.getHealth();
      expect(report.status).toBe('degraded');
      expect(report.connectionStatus).toBe('degraded');
      expect(report.degradationDetails).toBe('High latency');
    });

    it('returns degraded when queue has items', async () => {
      const monitor = createMonitor({
        getConnectionStatus: async () => ({ connected: true }),
        getQueueDepth: async () => 3,
      });

      await monitor.recordSync({
        startedAt: '2026-06-15T11:50:00.000Z',
        completedAt: '2026-06-15T11:55:00.000Z',
        rowsFetched: 100,
        rowsCommitted: 100,
        outcome: 'success',
        durationMs: 300000,
      });

      const report = await monitor.getHealth();
      expect(report.status).toBe('degraded');
      expect(report.queueDepth).toBe(3);
    });

    it('reports error count from failure entries', async () => {
      const monitor = createMonitor();
      await monitor.recordSync({
        startedAt: '2026-06-15T11:50:00.000Z',
        completedAt: '2026-06-15T11:55:00.000Z',
        rowsFetched: 100,
        rowsCommitted: 100,
        outcome: 'success',
        durationMs: 300000,
      });
      await monitor.recordSync({
        startedAt: '2026-06-15T11:00:00.000Z',
        completedAt: '2026-06-15T11:00:05.000Z',
        rowsFetched: 0,
        rowsCommitted: 0,
        outcome: 'failure',
        errorMessage: 'timeout',
        durationMs: 5000,
      });

      const report = await monitor.getHealth();
      expect(report.errorCount).toBe(1);
    });
  });

  describe('factory validation', () => {
    it('throws if no db provided', () => {
      expect(() => createHealthMonitor({})).toThrow('requires a better-sqlite3 database handle');
    });
  });
});
