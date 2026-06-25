// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createStandaloneEcusBridgeHttpHandler } from '../../apps/ecus-bridge/src/bridgeHttpServer.js';
import { createHealthMonitor, checkStaleData, computeStats } from '../../apps/ecus-bridge/src/healthMonitor.js';

/* ---------- Helpers -------------------------------------------------------- */

function createMockHost({ health = { ok: true }, busy = false } = {}) {
  return {
    getStatus: vi.fn(async () => ({
      busy,
      activeOperation: null,
      health,
      lastPreviewAt: null,
      lastPreviewSummary: null,
      lastRunAt: null,
      lastRunSummary: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastFailure: null,
    })),
    previewSync: vi.fn(async () => ({})),
    runSync: vi.fn(async () => ({})),
  };
}

function createMockRetryEngine(queueDepth = 0) {
  return { getQueueDepth: vi.fn(async () => queueDepth) };
}

function fakeRequest(method, path) {
  return { method, url: path, headers: {} };
}

function fakeResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { res.headers[key] = value; },
    end(data) { res.body = data ? JSON.parse(data) : null; },
  };
  return res;
}

/* ---------- Tests: HealthMonitor unit tests -------------------------------- */

describe('HealthMonitor', () => {
  describe('checkStaleData (pure function)', () => {
    it('returns true when lastSyncTime is null', () => {
      expect(checkStaleData(null, 24)).toBe(true);
    });

    it('returns true when elapsed time exceeds threshold', () => {
      const lastSync = new Date('2026-01-01T00:00:00Z');
      const current = new Date('2026-01-02T01:00:00Z'); // 25h later
      expect(checkStaleData(lastSync, 24, current)).toBe(true);
    });

    it('returns false when within threshold', () => {
      const lastSync = new Date('2026-01-01T00:00:00Z');
      const current = new Date('2026-01-01T12:00:00Z'); // 12h later
      expect(checkStaleData(lastSync, 24, current)).toBe(false);
    });

    it('returns false at exactly the boundary (not exceeded)', () => {
      const lastSync = new Date('2026-01-01T00:00:00Z');
      const current = new Date('2026-01-02T00:00:00Z'); // exactly 24h
      expect(checkStaleData(lastSync, 24, current)).toBe(false);
    });

    it('accepts ISO-8601 string for lastSyncTime', () => {
      const current = new Date('2026-01-03T00:00:00Z');
      expect(checkStaleData('2026-01-01T00:00:00Z', 24, current)).toBe(true);
    });
  });

  describe('computeStats (pure function)', () => {
    it('returns zeros for empty array', () => {
      expect(computeStats([])).toEqual({ average: 0, p95: 0 });
    });

    it('computes correct average and p95 for a known set', () => {
      // 20 durations: 1..20
      const durations = Array.from({ length: 20 }, (_, i) => i + 1);
      const result = computeStats(durations);
      expect(result.average).toBe(10.5); // sum(1..20)/20 = 210/20
      // p95 index = ceil(0.95 * 20) - 1 = ceil(19) - 1 = 18 → sorted[18] = 19
      expect(result.p95).toBe(19);
    });

    it('computes p95 for single element', () => {
      expect(computeStats([42])).toEqual({ average: 42, p95: 42 });
    });
  });

  describe('createHealthMonitor integration', () => {
    it('reports unhealthy when no syncs have been recorded (stale data)', async () => {
      const host = createMockHost({ health: { ok: true } });
      const retryEngine = createMockRetryEngine(0);
      const monitor = createHealthMonitor({
        host,
        retryEngine,
        staleThresholdHours: 24,
        now: () => new Date('2026-06-01T12:00:00Z'),
      });

      const report = await monitor.getHealth();
      expect(report.status).toBe('unhealthy');
      expect(report.staleDataAlert).toBe(true);
      expect(report.lastSuccessfulSync).toBeNull();
      expect(report.queueDepth).toBe(0);
      expect(report.errorCount).toBe(0);
    });

    it('reports healthy after a recent successful sync', async () => {
      const host = createMockHost({ health: { ok: true } });
      const retryEngine = createMockRetryEngine(0);
      const fixedNow = new Date('2026-06-01T12:00:00Z');
      const monitor = createHealthMonitor({
        host,
        retryEngine,
        staleThresholdHours: 24,
        now: () => fixedNow,
      });

      monitor.recordSync({
        startedAt: '2026-06-01T11:50:00Z',
        completedAt: '2026-06-01T11:55:00Z',
        rowsFetched: 100,
        rowsCommitted: 100,
        outcome: 'success',
        durationMs: 300000,
      });

      const report = await monitor.getHealth();
      expect(report.status).toBe('healthy');
      expect(report.connectionStatus).toBe('connected');
      expect(report.staleDataAlert).toBe(false);
      expect(report.lastSuccessfulSync).toBe('2026-06-01T11:55:00Z');
      expect(report.averageSyncDurationMs).toBe(300000);
    });

    it('reports degraded when queue has items', async () => {
      const host = createMockHost({ health: { ok: true } });
      const retryEngine = createMockRetryEngine(3);
      const fixedNow = new Date('2026-06-01T12:00:00Z');
      const monitor = createHealthMonitor({
        host,
        retryEngine,
        staleThresholdHours: 24,
        now: () => fixedNow,
      });

      monitor.recordSync({
        startedAt: '2026-06-01T11:50:00Z',
        completedAt: '2026-06-01T11:55:00Z',
        rowsFetched: 50,
        rowsCommitted: 50,
        outcome: 'success',
        durationMs: 300000,
      });

      const report = await monitor.getHealth();
      expect(report.status).toBe('degraded');
      expect(report.queueDepth).toBe(3);
    });

    it('includes degradationDetails when SQL Server reports degradation (Req 10.5)', async () => {
      const host = createMockHost({
        health: { ok: false, state: 'degraded', message: 'High CPU on SQL Server' },
      });
      const retryEngine = createMockRetryEngine(0);
      const fixedNow = new Date('2026-06-01T12:00:00Z');
      const monitor = createHealthMonitor({
        host,
        retryEngine,
        staleThresholdHours: 24,
        now: () => fixedNow,
      });

      monitor.recordSync({
        startedAt: '2026-06-01T11:50:00Z',
        completedAt: '2026-06-01T11:55:00Z',
        rowsFetched: 100,
        rowsCommitted: 100,
        outcome: 'success',
        durationMs: 300000,
      });

      const report = await monitor.getHealth();
      expect(report.connectionStatus).toBe('degraded');
      expect(report.degradationDetails).toBe('High CPU on SQL Server');
    });

    it('increments errorCount on failure outcomes', async () => {
      const monitor = createHealthMonitor({
        staleThresholdHours: 24,
        now: () => new Date('2026-06-01T12:00:00Z'),
      });

      monitor.recordSync({
        startedAt: '2026-06-01T11:50:00Z',
        completedAt: '2026-06-01T11:55:00Z',
        rowsFetched: 0,
        rowsCommitted: 0,
        outcome: 'failure',
        errorMessage: 'Connection timeout',
        durationMs: 5000,
      });

      expect(monitor.getErrorCount()).toBe(1);
    });
  });
});

