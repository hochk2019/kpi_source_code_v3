import { describe, expect, it, vi } from 'vitest';

import { createEcusBridgeApiClient } from '../apps/ecus-bridge/src/bridgeApiClient.js';

function createJsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

describe('ecus bridge api client', () => {
  it('fetches sync config from the core API using the bridge token', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        ok: true,
        config: {
          query: 'SELECT * FROM dbo.ECUS_DECLARATIONS',
          batchSize: 25,
          rangeDays: 3,
          includeTaxCodes: ['0312345678'],
          excludeTaxCodes: [],
        },
      })
    );

    const client = createEcusBridgeApiClient({
      baseUrl: 'http://core-api.local',
      token: 'bridge-secret',
      fetchImpl,
    });

    const config = await client.fetchSyncConfig();

    expect(config).toEqual({
      query: 'SELECT * FROM dbo.ECUS_DECLARATIONS',
      batchSize: 25,
      rangeDays: 3,
      includeTaxCodes: ['0312345678'],
      excludeTaxCodes: [],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://core-api.local/api/v4/declarations/imports/ecus-config',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer bridge-secret',
        }),
      })
    );
  });

  it('retries transient commit failures before succeeding', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          result: { imported: 2, fetched: 2, updated: 0, skipped: 0, reviewLocked: 0 },
        })
      );

    const client = createEcusBridgeApiClient({
      baseUrl: 'http://core-api.local',
      token: 'bridge-secret',
      retryDelaysMs: [0],
      fetchImpl,
    });

    const result = await client.commitDeclarations({
      rawRows: [{ so_tk: 'TK001', mst: '0312345678' }],
      range: { from: '2026-03-01', to: '2026-03-05' },
      actor: 'bridge-service',
      reason: 'manual',
      fetchedTotal: 1,
    });

    expect(result).toEqual({ imported: 2, fetched: 2, updated: 0, skipped: 0, reviewLocked: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'http://core-api.local/api/v4/declarations/imports/ecus-commit',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer bridge-secret',
        }),
      })
    );
  });
});
