import fs from 'node:fs';

import type { DomainModule } from './domain-module.js';
import {
  createEmptyImporterCompatTrafficSnapshot,
  describeImporterCompatTraffic,
  type ImporterCompatTrafficSnapshot,
} from './importerCompatTraffic.js';
import type { RuntimeModuleRouteCoverage } from './runtimeRouteCoverage.js';
import {
  LEGACY_BUSINESS_HOT_PATH_KEYS,
  type BusinessSnapshotSourceKind,
} from '../persistence/businessSnapshotReader.js';

type CheckStatus = 'pass' | 'warn' | 'fail';
type RolloutStageStatus = 'ready' | 'hold' | 'blocked';
type ModuleRuntimeMode = 'scaffold' | 'read-only' | 'read-write';
type RolloutStageId = 'baseline-health' | 'internal-qa' | 'module-parity' | 'cutover-ready';

export type V4RolloutCheck = {
  id: string;
  status: CheckStatus;
  summary: string;
  detail: string;
};

export type V4RolloutStatus = {
  generatedAt: string;
  persistence: {
    source: BusinessSnapshotSourceKind;
    hotPathKeys: string[];
    hotPathCount: number;
    detail: string;
  };
  metrics: {
    modules: {
      total: number;
      implemented: number;
      scaffold: number;
      readOnly: number;
      readWrite: number;
    };
    routes: {
      total: number;
      get: number;
      mutation: number;
      implemented: number;
      implementedMutation: number;
    };
  };
  health: {
    dbFile: {
      path: string;
      state: 'ready' | 'memory' | 'missing' | 'unreadable' | 'not-required';
      exists: boolean;
      readable: boolean;
      detail: string;
    };
    readiness: {
      state: 'ready' | 'degraded' | 'blocked';
      label: string;
      detail: string;
    };
  };
  migrationVerification: {
    checks: V4RolloutCheck[];
  };
  compatibility: {
    importerTraffic: ImporterCompatTrafficSnapshot & {
      summary: string;
    };
  };
  rollout: {
    currentStage: RolloutStageId;
    recommendedNextStage: RolloutStageId | null;
    stages: Array<{
      id: RolloutStageId;
      label: string;
      status: RolloutStageStatus;
      gate: string;
    }>;
    fallback: string[];
  };
  modules: Array<{
    id: string;
    basePath: string;
    runtimeMode: ModuleRuntimeMode;
    implemented: boolean;
    routeCount: number;
    mutationRouteCount: number;
  }>;
};

export type BuildV4RolloutStatusOptions = {
  modules: readonly DomainModule[];
  dbFile: string | null;
  implementedModuleIds: Iterable<string>;
  runtimeRouteCoverage?: Iterable<RuntimeModuleRouteCoverage>;
  persistenceSourceKind?: BusinessSnapshotSourceKind;
  importerCompat?: ImporterCompatTrafficSnapshot;
  now?: Date;
};

export function buildV4RolloutStatus(options: BuildV4RolloutStatusOptions): V4RolloutStatus {
  const implementedModuleIds = new Set(options.implementedModuleIds);
  const runtimeRouteCoverage = new Map(
    Array.from(options.runtimeRouteCoverage ?? []).map((entry) => [entry.id, entry] as const),
  );
  const persistenceSourceKind = options.persistenceSourceKind ?? 'dual-write';
  const importerCompat = options.importerCompat ?? createEmptyImporterCompatTrafficSnapshot();
  const hotPathKeys =
    persistenceSourceKind === 'legacy-kv-store' ? [...LEGACY_BUSINESS_HOT_PATH_KEYS] : [];
  const moduleStatuses = options.modules.map((domainModule) =>
    buildModuleStatus(domainModule, implementedModuleIds.has(domainModule.id), runtimeRouteCoverage.get(domainModule.id)),
  );
  const dbFile = inspectDbFile(options.dbFile, persistenceSourceKind);
  const metrics = buildMetrics(moduleStatuses, options.modules);
  const checks = buildChecks({
    dbFile,
    metrics,
    moduleStatuses,
    persistenceSourceKind,
    hotPathKeys,
    importerCompat,
  });
  const readiness = buildReadiness(dbFile, metrics, persistenceSourceKind);
  const stages = buildStages({ dbFile, metrics, persistenceSourceKind });

  return {
    generatedAt: (options.now ?? new Date()).toISOString(),
    persistence: {
      source: persistenceSourceKind,
      hotPathKeys,
      hotPathCount: hotPathKeys.length,
      detail: describePersistenceState(persistenceSourceKind, hotPathKeys),
    },
    metrics,
    health: {
      dbFile,
      readiness,
    },
    migrationVerification: {
      checks,
    },
    compatibility: {
      importerTraffic: {
        ...importerCompat,
        summary: describeImporterCompatTraffic(importerCompat),
      },
    },
    rollout: {
      currentStage: resolveCurrentStage(stages),
      recommendedNextStage: resolveRecommendedNextStage(stages),
      stages,
      fallback: [
        'Keep monolith `/api/*` routes as the production write path until the next gate is green.',
        'Re-run the QA matrix before enabling any additional `/api/v4/*` write traffic.',
        'If legacy DB access or module parity drops, route operators back to the monolith shell and investigate before retrying.',
      ],
    },
    modules: moduleStatuses,
  };
}

