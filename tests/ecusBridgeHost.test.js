import { describe, expect, it, vi } from 'vitest';

import { createStandaloneEcusBridgeHost } from '../apps/ecus-bridge/src/bridgeHost.js';

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('standalone ecus bridge host', () => {
  it('reports idle status with SQL health when no sync is running', async () => {
    const runtime = {
      previewSync: vi.fn(),
      runSync: vi.fn(),
    };
    const bridgeService = {
      checkSqlServerHealth: vi.fn(async () => ({
        ok: true,
        state: 'ready',
        server: 'sql-host',
      })),
    };

    const host = createStandaloneEcusBridgeHost({ runtime, bridgeService });
    const status = await host.getStatus({ refreshHealth: true });

    expect(status).toEqual(
      expect.objectContaining({
        busy: false,
        activeOperation: null,
        health: expect.objectContaining({
          ok: true,
          state: 'ready',
          server: 'sql-host',
        }),
        lastPreviewAt: null,
        lastRunAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailure: null,
      }),
    );
    expect(bridgeService.checkSqlServerHealth).toHaveBeenCalledTimes(1);
  });

  it('reuses the same in-flight run promise and records the final summary', async () => {
    const deferred = createDeferred();
    const runtime = {
      previewSync: vi.fn(),
      runSync: vi.fn(() => deferred.promise),
    };
    const host = createStandaloneEcusBridgeHost({ runtime });

    const firstRun = host.runSync({ actor: 'bridge-service' });
    const secondRun = host.runSync({ actor: 'bridge-service' });

    expect(runtime.runSync).toHaveBeenCalledTimes(1);
    expect(firstRun).toBe(secondRun);

    const busyStatus = await host.getStatus();
    expect(busyStatus).toEqual(
      expect.objectContaining({
        busy: true,
        activeOperation: 'run',
      }),
    );

    deferred.resolve({ imported: 4, updated: 1, skipped: 0 });
    const result = await firstRun;

    expect(result).toEqual({ imported: 4, updated: 1, skipped: 0 });

    const finalStatus = await host.getStatus();
    expect(finalStatus).toEqual(
      expect.objectContaining({
        busy: false,
        activeOperation: null,
        lastRunSummary: { imported: 4, updated: 1, skipped: 0 },
      }),
    );
    expect(finalStatus.lastRunAt).toBeTypeOf('string');
    expect(finalStatus.lastSuccessAt).toBeTypeOf('string');
  });

  it('rejects preview calls while a run is already active', async () => {
    const deferred = createDeferred();
    const runtime = {
      previewSync: vi.fn(),
      runSync: vi.fn(() => deferred.promise),
    };
    const host = createStandaloneEcusBridgeHost({ runtime });

    const runPromise = host.runSync({ actor: 'bridge-service' });

    await expect(host.previewSync({ from: '2026-03-01' })).rejects.toMatchObject({
      code: 'bridge_busy',
    });

    deferred.resolve({ imported: 1 });
    await runPromise;
  });

  it('records the last failure and clears busy state after a failed run', async () => {
    const runtime = {
      previewSync: vi.fn(),
      runSync: vi.fn(async () => {
        throw new Error('SQL timeout');
      }),
    };
    const host = createStandaloneEcusBridgeHost({ runtime });

    await expect(host.runSync({ actor: 'bridge-service' })).rejects.toThrow('SQL timeout');

    const status = await host.getStatus();
    expect(status).toEqual(
      expect.objectContaining({
        busy: false,
        activeOperation: null,
        lastFailure: expect.objectContaining({
          message: 'SQL timeout',
          operation: 'run',
        }),
      }),
    );
    expect(status.lastFailureAt).toBeTypeOf('string');
  });
});
