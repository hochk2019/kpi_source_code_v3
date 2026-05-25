import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import {
  DEFAULT_ROLE,
  MANAGER_ROLE,
  getPermissionTemplate,
} from '../../packages/domain/src/accountRoles.js';
import { buildV4App } from '../../server-v4/src/index.ts';
import { hqAgenciesModule } from '../../server-v4/src/modules/hq-agencies/hq-agencies.module.ts';

describe('server-v4 HQ agencies route', () => {
  it('lists filtered HQ bindings and history through the async HQ agencies seam', async () => {
    const hqAgenciesReader = {
      readBindings: vi.fn(async () => [
        {
          mst: '0101234567',
          company: 'Cong ty ABC Logistics',
          agent: 'Agent One, Agent Two',
          agents: ['Agent One', 'Agent Two'],
        },
        {
          mst: '0107654321',
          company: 'Cong ty XYZ Import',
          agent: 'Agent Three',
          agents: ['Agent Three'],
        },
      ]),
      readHistoryEntries: vi.fn(async () => [
        {
          id: 'history-1',
          mst: '0101234567',
          field: 'agents',
          from: 'Agent One',
          to: 'Agent One, Agent Two',
          actor: 'alice',
          timestamp: '2026-03-03T10:00:00.000Z',
          type: 'update',
        },
        {
          id: 'history-2',
          mst: '0101234567',
          field: 'company',
          from: 'Cong ty ABC',
          to: 'Cong ty ABC Logistics',
          actor: 'bob',
          timestamp: '2026-03-02T10:00:00.000Z',
          type: 'update',
        },
        {
          id: 'history-3',
          mst: '0107654321',
          field: 'agents',
          from: '',
          to: 'Agent Three',
          actor: 'carol',
          timestamp: '2026-03-01T10:00:00.000Z',
          type: 'create',
        },
      ]),
    };
    const app = buildV4App({
      modules: [hqAgenciesModule],
      persistence: {
        mode: 'postgres',
        sourceKind: 'relational-store',
        hqAgenciesReader,
        dispose: async () => {},
      },
    });

    const bindingsResponse = await request(app)
      .get('/api/v4/hq-agencies')
      .query({ company: 'abc', agent: 'two', limit: 5 });

    expect(bindingsResponse.status).toBe(200);
    expect(bindingsResponse.body.data).toEqual({
      total: 1,
      items: [
        {
          mst: '0101234567',
          company: 'Cong ty ABC Logistics',
          agent: 'Agent One, Agent Two',
          agents: ['Agent One', 'Agent Two'],
        },
      ],
    });

    const historyResponse = await request(app)
      .get('/api/v4/hq-agencies/history')
      .query({ mst: '0101234567', limit: 1 });

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data).toEqual({
      total: 2,
      items: [
        {
          id: 'history-1',
          mst: '0101234567',
          field: 'agents',
          from: 'Agent One',
          to: 'Agent One, Agent Two',
          actor: 'alice',
          timestamp: '2026-03-03T10:00:00.000Z',
          type: 'update',
        },
      ],
    });
    expect(hqAgenciesReader.readBindings).toHaveBeenCalledTimes(1);
    expect(hqAgenciesReader.readHistoryEntries).toHaveBeenCalledTimes(1);
  });

  it('validates HQ agency queries', async () => {
    const app = buildV4App({
      modules: [hqAgenciesModule],
      persistence: {
        mode: 'sqlite-dual-write',
        sourceKind: 'dual-write',
        hqAgenciesReader: {
          readBindings: async () => [],
          readHistoryEntries: async () => [],
        },
        dispose: async () => {},
      },
    });

    const response = await request(app)
      .get('/api/v4/hq-agencies/history')
      .query({ limit: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'validation_error',
    });
  });

  it('requires an authenticated session for HQ agency mutations', async () => {
    const runtime = createHqRuntimeStub();
    const app = buildV4App({
      modules: [hqAgenciesModule],
      persistence: {
        mode: 'postgres',
        sourceKind: 'relational-store',
        hqAgenciesReader: runtime.reader,
        hqAgenciesStore: runtime.store,
        authStore: createAuthStore([]),
        dispose: async () => {},
      },
    });

    const response = await request(app)
      .post('/api/v4/hq-agencies')
      .send({
        mst: '0101234567',
        company: 'Cong ty ABC Logistics',
        agents: ['Agent One'],
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'auth_required',
    });
  });

  it('owns HQ agency writes and deletes behind session-backed mstEdit permission', async () => {
    const runtime = createHqRuntimeStub();
    const authStore = createAuthStore([
      createAccount({
        username: 'manager',
        role: MANAGER_ROLE,
        name: 'Manager User',
      }),
      createAccount({
        username: 'staff',
        role: DEFAULT_ROLE,
        name: 'Staff User',
      }),
    ]);
    const app = buildV4App({
      modules: [hqAgenciesModule],
      persistence: {
        mode: 'postgres',
        sourceKind: 'relational-store',
        hqAgenciesReader: runtime.reader,
        hqAgenciesStore: runtime.store,
        authStore,
        dispose: async () => {},
      },
    });

    const forbiddenResponse = await request(app)
      .post('/api/v4/hq-agencies')
      .set(sessionHeaders('session-staff'))
      .send({
        mst: '0101234567',
        company: 'Cong ty ABC Logistics',
        agents: ['Agent One'],
      });

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error).toMatchObject({
      code: 'forbidden',
    });

    const createResponse = await request(app)
      .post('/api/v4/hq-agencies')
      .set(sessionHeaders('session-manager'))
      .send({
        mst: '0101234567',
        company: 'Cong ty ABC Logistics',
        agents: ['Agent One', 'Agent Two'],
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).toMatchObject({
      operation: 'create',
      historyCount: 2,
      binding: {
        mst: '0101234567',
        company: 'Cong ty ABC Logistics',
        agent: 'Agent One, Agent Two',
        agents: ['Agent One', 'Agent Two'],
      },
    });
    expect(runtime.store.upsertBinding).toHaveBeenCalledTimes(1);

    const updateResponse = await request(app)
      .post('/api/v4/hq-agencies')
      .set(sessionHeaders('session-manager'))
      .send({
        taxCode: '0101234567',
        companyName: 'Cong ty ABC Logistics Updated',
        agent: 'Agent Two; Agent Three',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data).toMatchObject({
      operation: 'update',
      historyCount: 2,
      binding: {
        mst: '0101234567',
        company: 'Cong ty ABC Logistics Updated',
        agent: 'Agent Two, Agent Three',
        agents: ['Agent Two', 'Agent Three'],
      },
    });
    expect(runtime.store.upsertBinding).toHaveBeenCalledTimes(2);

    const bindingsResponse = await request(app).get('/api/v4/hq-agencies').query({ mst: '0101234567' });
    expect(bindingsResponse.status).toBe(200);
    expect(bindingsResponse.body.data).toEqual({
      total: 1,
      items: [
        {
          mst: '0101234567',
          company: 'Cong ty ABC Logistics Updated',
          agent: 'Agent Two, Agent Three',
          agents: ['Agent Two', 'Agent Three'],
        },
      ],
    });

    const deleteResponse = await request(app)
      .delete('/api/v4/hq-agencies/0101234567')
      .set(sessionHeaders('session-manager'));

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data).toMatchObject({
      deleted: true,
      mst: '0101234567',
      historyCount: 2,
    });
    expect(runtime.store.deleteBinding).toHaveBeenCalledTimes(1);

    const historyResponse = await request(app)
      .get('/api/v4/hq-agencies/history')
      .query({ mst: '0101234567' });

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.total).toBe(6);
    expect(historyResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mst: '0101234567',
          field: 'company',
          type: 'create',
          to: 'Cong ty ABC Logistics',
        }),
        expect.objectContaining({
          mst: '0101234567',
          field: 'company',
          type: 'update',
          from: 'Cong ty ABC Logistics',
          to: 'Cong ty ABC Logistics Updated',
        }),
        expect.objectContaining({
          mst: '0101234567',
          field: 'agents',
          type: 'delete',
          from: 'Agent Two, Agent Three',
          to: '',
        }),
      ]),
    );

    const deletedBindingsResponse = await request(app).get('/api/v4/hq-agencies').query({ mst: '0101234567' });
    expect(deletedBindingsResponse.status).toBe(200);
    expect(deletedBindingsResponse.body.data).toEqual({
      total: 0,
      items: [],
    });
  });
});

