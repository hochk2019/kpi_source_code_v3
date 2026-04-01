import path from 'node:path';

import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { buildV4App, moduleCatalog } from '../../server-v4/src/index.ts';

const READY_DB_FILE = path.resolve(process.cwd(), 'package.json');
const catalogRoutes = moduleCatalog.flatMap((entry) => entry.routeGroups.flatMap((group) => group.routes));
const catalogMutationRoutes = catalogRoutes.filter((entry) => entry.method !== 'GET');
const implementedReadWriteModules = moduleCatalog.filter((entry) =>
  entry.routeGroups.some((group) => group.routes.some((route) => route.method !== 'GET')),
);

describe('server-v4 app shell', () => {
  it('reports health for the scaffolded module set', async () => {
    const app = buildV4App({
      dbFile: READY_DB_FILE,
      persistenceMode: 'postgres',
      persistence: createDualWritePersistenceStub(),
    });
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
      state: 'degraded',
      label: 'Compatibility verification only',
    });
    expect(response.body.metrics?.modules?.implemented).toBe(moduleCatalog.length);
    expect(response.body.metrics?.modules?.readOnly).toBe(moduleCatalog.length - implementedReadWriteModules.length);
    expect(response.body.metrics?.modules?.readWrite).toBe(implementedReadWriteModules.length);
    expect(response.body.metrics?.routes?.implemented).toBe(catalogRoutes.length);
    expect(response.body.metrics?.routes?.implementedMutation).toBe(catalogMutationRoutes.length);
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

  it('mounts __meta handlers for every module in the catalog', async () => {
    const app = buildV4App();

    for (const entry of moduleCatalog) {
      const response = await request(app).get(`${entry.basePath}/__meta`);

      expect(response.status, `expected __meta route for ${entry.id}`).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          ok: true,
          module: expect.objectContaining({
            id: entry.id,
            basePath: entry.basePath,
          }),
        }),
      );
    }
  });

  it('allows CORS preflight for browser clients', async () => {
    const app = buildV4App();
    const origin = 'http://127.0.0.1:5173';

    const response = await request(app)
      .options('/api/v4/auth/login')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST');

    expect([200, 204]).toContain(response.status);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('exposes rollout metadata with migration checks and fallback guidance', async () => {
    const app = buildV4App({
      dbFile: READY_DB_FILE,
      persistenceMode: 'postgres',
      persistence: createDualWritePersistenceStub(),
    });
    const response = await request(app).get('/api/v4/meta/rollout');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.metrics.modules.total).toBe(moduleCatalog.length);
    expect(response.body.metrics.modules.scaffold).toBe(0);
    expect(response.body.health.readiness.state).toBe('degraded');
    expect(response.body.rollout.currentStage).toBe('module-parity');
    expect(response.body.rollout.recommendedNextStage).toBe('cutover-ready');
    expect(response.body.rollout.stages.find((entry) => entry.id === 'baseline-health')).toMatchObject({
      label: 'Compatibility baseline',
    });
    expect(response.body.rollout.stages.find((entry) => entry.id === 'cutover-ready')).toMatchObject({
      label: 'Production cutover ready',
      gate:
        'Relational runtime stores own hot paths, write-capable routes are available, and declarations cutover policy is green.',
    });
    expect(response.body.rollout.fallback).toContain('Keep monolith `/api/*` routes as the production write path until the next gate is green.');
    expect(
      response.body.migrationVerification.checks.find((entry) => entry.id === 'implemented-module-coverage'),
    ).toMatchObject({
      status: 'pass',
    });
    expect(response.body.compatibility.importerTraffic).toMatchObject({
      guardMode: 'off',
      totals: {
        hits: 0,
        migratedHits: 0,
        legacyOnlyHits: 0,
        blockedHits: 0,
      },
    });
    expect(response.body.compatibility.declarationShadow.summary).toContain(
      'Declarations shadow rollout gate is green',
    );
    expect(response.body.compatibility.declarationCutover).toMatchObject({
      readiness: 'hold',
      requiredGuardMode: 'block-migrated',
      observedGuardMode: 'off',
      observedMigratedCompatHits: 0,
      shadowGateStatus: 'pass',
    });
    expect(
      response.body.compatibility.declarationShadow.groups.find(
        (entry) => entry.id === 'declarations-shadow-ecus-preview-commit',
      ),
    ).toMatchObject({
      status: 'pass',
      observedCompatHits: 0,
    });
    expect(
      response.body.migrationVerification.checks.find(
        (entry) => entry.id === 'declarations-shadow-alerts',
      ),
    ).toMatchObject({
      status: 'pass',
    });
    expect(
      response.body.migrationVerification.checks.find(
        (entry) => entry.id === 'declarations-write-cutover-policy',
      ),
    ).toMatchObject({
      status: 'warn',
    });
  });

  it('surfaces relational-store rollout health without requiring the legacy db file', async () => {
    const app = buildV4App({
      dbFile: null,
      importerCompatGuardMode: 'block-migrated',
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
      label: 'Production cutover ready',
    });
  });

  it('reports a reduced route matrix when buildV4App mounts a subset catalog', async () => {
    const selectedModuleIds = new Set(['auth', 'teams']);
    const selectedModules = moduleCatalog.filter((entry) => selectedModuleIds.has(entry.id));
    const selectedRoutes = selectedModules.flatMap((entry) =>
      entry.routeGroups.flatMap((group) => group.routes),
    );
    const selectedMutationRoutes = selectedRoutes.filter((entry) => entry.method !== 'GET');
    const app = buildV4App({
      modules: selectedModules,
      dbFile: READY_DB_FILE,
      persistenceMode: 'postgres',
      persistence: createDualWritePersistenceStub(),
    });

    const modulesResponse = await request(app).get('/api/v4/meta/modules');
    expect(modulesResponse.status).toBe(200);
    expect(modulesResponse.body.modules.map((entry) => entry.id)).toEqual(['auth', 'teams']);

    const healthResponse = await request(app).get('/api/v4/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toEqual(
      expect.objectContaining({
        ok: true,
        moduleCount: selectedModules.length,
        modules: ['auth', 'teams'],
      }),
    );
    expect(healthResponse.body.metrics?.modules).toMatchObject({
      total: selectedModules.length,
      implemented: selectedModules.length,
      scaffold: 0,
      readWrite: selectedModules.length,
      readOnly: 0,
    });
    expect(healthResponse.body.metrics?.routes).toMatchObject({
      total: selectedRoutes.length,
      implemented: selectedRoutes.length,
      implementedMutation: selectedMutationRoutes.length,
    });

    const rolloutResponse = await request(app).get('/api/v4/meta/rollout');
    expect(rolloutResponse.status).toBe(200);
    expect(rolloutResponse.body.metrics.modules).toMatchObject({
      total: selectedModules.length,
      implemented: selectedModules.length,
      scaffold: 0,
    });
    expect(rolloutResponse.body.metrics.routes).toMatchObject({
      total: selectedRoutes.length,
      implemented: selectedRoutes.length,
      implementedMutation: selectedMutationRoutes.length,
    });
    expect(rolloutResponse.body.modules.map((entry) => entry.id)).toEqual(['auth', 'teams']);

    const authMetaResponse = await request(app).get('/api/v4/auth/__meta');
    expect(authMetaResponse.status).toBe(200);

    const teamsMetaResponse = await request(app).get('/api/v4/teams/__meta');
    expect(teamsMetaResponse.status).toBe(200);

    const declarationsMetaResponse = await request(app).get('/api/v4/declarations/__meta');
    expect(declarationsMetaResponse.status).toBe(404);
  });
});

function createDualWritePersistenceStub() {
  return {
    ...createRelationalStorePersistenceStub(),
    sourceKind: 'dual-write',
    adjustmentsReader: {
      ...createCompatReader(),
      readAdjustmentRows: async () => [],
    },
    declarationsReader: {
      ...createCompatReader(),
      readDeclarationRows: async () => [],
    },
    hqAgenciesReader: {
      ...createCompatReader(),
      readBindings: async () => [],
      readHistoryEntries: async () => [],
    },
    kpiRulesReader: {
      ...createCompatReader(),
      readRuleCollection: async () => ({}),
    },
    mstAssignmentsReader: {
      ...createCompatReader(),
      readMstAssignmentRows: async () => [],
    },
    teamsReader: {
      ...createCompatReader(),
      readTeamRoster: async () => ({}),
    },
  };
}

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
      readScheduleEntries: emptyList,
      readMonthlyAggregateEntries: emptyList,
      readJobRunEntries: emptyList,
    },
    dispose: async () => {},
  };
}

function createCompatReader() {
  return {
    getSourceKind: () => 'dual-write',
    getHotPathKeys: () => [],
    getLegacyDbFile: () => READY_DB_FILE,
  };
}
