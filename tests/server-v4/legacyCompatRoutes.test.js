import fs from 'node:fs/promises';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { ADMIN_ROLE, DEFAULT_ROLE, getPermissionTemplate } from '../../packages/domain/src/accountRoles.js';
import { buildV4App } from '../../server-v4/src/index.ts';
import { authModule } from '../../server-v4/src/modules/auth/auth.module.ts';
import { declarationsModule } from '../../server-v4/src/modules/declarations/declarations.module.ts';

describe('server-v4 legacy compatibility routes', () => {
  it('keeps legacy compatibility routing split into thin domain-specific builders', async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), 'server-v4', 'src', 'app', 'legacyCompatRoutes.ts'),
      'utf8',
    );

    expect(source).toContain('registerLegacyCompatAuthRoutes');
    expect(source).toContain('registerLegacyCompatBootstrapRoutes');
    expect(source).toContain('registerLegacyCompatImporterRoutes');
    expect(source).toContain('registerLegacyCompatStorageRoutes');
    expect(source.split(/\r?\n/u).length).toBeLessThan(260);
  });

  it('supports legacy auth payloads, bootstrap snapshots, and storage reads', async () => {
    const authStore = createAuthStore([
      createAccount({
        username: 'admin',
        password: 'admin123',
        role: ADMIN_ROLE,
        name: 'Admin User',
      }),
      createAccount({
        username: 'staff',
        password: 'staff123',
        role: DEFAULT_ROLE,
        name: 'Staff User',
      }),
    ]);
    const declarations = [
      {
        so_tk: '102030',
        ngay_dk: '2026-02-15',
        nhan_vien: 'Lan',
      },
    ];
    const rules = {
      version: 2,
      activeId: 'legacy-kpi',
      sets: [{ id: 'legacy-kpi', name: 'Legacy KPI' }],
    };
    const roster = {
      version: 1,
      teams: [{ id: 'team-blue', name: 'Blue Team', members: [{ id: 'lan', name: 'Lan' }] }],
    };
    const app = buildV4App({
      modules: [authModule],
      persistence: createPersistenceStub({
        authStore,
        declarations,
        rules,
        roster,
      }),
    });

    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin123',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toMatchObject({
      ok: true,
      user: {
        username: 'admin',
        role: ADMIN_ROLE,
        name: 'Admin User',
      },
    });

    const cookie = getCookie(loginResponse);

    const sessionResponse = await request(app).get('/api/auth/session').set('Cookie', cookie);
    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.user).toMatchObject({
      username: 'admin',
      role: ADMIN_ROLE,
    });

    const accountsResponse = await request(app).get('/api/auth/accounts').set('Cookie', cookie);
    expect(accountsResponse.status).toBe(200);
    expect(accountsResponse.body).toMatchObject({
      ok: true,
      accounts: [
        expect.objectContaining({ username: 'admin' }),
        expect.objectContaining({ username: 'staff' }),
      ],
    });

    const bootstrapResponse = await request(app).get('/api/bootstrap').set('Cookie', cookie);
    expect(bootstrapResponse.status).toBe(200);
    expect(bootstrapResponse.body.data).toMatchObject({
      decl_rows_v1: JSON.stringify(declarations),
      kpi_rules_v2: JSON.stringify(rules),
      team_roster_v1: JSON.stringify(roster),
    });
    expect(JSON.parse(bootstrapResponse.body.data.kpi_users_v1)).toEqual([
      expect.objectContaining({ username: 'admin', role: ADMIN_ROLE }),
      expect.objectContaining({ username: 'staff', role: DEFAULT_ROLE }),
    ]);

    const declarationsResponse = await request(app)
      .get('/api/storage/decl_rows_v1')
      .set('Cookie', cookie);
    expect(declarationsResponse.status).toBe(200);
    expect(declarationsResponse.body.value).toEqual(declarations);
    expect(declarationsResponse.body.raw).toBe(JSON.stringify(declarations));

    const rulesResponse = await request(app).get('/api/storage/kpi_rules_v2').set('Cookie', cookie);
    expect(rulesResponse.status).toBe(200);
    expect(rulesResponse.body.value).toEqual(rules);

    const rosterResponse = await request(app).get('/api/storage/team_roster_v1').set('Cookie', cookie);
    expect(rosterResponse.status).toBe(200);
    expect(rosterResponse.body.value).toEqual(roster);
  });

  it('returns 404 for the retired legacy deleted declarations route', async () => {
    const authStore = createAuthStore([
      createAccount({
        username: 'admin',
        password: 'admin123',
        role: ADMIN_ROLE,
        name: 'Admin User',
      }),
    ]);
    const app = buildV4App({
      modules: [authModule],
      persistence: createPersistenceStub({
        authStore,
        deletedDeclarations: [
          {
            so_tk: '102030',
            nhanh: '01',
            mst: '1234567890',
            company: 'Alpha Co',
            ten_dn: 'Alpha Co',
            type: 'hard',
            deleted_at: '2026-03-04T10:00:00.000Z',
            deleted_by: 'admin',
          },
          {
            so_tk: '202122',
            nhanh: '01',
            mst: '1234567891',
            company: 'Beta Co',
            ten_dn: 'Beta Co',
            type: 'soft',
            deleted_at: '2026-03-04T12:00:00.000Z',
            deleted_by: 'admin',
          },
          {
            so_tk: '303132',
            nhanh: '01',
            mst: '1234567892',
            company: 'Gamma Co',
            ten_dn: 'Gamma Co',
            type: 'hard',
            deleted_at: '2026-02-27T08:00:00.000Z',
            deleted_by: 'admin',
          },
        ],
      }),
    });

    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin123',
    });
    const cookie = getCookie(loginResponse);

    const response = await request(app)
      .get('/api/import/deleted-declarations?type=hard&from=2026-03-01&to=2026-03-05')
      .set('Cookie', cookie);

    expect(response.status).toBe(404);
  });

  it('tracks importer compat traffic and blocks migrated legacy routes when the guardrail is enabled', async () => {
    const authStore = createAuthStore([
      createAccount({
        username: 'admin',
        password: 'admin123',
        role: ADMIN_ROLE,
        name: 'Admin User',
      }),
    ]);
    const app = buildV4App({
      modules: [authModule, declarationsModule],
      importerCompat: {
        guardMode: 'block-migrated',
      },
      persistence: createPersistenceStub({
        authStore,
      }),
    });

    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin123',
    });
    const cookie = getCookie(loginResponse);

    const retiredAliasResponse = await request(app)
      .get('/api/import/deleted-declarations?type=hard&from=2026-03-01&to=2026-03-05')
      .set('Cookie', cookie);
    expect(retiredAliasResponse.status).toBe(404);

    const migratedResponse = await request(app)
      .get('/api/import/alerts')
      .set('Cookie', cookie);
    expect(migratedResponse.status).toBe(409);
    expect(migratedResponse.body).toMatchObject({
      ok: false,
      legacyRoute: '/api/import/alerts',
      canonicalRoute: '/api/v4/declarations/imports/alerts',
    });

    const rolloutResponse = await request(app).get('/api/v4/meta/rollout');
    expect(rolloutResponse.status).toBe(200);
    expect(rolloutResponse.body.compatibility.importerTraffic).toMatchObject({
      guardMode: 'block-migrated',
      totals: {
        hits: 1,
        migratedHits: 1,
        legacyOnlyHits: 0,
        blockedHits: 1,
      },
    });
    expect(
      rolloutResponse.body.compatibility.importerTraffic.routes.find(
        (entry) => entry.id === 'alerts-list',
      ),
    ).toMatchObject({
      kind: 'migrated',
      hitCount: 1,
      blockedCount: 1,
      canonicalPath: '/api/v4/declarations/imports/alerts',
    });
    expect(
      rolloutResponse.body.compatibility.importerTraffic.routes.find(
        (entry) => entry.id === 'deleted-declarations',
      ),
    ).toBeUndefined();
    expect(
      rolloutResponse.body.migrationVerification.checks.find(
        (entry) => entry.id === 'importer-compat-traffic',
      ),
    ).toMatchObject({
      status: 'warn',
    });
    expect(rolloutResponse.body.compatibility.declarationShadow.summary).toContain(
      'legacy compat traffic',
    );
    expect(
      rolloutResponse.body.compatibility.declarationShadow.groups.find(
        (entry) => entry.id === 'declarations-shadow-alerts',
      ),
    ).toMatchObject({
      status: 'warn',
      observedCompatHits: 1,
      blockedCompatHits: 1,
    });
  });

  it('rejects unauthenticated bootstrap/storage access and returns 404 for unknown keys', async () => {
    const authStore = createAuthStore([
      createAccount({
        username: 'admin',
        password: 'admin123',
        role: ADMIN_ROLE,
        name: 'Admin User',
      }),
    ]);
    const app = buildV4App({
      modules: [authModule],
      persistence: createPersistenceStub({ authStore }),
    });

    const unauthenticatedBootstrapResponse = await request(app).get('/api/bootstrap');
    expect(unauthenticatedBootstrapResponse.status).toBe(401);
    expect(unauthenticatedBootstrapResponse.body.error).toBe('Bạn cần đăng nhập.');

    const unauthenticatedResponse = await request(app).get('/api/storage/decl_rows_v1');
    expect(unauthenticatedResponse.status).toBe(401);
    expect(unauthenticatedResponse.body.error).toBe('Bạn cần đăng nhập.');

    const unauthenticatedDeletedDeclarationsResponse = await request(app).get(
      '/api/import/deleted-declarations',
    );
    expect(unauthenticatedDeletedDeclarationsResponse.status).toBe(404);

    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin123',
    });
    const cookie = getCookie(loginResponse);

    const unknownResponse = await request(app).get('/api/storage/unknown-key').set('Cookie', cookie);
    expect(unknownResponse.status).toBe(404);
    expect(unknownResponse.body.error).toContain('Unknown storage key');
  });
});