const TEST_CSRF_TOKEN = 'test-csrf-token';

function sessionHeaders(sessionToken) {
  return {
    Cookie: `kpi_session=${sessionToken}; kpi_csrf=${TEST_CSRF_TOKEN}`,
    'X-CSRF-Token': TEST_CSRF_TOKEN,
  };
}
function createHqRuntimeStub() {
  const bindings = new Map();
  const historyEntries = [];
  let historyCounter = 0;

  return {
    reader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readBindings: vi.fn(async () =>
        Array.from(bindings.values()).map((entry) => clone(entry)),
      ),
      readHistoryEntries: vi.fn(async () => historyEntries.map((entry) => clone(entry))),
    },
    store: {
      upsertBinding: vi.fn(async (binding, entries) => {
        bindings.set(binding.mst, clone(binding));
        for (const entry of entries) {
          historyEntries.unshift({
            id: `history-${++historyCounter}`,
            ...clone(entry),
          });
        }
        return clone(binding);
      }),
      deleteBinding: vi.fn(async (mst, entries) => {
        bindings.delete(mst);
        for (const entry of entries) {
          historyEntries.unshift({
            id: `history-${++historyCounter}`,
            ...clone(entry),
          });
        }
      }),
    },
  };
}

function createAuthStore(accounts) {
  const sessions = new Map([
    [
      'session-manager',
      {
        token: 'session-manager',
        username: 'manager',
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


