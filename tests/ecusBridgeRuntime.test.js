import { describe, expect, it, vi } from 'vitest';

import { createStandaloneEcusBridgeRuntime } from '../apps/ecus-bridge/src/bridgeRuntime.js';

describe('standalone ecus bridge runtime', () => {
  it('fetches SQL rows and sends them to the core API preview contract', async () => {
    const bridgeService = {
      checkSqlServerHealth: vi.fn(async () => ({ ok: true, state: 'ready' })),
      async *fetchDeclarations() {
        yield [{ so_tk: 'TK001', mst: '0312345678' }];
        yield [{ so_tk: 'TK002', mst: '0399999999' }];
      },
    };

    const apiClient = {
      fetchSyncConfig: vi.fn(async () => ({
        query: 'SELECT * FROM dbo.ECUS_DECLARATIONS',
        batchSize: 50,
        rangeDays: 3,
        includeTaxCodes: [],
        excludeTaxCodes: [],
      })),
      previewDeclarations: vi.fn(async ({ rawRows, range }) => ({
        rows: rawRows.map((row) => ({ ...row, status: 'new' })),
        fetched: rawRows.length,
        range,
      })),
      commitDeclarations: vi.fn(),
    };

    const runtime = createStandaloneEcusBridgeRuntime({ bridgeService, apiClient });

    const preview = await runtime.previewSync({
      from: '2026-03-01',
      to: '2026-03-05',
      limit: 50,
    });

    expect(apiClient.fetchSyncConfig).toHaveBeenCalledTimes(1);
    expect(apiClient.previewDeclarations).toHaveBeenCalledWith(
      expect.objectContaining({
        rawRows: [
          { so_tk: 'TK001', mst: '0312345678' },
          { so_tk: 'TK002', mst: '0399999999' },
        ],
        range: { from: '2026-03-01', to: '2026-03-05' },
        limit: 50,
      })
    );
    expect(preview.rows).toHaveLength(2);
  });

  it('aggregates fetched SQL rows and commits them through the core API contract', async () => {
    const bridgeService = {
      checkSqlServerHealth: vi.fn(async () => ({ ok: true, state: 'ready' })),
      async *fetchDeclarations() {
        yield [{ so_tk: 'TK001', mst: '0312345678' }];
        yield [{ so_tk: 'TK002', mst: '0399999999' }];
      },
    };

    const apiClient = {
      fetchSyncConfig: vi.fn(async () => ({
        query: 'SELECT * FROM dbo.ECUS_DECLARATIONS',
        batchSize: 25,
        rangeDays: 1,
        includeTaxCodes: ['0312345678'],
        excludeTaxCodes: [],
      })),
      previewDeclarations: vi.fn(),
      commitDeclarations: vi.fn(async ({ rawRows, fetchedTotal, actor, reason }) => ({
        imported: rawRows.length,
        fetched: fetchedTotal,
        updated: 0,
        skipped: 0,
        reviewLocked: 0,
        actor,
        reason,
      })),
    };

    const runtime = createStandaloneEcusBridgeRuntime({ bridgeService, apiClient });

    const result = await runtime.runSync({
      actor: 'bridge-service',
      reason: 'scheduled',
      from: '2026-03-01',
      to: '2026-03-02',
    });

    expect(apiClient.commitDeclarations).toHaveBeenCalledWith(
      expect.objectContaining({
        rawRows: [
          { so_tk: 'TK001', mst: '0312345678' },
          { so_tk: 'TK002', mst: '0399999999' },
        ],
        fetchedTotal: 2,
        actor: 'bridge-service',
        reason: 'scheduled',
        range: { from: '2026-03-01', to: '2026-03-02' },
      })
    );
    expect(result.imported).toBe(2);
    expect(result.fetched).toBe(2);
  });
});
