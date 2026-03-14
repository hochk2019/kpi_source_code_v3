import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import {
  ADMIN_ROLE,
  DEFAULT_ROLE,
  getPermissionTemplate,
} from '../../packages/domain/src/accountRoles.js';
import { buildV4App } from '../../server-v4/src/index.ts';
import { kpiAdjustmentsModule } from '../../server-v4/src/modules/kpi-adjustments/kpi-adjustments.module.ts';

describe('server-v4 kpi adjustments route', () => {
  it('lists filtered KPI adjustments through the async adjustments seam', async () => {
    const adjustmentsReader = {
      readAdjustmentRows: vi.fn(async () => [
        {
          id: 'adj-approved',
          category: 'support_dynamic',
          staffName: 'Lan',
          teamName: 'Blue Team',
          month: '2026-02',
          status: 'approved',
          totalPoints: 2.5,
          quantity: 3,
          updatedAt: '2026-03-01T09:00:00.000Z',
        },
        {
          id: 'adj-pending',
          category: 'cancel_staff',
          staff: 'Lan',
          team: 'Blue Team',
          period: '2026-02-15',
          status: 'pending',
          total: -1.5,
          updatedAt: '2026-03-02T09:00:00.000Z',
        },
        {
          id: 'adj-rejected',
          category: 'support_dynamic',
          staffName: 'Minh',
          teamName: 'Red Team',
          month: '2026-01',
          status: 'rejected',
          totalPoints: 1,
        },
      ]),
    };
    const app = buildV4App({
      modules: [kpiAdjustmentsModule],
      persistence: {
        mode: 'postgres',
        sourceKind: 'relational-store',
        adjustmentsReader,
        dispose: async () => {},
      },
    });

    const response = await request(app)
      .get('/api/v4/kpi-adjustments')
      .query({ month: '2026-02', staff: 'lan', team: 'blue', limit: 5 });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      total: 2,
      summary: {
        pendingCount: 1,
        approvedCount: 1,
        rejectedCount: 0,
        totalPoints: 1,
        approvedPoints: 2.5,
      },
    });
    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        id: 'adj-pending',
        category: 'cancel_staff',
        categoryLabel: 'Cancel Staff',
        month: '2026-02',
        status: 'pending',
        staffName: 'Lan',
        teamName: 'Blue Team',
        totalPoints: -1.5,
      }),
      expect.objectContaining({
        id: 'adj-approved',
        category: 'support_dynamic',
        categoryLabel: 'Support Dynamic',
        month: '2026-02',
        status: 'approved',
        staffName: 'Lan',
        teamName: 'Blue Team',
        totalPoints: 2.5,
      }),
    ]);
    expect(adjustmentsReader.readAdjustmentRows).toHaveBeenCalledTimes(1);
  });

  it('validates adjustment list queries', async () => {
    const app = buildV4App({
      modules: [kpiAdjustmentsModule],
      persistence: {
        mode: 'sqlite-dual-write',
        sourceKind: 'dual-write',
        adjustmentsReader: {
          readAdjustmentRows: async () => [],
        },
        dispose: async () => {},
      },
    });

    const response = await request(app)
      .get('/api/v4/kpi-adjustments')
      .query({ month: '2026-2', status: 'draft' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'validation_error',
    });
  });

  it('requires an authenticated session for mutation routes', async () => {
    const app = buildV4App({
      modules: [kpiAdjustmentsModule],
      persistence: {
        mode: 'postgres',
        sourceKind: 'relational-store',
        adjustmentsReader: {
          readAdjustmentRows: async () => [],
        },
        adjustmentsStore: createAdjustmentsStoreStub(),
        authStore: createAuthStore([]),
        dispose: async () => {},
      },
    });

    const response = await request(app).post('/api/v4/kpi-adjustments').send({
      category: 'support_misc',
      month: '2026-02',
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'auth_required',
    });
  });

  it('owns adjustment writes and settings writes behind session-backed permissions', async () => {
    const store = createAdjustmentsStoreStub();
    const authStore = createAuthStore([
      createAccount({
        username: 'admin',
        role: ADMIN_ROLE,
        name: 'Admin User',
      }),
      createAccount({
        username: 'staff',
        role: DEFAULT_ROLE,
        name: 'Staff User',
      }),
    ]);

    const app = buildV4App({
      modules: [kpiAdjustmentsModule],
      persistence: {
        mode: 'postgres',
        sourceKind: 'relational-store',
        adjustmentsReader: {
          readAdjustmentRows: async () => [],
        },
        adjustmentsStore: store,
        authStore,
        dispose: async () => {},
      },
    });

    const createResponse = await request(app)
      .post('/api/v4/kpi-adjustments')
      .set('Cookie', 'kpi_session=session-staff')
      .send({
        category: 'support_misc',
        month: '2026-02',
        staffName: 'Staff User',
        teamName: 'Blue Team',
        quantity: 2,
        unitPoints: 1.25,
        note: 'Need manual support credit',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).toMatchObject({
      category: 'support_misc',
      month: '2026-02',
      staffName: 'Staff User',
      status: 'pending',
      totalPoints: 2.5,
      categoryLabel: 'Support Misc',
    });
    expect(store.createAdjustment).toHaveBeenCalledTimes(1);
    expect(store.createAdjustment.mock.calls[0][0]).toMatchObject({
      category: 'support_misc',
      month: '2026-02',
      status: 'pending',
      totalPoints: 2.5,
      createdBy: 'staff',
      updatedBy: 'staff',
    });

    const createdId = createResponse.body.data.id;

    const settingsReadResponse = await request(app)
      .get('/api/v4/kpi-adjustments/settings')
      .set('Cookie', 'kpi_session=session-staff');

    expect(settingsReadResponse.status).toBe(200);
    expect(settingsReadResponse.body.data.autoApprove.enabled).toBe(false);

    const forbiddenSettingsResponse = await request(app)
      .put('/api/v4/kpi-adjustments/settings')
      .set('Cookie', 'kpi_session=session-staff')
      .send({
        autoApprove: {
          enabled: true,
        },
      });

    expect(forbiddenSettingsResponse.status).toBe(403);
    expect(forbiddenSettingsResponse.body.error).toMatchObject({
      code: 'forbidden',
    });

    const settingsUpdateResponse = await request(app)
      .put('/api/v4/kpi-adjustments/settings')
      .set('Cookie', 'kpi_session=session-admin')
      .send({
        autoApprove: {
          enabled: true,
          note: 'Auto-approve staff submissions during QA',
        },
      });

    expect(settingsUpdateResponse.status).toBe(200);
    expect(settingsUpdateResponse.body.data).toMatchObject({
      updatedBy: 'admin',
      autoApprove: expect.objectContaining({
        enabled: true,
        updatedBy: 'admin',
        note: 'Auto-approve staff submissions during QA',
      }),
    });
    expect(store.writeSettings).toHaveBeenCalledTimes(1);

    const autoApprovedCreateResponse = await request(app)
      .post('/api/v4/kpi-adjustments')
      .set('Cookie', 'kpi_session=session-staff')
      .send({
        category: 'support_misc',
        month: '2026-03',
        staffName: 'Staff User',
        quantity: 1,
        unitPoints: 3,
      });

    expect(autoApprovedCreateResponse.status).toBe(201);
    expect(autoApprovedCreateResponse.body.data).toMatchObject({
      status: 'approved',
      totalPoints: 3,
    });
    expect(store.createAdjustment).toHaveBeenCalledTimes(2);
    expect(store.createAdjustment.mock.calls[1][0]).toMatchObject({
      status: 'approved',
      approvedBy: 'admin',
      totalPoints: 3,
    });

    const patchResponse = await request(app)
      .patch(`/api/v4/kpi-adjustments/${createdId}`)
      .set('Cookie', 'kpi_session=session-admin')
      .send({
        status: 'approved',
        note: 'Approved after review',
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.data).toMatchObject({
      id: createdId,
      status: 'approved',
      categoryLabel: 'Support Misc',
    });
    expect(store.updateAdjustment).toHaveBeenCalledTimes(1);
    expect(store.updateAdjustment.mock.calls[0][0]).toMatchObject({
      id: createdId,
      status: 'approved',
      approvedBy: 'admin',
      updatedBy: 'admin',
    });
  });
});

