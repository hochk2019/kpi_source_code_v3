import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { buildV4App, moduleCatalog } from '../../server-v4/src/index.ts';

describe('server-v4 app shell', () => {
  it('reports health for the scaffolded module set', async () => {
    const app = buildV4App();
    const response = await request(app).get('/api/v4/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        version: 'v4-scaffold',
        moduleCount: moduleCatalog.length,
        modules: moduleCatalog.map((entry) => entry.id),
      }),
    );
    expect(response.body.db).toMatchObject({
      state: 'ready',
    });
    expect(response.body.readiness).toMatchObject({
      state: 'ready',
    });
    expect(response.body.metrics?.modules?.implemented).toBe(8);
    expect(response.body.metrics?.modules?.readOnly).toBe(1);
    expect(response.body.metrics?.modules?.readWrite).toBe(7);
    expect(response.body.metrics?.routes?.implemented).toBe(31);
    expect(response.body.metrics?.routes?.implementedMutation).toBe(15);
  });

  it('exposes module metadata for the root catalog and mounted module path', async () => {
    const app = buildV4App();

    const catalogResponse = await request(app).get('/api/v4/meta/modules');
    expect(catalogResponse.status).toBe(200);
    expect(catalogResponse.body.ok).toBe(true);
    expect(catalogResponse.body.modules).toHaveLength(moduleCatalog.length);

    const authMetaResponse = await request(app).get('/api/v4/auth/__meta');
    expect(authMetaResponse.status).toBe(200);
    expect(authMetaResponse.body.ok).toBe(true);
    expect(authMetaResponse.body.module.id).toBe('auth');
    expect(authMetaResponse.body.module.basePath).toBe('/api/v4/auth');
  });

  it('exposes rollout metadata with migration checks and fallback guidance', async () => {
    const app = buildV4App();
    const response = await request(app).get('/api/v4/meta/rollout');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.metrics.modules.total).toBe(moduleCatalog.length);
    expect(response.body.metrics.modules.scaffold).toBe(0);
    expect(response.body.rollout.currentStage).toBe('cutover-ready');
    expect(response.body.rollout.recommendedNextStage).toBe(null);
    expect(response.body.rollout.fallback).toContain('Keep monolith `/api/*` routes as the production write path until the next gate is green.');
    expect(
      response.body.migrationVerification.checks.find((entry) => entry.id === 'implemented-module-coverage'),
    ).toMatchObject({
      status: 'pass',
    });
  });

  it('surfaces relational-store rollout health without requiring the legacy db file', async () => {
    const app = buildV4App({
      dbFile: null,
      persistenceMode: 'postgres',
      persistence: createRelationalStorePersistenceStub(),
    });
    const response = await request(app).get('/api/v4/meta/rollout');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.persistence).toMatchObject({
      source: 'relational-store',
      hotPathCount: 0,
    });
    expect(response.body.health.dbFile).toMatchObject({
      path: '(not configured)',
      state: 'not-required',
      exists: false,
      readable: false,
    });
    expect(response.body.health.readiness).toMatchObject({
      state: 'ready',
    });
  });
});

function createRelationalStorePersistenceStub() {
  const emptyList = async () => [];
  const emptyObject = async () => ({});

  return {
    mode: 'postgres',
    sourceKind: 'relational-store',
    adjustmentsReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readAdjustmentRows: emptyList,
    },
    adjustmentsStore: {
      readAdjustmentById: async () => null,
      createAdjustment: async (record) => record,
      updateAdjustment: async (record) => record,
      readSettings: async () => ({
        categories: {},
        updatedAt: null,
        updatedBy: null,
        autoApprove: {
          enabled: false,
          note: null,
          updatedAt: null,
          updatedBy: null,
        },
      }),
      writeSettings: async (settings) => settings,
    },
    authStore: {
      listAccounts: emptyList,
      saveAccounts: async () => {},
      readSession: async () => null,
      createSession: async () => ({
        token: 'session-token',
        username: 'admin',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
      deleteSession: async () => {},
      deleteSessionsForUser: async () => {},
    },
    declarationsReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readDeclarationRows: emptyList,
    },
    hqAgenciesReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readBindings: emptyList,
      readHistoryEntries: emptyList,
    },
    hqAgenciesStore: {
      upsertBinding: async (binding) => binding,
      deleteBinding: async () => {},
    },
    kpiRulesReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readRuleCollection: emptyObject,
    },
    kpiRulesStore: {
      writeRuleCollection: async (collection) => collection,
    },
    mstAssignmentsReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readMstAssignmentRows: emptyList,
    },
    teamsReader: {
      getSourceKind: () => 'relational-store',
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readTeamRoster: emptyObject,
    },
    teamsStore: {
      writeRoster: async (roster) => roster,
    },
    projections: {
      readValue: async () => null,
      writeValue: async () => {},
      deleteValue: async () => {},
      readMonthlyAggregateEntries: emptyList,
      readJobRunEntries: emptyList,
    },
    dispose: async () => {},
  };
}
