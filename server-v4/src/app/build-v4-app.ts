import express, { type Express, type Router } from 'express';

import { resolveServerV4Config, type ServerV4ConfigInput } from '../config/server-v4-config.js';
import { buildAuthRouter } from '../modules/auth/authRoutes.js';
import { buildBackupRouter } from '../modules/backup/backupRoutes.js';
import {
  createBackupAdminRuntime,
  type BackupAdminRuntime,
} from '../modules/backup/backupRuntime.js';
import { buildDeclarationsRouter } from '../modules/declarations/declarationsRoutes.js';
import type { EcusSqlHealthCheck } from '../modules/declarations/declarationsEcusSyncService.js';
import type { CoDiscrepancyRunner } from '../modules/declarations/ecusCoDiscrepancyRunner.js';
import { buildHqAgenciesRouter } from '../modules/hq-agencies/hqAgenciesRoutes.js';
import { buildKpiAdjustmentsRouter } from '../modules/kpi-adjustments/kpiAdjustmentsRoutes.js';
import { buildKpiRulesRouter } from '../modules/kpi-rules/kpiRulesRoutes.js';
import { buildMstAssignmentsRouter } from '../modules/mst-assignments/mstAssignmentsRoutes.js';
import { buildReportingRouter } from '../modules/reporting/reportingRoutes.js';
import { buildTeamsRouter } from '../modules/teams/teamsRoutes.js';
import { createRuntimePersistence, type RuntimePersistence } from '../persistence/runtimePersistence.js';
import { createCsrfProtection } from './csrfProtection.js';
import { buildLegacyCompatRouter } from './legacyCompatRoutes.js';
import {
  createImporterCompatTrafficTracker,
  type ImporterCompatGuardMode,
  type ImporterCompatTrafficTracker,
} from './importerCompatTraffic.js';
import { moduleCatalog } from './module-catalog.js';
import { serializeDomainModules, type DomainModule } from './domain-module.js';
import { runtimeModuleRouteCoverage } from './runtimeRouteCoverage.js';
import { buildV4RolloutStatus } from './v4-rollout-status.js';

export type BuildV4AppOptions = ServerV4ConfigInput & {
  modules?: readonly DomainModule[];
  persistence?: RuntimePersistence;
  declarations?: {
    ecusImportRunner?: CoDiscrepancyRunner;
    coDiscrepancyRunner?: CoDiscrepancyRunner;
    sqlHealthCheck?: EcusSqlHealthCheck;
  };
  importerCompat?: {
    guardMode?: ImporterCompatGuardMode;
    tracker?: ImporterCompatTrafficTracker;
  };
  backup?: BackupAdminRuntime;
};

function buildDefaultModuleRouter(domainModule: DomainModule): Router {
  const router = express.Router();

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  return router;
}

function resolveBuildOptions(input: readonly DomainModule[] | BuildV4AppOptions | undefined): BuildV4AppOptions {
  if (Array.isArray(input)) {
    return { modules: input };
  }

  return (input ?? {}) as BuildV4AppOptions;
}