function buildModuleStatus(
  domainModule: DomainModule,
  implemented: boolean,
  coverage?: RuntimeModuleRouteCoverage
) {
  const routes = domainModule.routeGroups.flatMap((group) => group.routes);
  const catalogRouteCount = routes.length;
  const catalogMutationRouteCount = routes.filter((route) => route.method !== 'GET').length;
  const routeCount = implemented ? (coverage?.routeCount ?? catalogRouteCount) : catalogRouteCount;
  const mutationRouteCount = implemented
    ? (coverage?.mutationRouteCount ?? catalogMutationRouteCount)
    : catalogMutationRouteCount;

  return {
    id: domainModule.id,
    basePath: domainModule.basePath,
    runtimeMode: implemented ? (mutationRouteCount > 0 ? 'read-write' : 'read-only') : 'scaffold',
    implemented,
    routeCount,
    mutationRouteCount,
  } satisfies V4RolloutStatus['modules'][number];
}

function inspectDbFile(
  dbFile: string | null,
  persistenceSourceKind: BusinessSnapshotSourceKind,
): V4RolloutStatus['health']['dbFile'] {
  if (persistenceSourceKind === 'relational-store') {
    const path = dbFile ?? '(not configured)';
    const exists = dbFile === ':memory:' ? true : dbFile ? fs.existsSync(dbFile) : false;
    const readable = dbFile === ':memory:' ? true : dbFile ? (exists ? canReadFile(dbFile) : false) : false;
    return {
      path,
      state: 'not-required',
      exists,
      readable,
      detail: 'Legacy store access is optional because server-v4 is running against relational runtime stores.',
    };
  }

  if (!dbFile) {
    return {
      path: '(not configured)',
      state: 'missing',
      exists: false,
      readable: false,
      detail: 'Legacy store path is not configured for the current server-v4 runtime.',
    };
  }

  if (dbFile === ':memory:') {
    return {
      path: dbFile,
      state: 'memory',
      exists: true,
      readable: true,
      detail: 'In-memory legacy store is suitable for tests only.',
    };
  }

  if (!fs.existsSync(dbFile)) {
    return {
      path: dbFile,
      state: 'missing',
      exists: false,
      readable: false,
      detail: 'Legacy store file is missing for the configured server-v4 runtime.',
    };
  }

  try {
    fs.accessSync(dbFile, fs.constants.R_OK);
    return {
      path: dbFile,
      state: 'ready',
      exists: true,
      readable: true,
      detail: 'Legacy store file is readable by server-v4.',
    };
  } catch {
    return {
      path: dbFile,
      state: 'unreadable',
      exists: true,
      readable: false,
      detail: 'Legacy store file exists but is not readable by server-v4.',
    };
  }
}

