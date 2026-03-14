import { describe, expect, it } from 'vitest';

import { PostgresHqAgenciesAsyncReader } from '../../server-v4/src/modules/hq-agencies/postgresHqAgenciesAsyncReader.ts';

describe('server-v4 postgres HQ agencies async reader', () => {
  it('groups canonical bindings and maps canonical history events into the legacy read shape', async () => {
    let queryIndex = 0;
    const fallbackReader = {
      getSourceKind: () => 'dual-write',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => ':memory:',
      readBindings: async () => [{ mst: 'fallback', company: 'Fallback', agent: 'Fallback', agents: ['Fallback'] }],
      readHistoryEntries: async () => [{ mst: 'fallback', field: 'company' }],
    };
    const reader = new PostgresHqAgenciesAsyncReader(fallbackReader, {
      query: async () => {
        queryIndex += 1;
        if (queryIndex === 1) {
          return {
            rows: [
              {
                tax_code: '0101234567',
                company_name: 'Cong ty A',
                agent_name: 'Agent One',
              },
              {
                tax_code: '0101234567',
                company_name: 'Cong ty A',
                agent_name: 'Agent Two',
              },
              {
                tax_code: '0107654321',
                company_name: 'Cong ty B',
                agent_name: 'Agent Three',
              },
            ],
          };
        }

        return {
          rows: [
            {
              id: '42',
              tax_code: '0101234567',
              event_type: 'update',
              payload: {
                field: 'agents',
                from: 'Agent One',
                to: ['Agent One', 'Agent Two'],
              },
              actor_username: 'alice',
              occurred_at: new Date('2026-03-01T10:00:00.000Z'),
            },
          ],
        };
      },
    });

    await expect(reader.readBindings()).resolves.toEqual([
      {
        mst: '0101234567',
        company: 'Cong ty A',
        agent: 'Agent One, Agent Two',
        agents: ['Agent One', 'Agent Two'],
      },
      {
        mst: '0107654321',
        company: 'Cong ty B',
        agent: 'Agent Three',
        agents: ['Agent Three'],
      },
    ]);

    await expect(reader.readHistoryEntries()).resolves.toEqual([
      {
        id: '42',
        mst: '0101234567',
        field: 'agents',
        from: 'Agent One',
        to: 'Agent One, Agent Two',
        actor: 'alice',
        timestamp: '2026-03-01T10:00:00.000Z',
        type: 'update',
      },
    ]);
  });
});
