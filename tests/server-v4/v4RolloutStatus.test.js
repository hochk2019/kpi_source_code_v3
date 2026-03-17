import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { moduleCatalog } from '../../server-v4/src/index.ts';
import { runtimeModuleRouteCoverage } from '../../server-v4/src/app/runtimeRouteCoverage.ts';
import { buildV4RolloutStatus } from '../../server-v4/src/app/v4-rollout-status.ts';

const implementedModuleIds = [
  'auth',
  'declarations',
  'hq-agencies',
  'kpi-adjustments',
  'kpi-rules',
  'mst-assignments',
  'reporting',
  'teams',
];
const implementedModules = moduleCatalog.filter((entry) => implementedModuleIds.includes(entry.id));
const catalogRoutes = moduleCatalog.flatMap((entry) => entry.routeGroups.flatMap((group) => group.routes));
const catalogMutationRoutes = catalogRoutes.filter((entry) => entry.method !== 'GET');
const implementedReadWriteModules = implementedModules.filter((entry) =>
  entry.routeGroups.some((group) => group.routes.some((route) => route.method !== 'GET')),
);
const declarationsModule = moduleCatalog.find((entry) => entry.id === 'declarations');
const declarationsRoutes = declarationsModule.routeGroups.flatMap((group) => group.routes);
const declarationsMutationRoutes = declarationsRoutes.filter((entry) => entry.method !== 'GET');

describe('server-v4 rollout status', () => {
  it('summarizes health, module coverage, and rollout gates for the current scaffold', () => {
    const status = buildV4RolloutStatus({
      modules: moduleCatalog,
      dbFile: path.resolve(process.cwd(), 'server', 'data', 'storage.sqlite'),
      implementedModuleIds,
      runtimeRouteCoverage: runtimeModuleRouteCoverage,
    });

    expect(status.metrics.modules).toMatchObject({
      total: moduleCatalog.length,
      implemented: implementedModuleIds.length,
      scaffold: moduleCatalog.length - implementedModuleIds.length,
      readOnly: implementedModuleIds.length - implementedReadWriteModules.length,
      readWrite: implementedReadWriteModules.length,
    });
    expect(status.metrics.routes).toMatchObject({
      total: catalogRoutes.length,
      implemented: catalogRoutes.length,
      mutation: catalogMutationRoutes.length,
      implementedMutation: catalogMutationRoutes.length,
    });
    expect(status.persistence).toMatchObject({
      source: 'dual-write',
      hotPathCount: 0,
    });
    expect(status.health.dbFile.state).toBe('ready');
    expect(status.health.readiness).toMatchObject({
      state: 'degraded',
      label: 'Compatibility verification only',
    });
    expect(
      status.migrationVerification.checks.find((entry) => entry.id === 'hot-path-persistence-source'),
    ).toMatchObject({
      status: 'warn',
    });
    expect(
      status.migrationVerification.checks.find((entry) => entry.id === 'importer-compat-traffic'),
    ).toMatchObject({
      status: 'pass',
    });
    expect(
      status.migrationVerification.checks.find((entry) => entry.id === 'implemented-module-coverage'),
    ).toMatchObject({
      status: 'pass',
    });
    expect(status.migrationVerification.checks.find((entry) => entry.id === 'scaffold-module-gap')).toMatchObject({
      status: 'pass',
    });
    expect(status.rollout.currentStage).toBe('module-parity');
    expect(status.rollout.recommendedNextStage).toBe('cutover-ready');
    expect(status.rollout.stages.find((entry) => entry.id === 'baseline-health')).toMatchObject({
      label: 'Compatibility baseline',
    });
    expect(status.rollout.stages.find((entry) => entry.id === 'internal-qa')).toMatchObject({
      label: 'Internal QA ready',
    });
    expect(status.rollout.stages.find((entry) => entry.id === 'cutover-ready')).toMatchObject({
      status: 'hold',
      label: 'Production cutover ready',
      gate: 'Relational runtime stores own hot paths and write-capable routes are available for production cutover.',
    });
    expect(status.modules.find((entry) => entry.id === 'declarations')).toMatchObject({
      routeCount: declarationsRoutes.length,
      mutationRouteCount: declarationsMutationRoutes.length,
    });
    expect(status.compatibility.importerTraffic).toMatchObject({
      guardMode: 'off',
      totals: {
        hits: 0,
        migratedHits: 0,
        legacyOnlyHits: 0,
        blockedHits: 0,
      },
    });
  });

  it('blocks rollout readiness when the legacy db file is missing', () => {
    const status = buildV4RolloutStatus({
      modules: moduleCatalog,
      dbFile: path.resolve(process.cwd(), 'server', 'data', 'missing-v4-rollout.sqlite'),
      implementedModuleIds,
      runtimeRouteCoverage: runtimeModuleRouteCoverage,
    });

    expect(status.health.dbFile.state).toBe('missing');
    expect(status.health.readiness.state).toBe('blocked');
    expect(
      status.migrationVerification.checks.find((entry) => entry.id === 'legacy-store-access'),
    ).toMatchObject({
      status: 'fail',
    });
    expect(status.rollout.currentStage).toBe('baseline-health');
  });

  it('does not block rollout readiness on the legacy db file when persistence is relational-store backed', () => {
    const status = buildV4RolloutStatus({
      modules: moduleCatalog,
      dbFile: null,
      implementedModuleIds,
      runtimeRouteCoverage: runtimeModuleRouteCoverage,
      persistenceSourceKind: 'relational-store',
    });

    expect(status.persistence).toMatchObject({
      source: 'relational-store',
      hotPathCount: 0,
    });
    expect(status.health.dbFile).toMatchObject({
      path: '(not configured)',
      state: 'not-required',
      exists: false,
      readable: false,
    });
    expect(status.health.readiness).toMatchObject({
      state: 'ready',
      label: 'Production cutover ready',
    });
    expect(
      status.migrationVerification.checks.find((entry) => entry.id === 'legacy-store-access'),
    ).toMatchObject({
      status: 'pass',
    });
    expect(status.rollout.currentStage).toBe('cutover-ready');
    expect(status.rollout.recommendedNextStage).toBe(null);
  });
});
