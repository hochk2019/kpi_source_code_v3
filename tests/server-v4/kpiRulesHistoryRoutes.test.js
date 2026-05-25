import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { buildV4App } from '../../server-v4/src/index.ts';
import { kpiRulesModule } from '../../server-v4/src/modules/kpi-rules/kpi-rules.module.ts';

describe('server-v4 KPI rules history route wiring', () => {
  it('returns 503 when rules history runtime is not configured', async () => {
    const app = buildV4App({
      modules: [kpiRulesModule],
      persistence: {
        mode: 'postgres',
        sourceKind: 'relational-store',
        kpiRulesReader: createKpiRulesReaderStub(),
        dispose: async () => {},
      },
    });

    const response = await request(app).get('/api/v4/kpi-rules/history');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      ok: false,
      error: expect.stringContaining('runtime'),
    });
  });

  it('delegates /history requests to the injected runtime handler', async () => {
    const historyHandler = vi.fn(async (_req, res) => {
      res.json({
        ok: true,
        history: [{ id: 'rule-history-1', actor: 'manager', action: 'kpi.rules.activate' }],
      });
    });

    const app = buildV4App({
      modules: [kpiRulesModule],
      kpiRules: {
        getRulesHistory: historyHandler,
      },
      persistence: {
        mode: 'postgres',
        sourceKind: 'relational-store',
        kpiRulesReader: createKpiRulesReaderStub(),
        dispose: async () => {},
      },
    });

    const response = await request(app).get('/api/v4/kpi-rules/history');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      history: [{ id: 'rule-history-1', actor: 'manager', action: 'kpi.rules.activate' }],
    });
    expect(historyHandler).toHaveBeenCalledTimes(1);
  });
});

function createKpiRulesReaderStub() {
  return {
    getSourceKind: () => 'relational-store',
    getHotPathKeys: () => [],
    getLegacyDbFile: () => null,
    readRuleCollection: vi.fn(async () => ({
      version: 2,
      activeId: 'postgres-kpi',
      sets: [],
    })),
  };
}