function canReadFile(dbFile: string): boolean {
  try {
    fs.accessSync(dbFile, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function buildMetrics(
  moduleStatuses: V4RolloutStatus['modules'],
  modules: readonly DomainModule[],
): V4RolloutStatus['metrics'] {
  const total = moduleStatuses.length;
  const implemented = moduleStatuses.filter((entry) => entry.implemented).length;
  const scaffold = moduleStatuses.filter((entry) => entry.runtimeMode === 'scaffold').length;
  const readOnly = moduleStatuses.filter((entry) => entry.runtimeMode === 'read-only').length;
  const readWrite = moduleStatuses.filter((entry) => entry.runtimeMode === 'read-write').length;

  const routes = modules.flatMap((entry) => entry.routeGroups.flatMap((group) => group.routes));
  const totalRoutes = routes.length;
  const getRoutes = routes.filter((route) => route.method === 'GET').length;
  const mutationRoutes = totalRoutes - getRoutes;
  const implementedRoutes = moduleStatuses
    .filter((entry) => entry.implemented)
    .reduce((sum, entry) => sum + entry.routeCount, 0);
  const implementedMutationRoutes = moduleStatuses
    .filter((entry) => entry.implemented)
    .reduce((sum, entry) => sum + entry.mutationRouteCount, 0);

  return {
    modules: {
      total,
      implemented,
      scaffold,
      readOnly,
      readWrite,
    },
    routes: {
      total: totalRoutes,
      get: getRoutes,
      mutation: mutationRoutes,
      implemented: implementedRoutes,
      implementedMutation: implementedMutationRoutes,
    },
  };
}

function buildChecks(input: {
  dbFile: V4RolloutStatus['health']['dbFile'];
  metrics: V4RolloutStatus['metrics'];
  moduleStatuses: V4RolloutStatus['modules'];
  persistenceSourceKind: BusinessSnapshotSourceKind;
  hotPathKeys: string[];
  importerCompat: ImporterCompatTrafficSnapshot;
}): V4RolloutCheck[] {
  const scaffoldModules = input.moduleStatuses.filter((entry) => entry.runtimeMode === 'scaffold').map((entry) => entry.id);

  return [
    {
      id: 'legacy-store-access',
      status:
        input.dbFile.state === 'ready' || input.dbFile.state === 'not-required'
          ? 'pass'
          : input.dbFile.state === 'memory'
            ? 'warn'
            : 'fail',
      summary: 'Legacy store access',
      detail: input.dbFile.detail,
    },
    {
      id: 'hot-path-persistence-source',
      status: input.persistenceSourceKind === 'relational-store' ? 'pass' : 'warn',
      summary: 'Hot-path persistence source',
      detail: describePersistenceState(input.persistenceSourceKind, input.hotPathKeys),
    },
    {
      id: 'importer-compat-traffic',
      status: input.importerCompat.totals.migratedHits === 0 ? 'pass' : 'warn',
      summary: 'Importer compat traffic',
      detail: describeImporterCompatTraffic(input.importerCompat),
    },
    {
      id: 'implemented-module-coverage',
      status:
        input.metrics.modules.implemented === input.metrics.modules.total
          ? 'pass'
          : input.metrics.modules.implemented > 0
            ? 'warn'
            : 'fail',
      summary: 'Implemented module coverage',
      detail: `${input.metrics.modules.implemented}/${input.metrics.modules.total} catalog modules have runtime routers mounted.`,
    },
    {
      id: 'scaffold-module-gap',
      status: scaffoldModules.length === 0 ? 'pass' : 'warn',
      summary: 'Scaffold module gap',
      detail:
        scaffoldModules.length === 0
          ? 'No metadata-only modules remain in the catalog.'
          : `Metadata-only modules still need runtime delivery: ${scaffoldModules.join(', ')}.`,
    },
    {
      id: 'write-path-coverage',
      status: input.metrics.modules.readWrite > 0 ? 'pass' : 'warn',
      summary: 'Write-path coverage',
      detail:
        input.metrics.modules.readWrite > 0
          ? `${input.metrics.modules.readWrite} implemented modules expose mutation routes for staged rollout verification.`
          : 'No write-capable server-v4 modules are mounted yet.',
    },
  ];
}

function describePersistenceState(
  persistenceSourceKind: BusinessSnapshotSourceKind,
  hotPathKeys: string[]
): string {
  if (persistenceSourceKind === 'relational-store') {
    return 'Hot business entities resolve from relational runtime stores with no legacy kv_store dependency.';
  }

  if (persistenceSourceKind === 'dual-write') {
    return 'Hot business entities have typed runtime snapshots with legacy kv_store retained only as dual-write compatibility.';
  }

  return `Runtime business reads still depend on legacy storage keys: ${hotPathKeys.join(', ')}.`;
}

function buildReadiness(
  dbFile: V4RolloutStatus['health']['dbFile'],
  metrics: V4RolloutStatus['metrics'],
  persistenceSourceKind: BusinessSnapshotSourceKind,
): V4RolloutStatus['health']['readiness'] {
  const legacyStoreBlocked =
    persistenceSourceKind !== 'relational-store' && (dbFile.state === 'missing' || dbFile.state === 'unreadable');

  if (legacyStoreBlocked || metrics.modules.implemented === 0) {
    return {
      state: 'blocked',
      label: 'Rollout blocked',
      detail:
        persistenceSourceKind === 'relational-store'
          ? 'server-v4 cannot progress because no runtime modules are mounted.'
          : 'server-v4 cannot progress because the legacy store is unavailable or no runtime modules are mounted.',
    };
  }

  if (dbFile.state === 'memory' || metrics.modules.scaffold > 0) {
    return {
      state: 'degraded',
      label: 'Internal QA only',
      detail: 'server-v4 is usable for internal verification, but scaffold gaps or non-production storage still block rollout.',
    };
  }

  if (persistenceSourceKind !== 'relational-store') {
    return {
      state: 'degraded',
      label: 'Compatibility verification only',
      detail:
        'server-v4 is usable for compatibility verification, but full rollout readiness remains blocked until relational runtime stores own the hot paths.',
    };
  }

  return {
    state: 'ready',
    label: 'Production cutover ready',
    detail: 'All catalog modules have runtime coverage and relational runtime stores satisfy the rollout gates.',
  };
}

function buildStages(input: {
  dbFile: V4RolloutStatus['health']['dbFile'];
  metrics: V4RolloutStatus['metrics'];
  persistenceSourceKind: BusinessSnapshotSourceKind;
}): V4RolloutStatus['rollout']['stages'] {
  const baselineStatus =
    input.persistenceSourceKind === 'relational-store' || input.dbFile.state === 'ready'
      ? 'ready'
      : input.dbFile.state === 'memory'
        ? 'hold'
        : 'blocked';
  const internalQaStatus =
    baselineStatus === 'ready' && input.metrics.modules.implemented > 0
      ? 'ready'
      : baselineStatus === 'blocked'
        ? 'blocked'
        : 'hold';
  const moduleParityStatus =
    internalQaStatus === 'ready' && input.metrics.modules.scaffold === 0 ? 'ready' : internalQaStatus === 'blocked' ? 'blocked' : 'hold';
  const cutoverStatus =
    moduleParityStatus === 'ready' &&
    input.persistenceSourceKind === 'relational-store' &&
    input.metrics.modules.readWrite > 0
      ? 'ready'
      : moduleParityStatus === 'blocked'
        ? 'blocked'
        : 'hold';

  return [
    {
      id: 'baseline-health',
      label: 'Compatibility baseline',
      status: baselineStatus,
      gate:
        input.persistenceSourceKind === 'relational-store'
          ? 'Configured relational runtime stores satisfy the server-v4 baseline prerequisites.'
          : 'Configured compatibility storage is readable by server-v4 for baseline validation.',
    },
    {
      id: 'internal-qa',
      label: 'Internal QA ready',
      status: internalQaStatus,
      gate: 'At least one runtime module is mounted and ready for internal QA parity checks.',
    },
    {
      id: 'module-parity',
      label: 'Catalog parity ready',
      status: moduleParityStatus,
      gate: 'No metadata-only modules remain in the published catalog, even if compatibility mode is still active.',
    },
    {
      id: 'cutover-ready',
      label: 'Production cutover ready',
      status: cutoverStatus,
      gate: 'Relational runtime stores own hot paths and write-capable routes are available for production cutover.',
    },
  ];
}

function resolveCurrentStage(stages: V4RolloutStatus['rollout']['stages']): RolloutStageId {
  const lastReady = [...stages].reverse().find((stage) => stage.status === 'ready');
  if (lastReady) {
    return lastReady.id;
  }
  return stages.find((stage) => stage.status !== 'ready')?.id ?? 'baseline-health';
}

function resolveRecommendedNextStage(stages: V4RolloutStatus['rollout']['stages']): RolloutStageId | null {
  const currentStage = resolveCurrentStage(stages);
  const currentIndex = stages.findIndex((stage) => stage.id === currentStage);
  if (currentIndex < 0) {
    return null;
  }
  const next = stages.slice(currentIndex + 1).find((stage) => stage.status !== 'ready');
  return next?.id ?? null;
}
