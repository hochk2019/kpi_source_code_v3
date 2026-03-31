import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createImporterCompatTrafficTracker,
  getImporterCompatRouteDefinition,
} from '../../server-v4/src/app/importerCompatTraffic.ts';
import { moduleCatalog } from '../../server-v4/src/index.ts';
import { runtimeModuleRouteCoverage } from '../../server-v4/src/app/runtimeRouteCoverage.ts';
import { buildV4RolloutStatus } from '../../server-v4/src/app/v4-rollout-status.ts';

const READY_DB_FILE = path.resolve(process.cwd(), 'package.json');
const implementedModuleIds = [
  'alerts',
  'auth',
  'backup',
  'data-health',
  'duplicate-policy',
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
      dbFile: READY_DB_FILE,
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
      gate:
        'Relational runtime stores own hot paths, write-capable routes are available, and declarations cutover policy is green.',
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
    expect(status.compatibility.declarationShadow.summary).toContain('Declarations shadow rollout gate is green');
    expect(status.compatibility.declarationCutover).toMatchObject({
      readiness: 'hold',
      recommendedWritePath: 'monolith-legacy',
      requiredGuardMode: 'block-migrated',
      observedGuardMode: 'off',
      observedMigratedCompatHits: 0,
      shadowGateStatus: 'pass',
    });
    expect(status.rollout.declarationCutover).toMatchObject({
      writePath: 'monolith-legacy',
      verificationGates: [
        'postgresDeclarationsRoute',
        'legacyCompatRoutes',
        'importerCompatTraffic',
        'runtimeRoutes',
        'v4RolloutStatus',
      ],
    });
    expect(status.rollout.fallback).toContain(
      'Set `KPI_API_IMPORTER_COMPAT_GUARD_MODE=off` and restart server-v4 to reopen migrated legacy importer routes.',
    );
    expect(status.compatibility.declarationShadow.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'declarations-shadow-ecus-preview-commit',
          status: 'pass',
          observedCompatHits: 0,
        }),
        expect.objectContaining({
          id: 'declarations-shadow-alerts',
          status: 'pass',
          observedCompatHits: 0,
        }),
        expect.objectContaining({
          id: 'declarations-shadow-co-discrepancy',
          status: 'pass',
          observedCompatHits: 0,
        }),
        expect.objectContaining({
          id: 'declarations-shadow-history-edit',
          status: 'pass',
          compatRouteIds: [],
        }),
      ]),
    );
    expect(
      status.migrationVerification.checks.find(
        (entry) => entry.id === 'declarations-shadow-history-edit',
      ),
    ).toMatchObject({
      status: 'pass',
    });
    expect(
      status.migrationVerification.checks.find(
        (entry) => entry.id === 'declarations-write-cutover-policy',
      ),
    ).toMatchObject({
      status: 'warn',
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
      importerCompat: createImporterCompatTrafficTracker({
        guardMode: 'block-migrated',
      }).snapshot(),
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
    expect(status.rollout.declarationCutover).toMatchObject({
      writePath: 'canonical-v4',
    });
  });

  it('warns the declarations shadow gate when migrated compat traffic is still observed for a tracked declaration workflow', () => {
    const tracker = createImporterCompatTrafficTracker({
      guardMode: 'block-migrated',
    });
    const alertsRoute = getImporterCompatRouteDefinition('GET', '/api/import/alerts');
    expect(alertsRoute).not.toBeNull();
    tracker.record(alertsRoute, {
      blocked: true,
      now: '2026-03-25T09:15:00.000Z',
    });

    const status = buildV4RolloutStatus({
      modules: moduleCatalog,
      dbFile: READY_DB_FILE,
      implementedModuleIds,
      runtimeRouteCoverage: runtimeModuleRouteCoverage,
      importerCompat: tracker.snapshot(),
    });

    expect(status.compatibility.declarationShadow.summary).toContain(
      'legacy compat traffic',
    );
    expect(
      status.compatibility.declarationShadow.groups.find(
        (entry) => entry.id === 'declarations-shadow-alerts',
      ),
    ).toMatchObject({
      status: 'warn',
      observedCompatHits: 1,
      blockedCompatHits: 1,
    });
    expect(
      status.migrationVerification.checks.find(
        (entry) => entry.id === 'declarations-shadow-alerts',
      ),
    ).toMatchObject({
      status: 'warn',
    });
    expect(status.compatibility.declarationCutover).toMatchObject({
      readiness: 'hold',
      recommendedWritePath: 'monolith-legacy',
      observedGuardMode: 'block-migrated',
      observedMigratedCompatHits: 1,
      observedBlockedCompatHits: 1,
      shadowGateStatus: 'warn',
    });
    expect(status.rollout.declarationCutover.operatorAction).toContain('monolith `/api/*` write flows');
    expect(
      status.migrationVerification.checks.find(
        (entry) => entry.id === 'declarations-write-cutover-policy',
      ),
    ).toMatchObject({
      status: 'warn',
    });
  });
});