function createPersistenceStub({
  authStore,
  declarations = [],
  mstAssignments = [],
  rules = { version: 2, activeId: 'rule-v2', sets: [] },
  roster = { version: 1, teams: [] },
  bindings = [],
  hqHistory = [],
  deletedDeclarations = [],
  adjustments = [],
  adjustmentSettings = {
    categories: {},
    updatedAt: null,
    updatedBy: null,
    autoApprove: {
      enabled: false,
      note: null,
      updatedAt: null,
      updatedBy: null,
    },
  },
  schedules = [],
} = {}) {
  return {
    mode: 'postgres',
    sourceKind: 'relational-store',
    adjustmentsReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readAdjustmentRows: async () => clone(adjustments),
    },
    adjustmentsStore: {
      readAdjustmentById: async () => null,
      createAdjustment: async (record) => record,
      updateAdjustment: async (record) => record,
      readSettings: async () => clone(adjustmentSettings),
      writeSettings: async (settings) => settings,
    },
    authStore,
    declarationsReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readDeclarationRows: async () => clone(declarations),
    },
    declarationsStore: {
      patchDeclaration: async () => ({}),
      listDeclarationEvents: async () => [],
      listDeletedDeclarations: async ({ from = null, to = null, type = null } = {}) =>
        clone(deletedDeclarations).filter((entry) => {
          const normalizedType =
            type === 'hard' ? 'hard' : type === 'soft' ? 'soft' : null;
          const entryType = entry?.type === 'hard' ? 'hard' : 'soft';
          const entryDate = `${entry?.deleted_at ?? ''}`.trim().slice(0, 10);
          const fromDate = `${from ?? ''}`.trim().slice(0, 10);
          const toDate = `${to ?? ''}`.trim().slice(0, 10);

          if (normalizedType && entryType !== normalizedType) {
            return false;
          }
          if (fromDate && (!entryDate || entryDate < fromDate)) {
            return false;
          }
          if (toDate && (!entryDate || entryDate > toDate)) {
            return false;
          }

          return true;
        }),
    },
    hqAgenciesReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readBindings: async () => clone(bindings),
      readHistoryEntries: async () => clone(hqHistory),
    },
    hqAgenciesStore: {
      upsertBinding: async (binding) => binding,
      deleteBinding: async () => {},
    },
    kpiRulesReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readRuleCollection: async () => clone(rules),
    },
    kpiRulesStore: {
      writeRuleCollection: async (collection) => collection,
    },
    mstAssignmentsReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readMstAssignmentRows: async () => clone(mstAssignments),
    },
    teamsReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readTeamRoster: async () => clone(roster),
    },
    teamsStore: {
      writeRoster: async (value) => value,
    },
    projections: {
      readValue: async () => null,
      writeValue: async () => {},
      deleteValue: async () => {},
      readScheduleEntries: async () => clone(schedules),
      readMonthlyAggregateEntries: async () => [],
      readJobRunEntries: async () => [],
    },
    dispose: async () => {},
  };
}

function createAuthStore(initialAccounts) {
  let accounts = clone(initialAccounts);
  const sessions = new Map();
  let sessionCounter = 0;

  return {
    async listAccounts() {
      return clone(accounts);
    },
    async saveAccounts(nextAccounts) {
      accounts = clone(nextAccounts);
    },
    async readSession(token) {
      return clone(sessions.get(token) ?? null);
    },
    async createSession(username) {
      const session = {
        token: `session-${++sessionCounter}`,
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

function createAccount({ username, password, role, name }) {
  return {
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    name,
    permissions: getPermissionTemplate(role),
    updatedAt: new Date().toISOString(),
    memberId: null,
    memberName: null,
    teamId: null,
    teamName: null,
  };
}

function getCookie(response) {
  return response.headers['set-cookie']?.[0] ?? '';
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