export function buildV4App(input?: readonly DomainModule[] | BuildV4AppOptions): Express {
  const options = resolveBuildOptions(input);
  const app = express();
  const safeModules = serializeDomainModules(options.modules ?? moduleCatalog);
  const config = resolveServerV4Config(options);
  const persistence = options.persistence ?? createRuntimePersistence(config);
  const backupAdmin = options.backup ?? createBackupAdminRuntime({ dbFile: config.dbFile });
  const importerCompatGuardMode =
    options.importerCompat?.guardMode ?? config.importerCompatGuardMode;
  const importerCompatTracker =
    options.importerCompat?.tracker ??
    createImporterCompatTrafficTracker({
      guardMode: importerCompatGuardMode,
    });
  const implementedModuleIds = new Set([
    'auth',
    'kpi-rules',
    'kpi-adjustments',
    'backup',
    'declarations',
    'hq-agencies',
    'mst-assignments',
    'teams',
    'reporting',
  ]);

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(createCsrfProtection());
  app.locals.runtimePersistenceDispose = async () => {
    await persistence.dispose();
    await backupAdmin.dispose?.();
  };

  app.get('/api/v4/health', (_req, res) => {
    const rolloutStatus = buildV4RolloutStatus({
      modules: safeModules,
      dbFile: config.dbFile,
      implementedModuleIds,
      runtimeRouteCoverage: runtimeModuleRouteCoverage,
      persistenceSourceKind: persistence.sourceKind,
      importerCompat: importerCompatTracker.snapshot(),
    });

    res.json({
      ok: true,
      version: 'v4-scaffold',
      moduleCount: safeModules.length,
      modules: safeModules.map((entry) => entry.id),
      db: rolloutStatus.health.dbFile,
      readiness: rolloutStatus.health.readiness,
      metrics: rolloutStatus.metrics,
    });
  });

  app.get('/api/v4/meta/modules', (_req, res) => {
    res.json({
      ok: true,
      modules: safeModules,
    });
  });

  app.get('/api/v4/meta/rollout', (_req, res) => {
    res.json({
      ok: true,
      ...buildV4RolloutStatus({
        modules: safeModules,
        dbFile: config.dbFile,
        implementedModuleIds,
        runtimeRouteCoverage: runtimeModuleRouteCoverage,
        persistenceSourceKind: persistence.sourceKind,
        importerCompat: importerCompatTracker.snapshot(),
      }),
    });
  });

  for (const domainModule of safeModules) {
    if (domainModule.id === 'auth') {
      app.use(domainModule.basePath, buildAuthRouter(domainModule, persistence.authStore));
      continue;
    }

    if (domainModule.id === 'backup') {
      app.use(domainModule.basePath, buildBackupRouter(domainModule, persistence.authStore, backupAdmin));
      continue;
    }

    if (domainModule.id === 'kpi-rules') {
      app.use(
        domainModule.basePath,
        buildKpiRulesRouter(
          domainModule,
          persistence.kpiRulesReader,
          persistence.kpiRulesStore,
          persistence.authStore,
        ),
      );
      continue;
    }

    if (domainModule.id === 'kpi-adjustments') {
      app.use(
        domainModule.basePath,
        buildKpiAdjustmentsRouter(
          domainModule,
          persistence.adjustmentsReader,
          persistence.adjustmentsStore,
          persistence.authStore,
        ),
      );
      continue;
    }

    if (domainModule.id === 'reporting') {
      app.use(
        domainModule.basePath,
        buildReportingRouter(domainModule, persistence.projections, {
          adjustmentsReader: persistence.adjustmentsReader,
          declarationsReader: persistence.declarationsReader,
          kpiRulesReader: persistence.kpiRulesReader,
          teamsReader: persistence.teamsReader,
        }),
      );
      continue;
    }

    if (domainModule.id === 'declarations') {
      app.use(
        domainModule.basePath,
        buildDeclarationsRouter(
          domainModule,
          persistence.declarationsReader,
          persistence.declarationsStore,
          persistence.authStore,
          options.declarations,
        ),
      );
      continue;
    }

    if (domainModule.id === 'hq-agencies') {
      app.use(
        domainModule.basePath,
        buildHqAgenciesRouter(
          domainModule,
          persistence.hqAgenciesReader,
          persistence.hqAgenciesStore,
          persistence.authStore,
        ),
      );
      continue;
    }

    if (domainModule.id === 'mst-assignments') {
      app.use(domainModule.basePath, buildMstAssignmentsRouter(domainModule, persistence.mstAssignmentsReader));
      continue;
    }

    if (domainModule.id === 'teams') {
      app.use(
        domainModule.basePath,
        buildTeamsRouter(
          domainModule,
          persistence.teamsReader,
          persistence.teamsStore,
          persistence.authStore,
        ),
      );
      continue;
    }

    app.use(domainModule.basePath, buildDefaultModuleRouter(domainModule));
  }

  app.use(
    buildLegacyCompatRouter(persistence, {
      ...options.declarations,
      importerCompatTracker,
    }),
  );

  return app;
}
