import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { ADMIN_ROLE } from '../../packages/domain/src/accountRoles.js';
import { createDefaultKpiRuleCollection } from '../../server-v4/src/modules/kpi-rules/kpiRuleDefaults.ts';
import { createStandaloneReportingRuntime } from '../../server-v4/src/modules/reporting/reportingRuntime.ts';

function createProjectionPersistence() {
  const store = new Map();
  return {
    readValue: async (key) => store.get(key) ?? null,
    writeValue: async (key, value) => {
      store.set(key, value);
    },
    deleteValue: async (key) => {
      store.delete(key);
    },
    readScheduleEntries: async () => [],
    readMonthlyAggregateEntries: async () => [],
    readJobRunEntries: async () => [],
  };
}

function createAuthStore(accounts, sessions) {
  return {
    listAccounts: async () => accounts,
    saveAccounts: async () => {},
    readSession: async (token) => sessions.get(token) ?? null,
    createSession: async () => null,
    deleteSession: async () => {},
    deleteSessionsForUser: async () => {},
  };
}

function createReadersStub() {
  return {
    adjustmentsReader: {
      readAdjustmentRows: async () => [],
    },
    declarationsReader: {
      readDeclarationRows: async () => [],
    },
    kpiRulesReader: {
      readRuleCollection: async () => createDefaultKpiRuleCollection(),
    },
    teamsReader: {
      readTeamRoster: async () => ({ version: 1, teams: [] }),
    },
  };
}

function createApp(runtime) {
  const app = express();
  app.use(express.json());
  app.post('/api/v4/reporting/exports', (req, res) => runtime.exportReport(req, res));
  app.get('/api/v4/reporting/exports/audit', (req, res) => runtime.listExportAudit(req, res));
  app.get('/api/v4/reporting/audit/export', (req, res) => runtime.exportAdminAudit(req, res));
  return app;
}

describe('server-v4 standalone reporting runtime', () => {
  it('returns 401 when exporting report without an authenticated session', async () => {
    const runtime = createStandaloneReportingRuntime({
      authStore: createAuthStore([], new Map()),
      projections: createProjectionPersistence(),
      readers: createReadersStub(),
    });
    const app = createApp(runtime);

    const response = await request(app).post('/api/v4/reporting/exports').send({
      kind: 'allStaff',
      payload: {
        source: 'reporting-v4',
        query: { from: '2026-03-01', to: '2026-03-31' },
      },
    });

    expect(response.status).toBe(401);
    expect(response.body?.ok).toBe(false);
  });

  it('exports report and persists audit entries/views in projection storage', async () => {
    const token = 'token-admin';
    const sessions = new Map([
      [
        token,
        {
          token,
          username: 'admin',
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        },
      ],
    ]);
    const accounts = [
      {
        username: 'admin',
        passwordHash: 'hash',
        role: ADMIN_ROLE,
        name: 'Quản trị viên',
        permissions: {
          reportsExport: true,
          auditView: true,
          accountManage: true,
        },
        updatedAt: new Date().toISOString(),
        memberId: null,
        memberName: null,
        teamId: null,
        teamName: null,
      },
    ];
    const projections = createProjectionPersistence();
    let idCounter = 0;
    const runtime = createStandaloneReportingRuntime(
      {
        authStore: createAuthStore(accounts, sessions),
        projections,
        readers: createReadersStub(),
      },
      {
        randomUUID: () => `id-${++idCounter}`,
        now: () => new Date('2026-04-01T01:02:03.000Z'),
        exportGenerator: async () => ({
          buffer: Buffer.from('fake-xlsx'),
          filename: 'bao-cao-test.xlsx',
          signature: 'signature-1',
          watermark: {
            issuedAt: new Date('2026-04-01T01:02:03.000Z'),
            formattedIssuedAt: '2026-04-01 08:02:03',
            shortSignature: 'ABCD1234',
            requestId: 'req-1',
            filterSummary: 'Từ 2026-03-01 đến 2026-03-31',
            filters: {
              source: 'reporting-v4',
            },
          },
        }),
      },
    );
    const app = createApp(runtime);

    const exportResponse = await request(app)
      .post('/api/v4/reporting/exports')
      .set('Cookie', `kpi_session=${token}`)
      .send({
        kind: 'allStaff',
        payload: {
          source: 'reporting-v4',
          query: { from: '2026-03-01', to: '2026-03-31' },
        },
      });

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.header['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(exportResponse.header['content-disposition']).toContain('bao-cao-test.xlsx');
    expect(exportResponse.header['x-kpi-export-signature']).toBe('signature-1');

    const auditResponse = await request(app)
      .get('/api/v4/reporting/exports/audit?limit=25&page=1')
      .set('Cookie', `kpi_session=${token}`);

    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body?.ok).toBe(true);
    expect(Array.isArray(auditResponse.body?.entries)).toBe(true);
    expect(auditResponse.body.entries).toHaveLength(1);
    expect(auditResponse.body.entries[0]).toEqual(
      expect.objectContaining({
        reportKind: 'allStaff',
        filename: 'bao-cao-test.xlsx',
        signature: 'signature-1',
      }),
    );
    expect(auditResponse.body?.summary?.total).toBe(1);
    expect(auditResponse.body?.summary?.totalViews).toBe(1);

    const csvResponse = await request(app)
      .get('/api/v4/reporting/audit/export')
      .set('Cookie', `kpi_session=${token}`);

    expect(csvResponse.status).toBe(200);
    expect(csvResponse.header['content-type']).toContain('text/csv');
    expect(csvResponse.text).toContain('Loại báo cáo');
    expect(csvResponse.text).toContain('allStaff');
  });

  it('returns 403 when account lacks export-audit view permission', async () => {
    const token = 'token-staff';
    const sessions = new Map([
      [
        token,
        {
          token,
          username: 'staff',
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        },
      ],
    ]);
    const accounts = [
      {
        username: 'staff',
        passwordHash: 'hash',
        role: 'staff',
        name: 'Nhân viên',
        permissions: {
          reportsExport: true,
          auditView: false,
          accountManage: false,
        },
        updatedAt: new Date().toISOString(),
        memberId: null,
        memberName: null,
        teamId: null,
        teamName: null,
      },
    ];

    const runtime = createStandaloneReportingRuntime({
      authStore: createAuthStore(accounts, sessions),
      projections: createProjectionPersistence(),
      readers: createReadersStub(),
    });
    const app = createApp(runtime);

    const response = await request(app)
      .get('/api/v4/reporting/exports/audit')
      .set('Cookie', `kpi_session=${token}`);

    expect(response.status).toBe(403);
    expect(response.body?.ok).toBe(false);
  });
});