/* ---------- Tests: Health HTTP endpoint ------------------------------------ */

describe('GET /health endpoint with HealthMonitor', () => {
  it('returns full HealthReport JSON when healthMonitor is provided', async () => {
    const host = createMockHost({ health: { ok: true } });
    const retryEngine = createMockRetryEngine(0);
    const fixedNow = new Date('2026-06-01T12:00:00Z');
    const healthMonitor = createHealthMonitor({
      host,
      retryEngine,
      staleThresholdHours: 24,
      now: () => fixedNow,
    });

    // Record a recent successful sync
    healthMonitor.recordSync({
      startedAt: '2026-06-01T11:50:00Z',
      completedAt: '2026-06-01T11:55:00Z',
      rowsFetched: 200,
      rowsCommitted: 200,
      outcome: 'success',
      durationMs: 300000,
    });

    const handler = createStandaloneEcusBridgeHttpHandler({
      host,
      healthMonitor,
    });

    const req = fakeRequest('GET', '/health');
    const res = fakeResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('ecus-bridge');
    expect(res.body.status).toBe('healthy');
    expect(res.body.connectionStatus).toBe('connected');
    expect(res.body.lastSuccessfulSync).toBe('2026-06-01T11:55:00Z');
    expect(res.body.queueDepth).toBe(0);
    expect(res.body.errorCount).toBe(0);
    expect(res.body.staleDataAlert).toBe(false);
    expect(res.body.averageSyncDurationMs).toBe(300000);
    expect(res.body.p95SyncDurationMs).toBe(300000);
  });

  it('returns 503 when health status is unhealthy', async () => {
    const host = createMockHost({ health: { ok: false, state: 'error', message: 'SQL down' } });
    const retryEngine = createMockRetryEngine(5);
    const healthMonitor = createHealthMonitor({
      host,
      retryEngine,
      staleThresholdHours: 24,
      now: () => new Date('2026-06-01T12:00:00Z'),
    });

    const handler = createStandaloneEcusBridgeHttpHandler({
      host,
      healthMonitor,
    });

    const req = fakeRequest('GET', '/health');
    const res = fakeResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.staleDataAlert).toBe(true);
  });

  it('falls back to legacy host.getStatus when no healthMonitor', async () => {
    const host = createMockHost({ health: { ok: true } });
    const handler = createStandaloneEcusBridgeHttpHandler({ host });

    const req = fakeRequest('GET', '/health');
    const res = fakeResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBeDefined(); // legacy status object
    expect(host.getStatus).toHaveBeenCalledWith({ refreshHealth: true });
  });

  it('includes degradationDetails in response when SQL Server degraded', async () => {
    const host = createMockHost({
      health: { ok: false, state: 'degraded', message: 'Disk I/O latency high' },
    });
    const retryEngine = createMockRetryEngine(0);
    const fixedNow = new Date('2026-06-01T12:00:00Z');
    const healthMonitor = createHealthMonitor({
      host,
      retryEngine,
      staleThresholdHours: 24,
      now: () => fixedNow,
    });

    // Record a recent sync so it's not stale
    healthMonitor.recordSync({
      startedAt: '2026-06-01T11:50:00Z',
      completedAt: '2026-06-01T11:55:00Z',
      rowsFetched: 50,
      rowsCommitted: 50,
      outcome: 'success',
      durationMs: 300000,
    });

    const handler = createStandaloneEcusBridgeHttpHandler({
      host,
      healthMonitor,
    });

    const req = fakeRequest('GET', '/health');
    const res = fakeResponse();
    await handler(req, res);

    expect(res.body.degradationDetails).toBe('Disk I/O latency high');
    expect(res.body.connectionStatus).toBe('degraded');
  });
});