function createAdjustmentsStoreStub() {
  const records = new Map();
  let settings = {
    categories: {},
    updatedAt: null,
    updatedBy: null,
    autoApprove: {
      enabled: false,
      note: null,
      updatedAt: null,
      updatedBy: null,
    },
  };

  return {
    readAdjustmentById: vi.fn(async (id) => clone(records.get(id) ?? null)),
    createAdjustment: vi.fn(async (record) => {
      records.set(record.id, clone(record));
      return clone(record);
    }),
    updateAdjustment: vi.fn(async (record) => {
      records.set(record.id, clone(record));
      return clone(record);
    }),
    readSettings: vi.fn(async () => clone(settings)),
    writeSettings: vi.fn(async (nextSettings) => {
      settings = clone(nextSettings);
      return clone(settings);
    }),
  };
}

function createAuthStore(accounts) {
  const sessions = new Map([
    [
      'session-admin',
      {
        token: 'session-admin',
        username: 'admin',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
    ],
    [
      'session-staff',
      {
        token: 'session-staff',
        username: 'staff',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
    ],
  ]);

  return {
    async listAccounts() {
      return clone(accounts);
    },
    async saveAccounts() {},
    async readSession(token) {
      return clone(sessions.get(token) ?? null);
    },
    async createSession(username) {
      const session = {
        token: `session-${username}`,
        username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      };
      sessions.set(session.token, session);
      return clone(session);
    },
    async deleteSession(token) {
      sessions.delete(token);
    },
    async deleteSessionsForUser(username) {
      for (const [token, session] of sessions.entries()) {
        if (session.username === username) {
          sessions.delete(token);
        }
      }
    },
  };
}

function createAccount({ username, role, name }) {
  return {
    username,
    passwordHash: 'unused-for-route-tests',
    role,
    name,
    permissions: getPermissionTemplate(role),
    memberId: null,
    memberName: null,
    teamId: null,
    teamName: null,
    updatedAt: '2026-03-14T00:00:00.000Z',
  };
}

function clone(value) {
  return value === null ? null : JSON.parse(JSON.stringify(value));
}
