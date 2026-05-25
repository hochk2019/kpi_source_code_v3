import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { buildV4App } from '../../server-v4/src/index.ts';
import { reportingModule } from '../../server-v4/src/modules/reporting/reporting.module.ts';

describe('server-v4 reporting export route wiring', () => {
  it('returns 503 when reporting export runtime is not configured', async () => {
    const app = buildV4App({
      modules: [reportingModule],
      persistence: createReportingPersistenceStub(),
    });

    const exportResponse = await request(app).post('/api/v4/reporting/exports').send({});
    expect(exportResponse.status).toBe(503);

    const auditResponse = await request(app).get('/api/v4/reporting/exports/audit');
    expect(auditResponse.status).toBe(503);

    const adminAuditResponse = await request(app).get('/api/v4/reporting/audit/export');
    expect(adminAuditResponse.status).toBe(503);
  });

  it('delegates report export routes to injected runtime handlers', async () => {
    const exportHandler = vi.fn(async (_req, res) => {
      res.status(201).json({ ok: true, exported: true });
    });
    const exportAuditHandler = vi.fn(async (_req, res) => {
      res.json({ ok: true, entries: [{ id: 'audit-1' }] });
    });
    const adminAuditHandler = vi.fn(async (_req, res) => {
      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.status(200).send('col1,col2\r\nvalue1,value2');
    });

    const app = buildV4App({
      modules: [reportingModule],
      reporting: {
        exportReport: exportHandler,
        listExportAudit: exportAuditHandler,
        exportAdminAudit: adminAuditHandler,
      },
      persistence: createReportingPersistenceStub(),
    });

    const exportResponse = await request(app).post('/api/v4/reporting/exports').send({ kind: 'summary' });
    expect(exportResponse.status).toBe(201);
    expect(exportResponse.body).toEqual({ ok: true, exported: true });

    const auditResponse = await request(app).get('/api/v4/reporting/exports/audit');
    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body).toEqual({ ok: true, entries: [{ id: 'audit-1' }] });

    const adminAuditResponse = await request(app).get('/api/v4/reporting/audit/export');
    expect(adminAuditResponse.status).toBe(200);
    expect(adminAuditResponse.text).toContain('col1,col2');

    expect(exportHandler).toHaveBeenCalledTimes(1);
    expect(exportAuditHandler).toHaveBeenCalledTimes(1);
    expect(adminAuditHandler).toHaveBeenCalledTimes(1);
  });
});

function createReportingPersistenceStub() {
  return {
    mode: 'postgres',
    sourceKind: 'relational-store',
    adjustmentsReader: {
      readAdjustmentRows: async () => [],
    },
    declarationsReader: {
      readDeclarationRows: async () => [],
    },
    kpiRulesReader: {
      readRuleCollection: async () => ({ version: 2, activeId: 'default', sets: [] }),
    },
    teamsReader: {
      readTeamRoster: async () => ({ version: 1, teams: [] }),
    },
    projections: {
      readValue: async () => null,
      writeValue: async () => {},
      deleteValue: async () => {},
      readScheduleEntries: async () => [],
      readMonthlyAggregateEntries: async () => [],
      readJobRunEntries: async () => [],
    },
    dispose: async () => {},
  };
}
