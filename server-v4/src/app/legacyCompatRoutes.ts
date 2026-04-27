/**
 * @deprecated Legacy compatibility routes — bridges old API shape to new v4 handlers.
 * Will be removed when all clients migrate to v4 API directly. Tracked under CQ-007.
 */
import express, { type Request, type Response, type Router } from 'express';

import type { RuntimePersistence } from '../persistence/runtimePersistence.js';
import {
  getImporterCompatRouteDefinition,
  type ImporterCompatTrafficTracker,
} from './importerCompatTraffic.js';
import { registerLegacyCompatAuthRoutes } from './legacy-compat/legacyCompatAuthRoutes.js';
import { registerLegacyCompatBootstrapRoutes } from './legacy-compat/legacyCompatBootstrapRoutes.js';
import { registerLegacyCompatImporterRoutes } from './legacy-compat/legacyCompatImporterRoutes.js';
import { registerLegacyCompatStorageRoutes } from './legacy-compat/legacyCompatStorageRoutes.js';
import { DeclarationsController } from '../modules/declarations/DeclarationsController.js';
import { DeclarationsAlertsService } from '../modules/declarations/declarationsAlertsService.js';
import { DeclarationsCoMonitoringService } from '../modules/declarations/declarationsCoMonitoringService.js';
import {
  createDefaultEcusSqlHealthCheck,
  DeclarationsEcusSyncService,
  type EcusSqlHealthCheck,
} from '../modules/declarations/declarationsEcusSyncService.js';
import { DeclarationsImportService } from '../modules/declarations/declarationsImportService.js';
import { DeclarationsImportJobService } from '../modules/declarations/declarationsImportJobService.js';
import { DeclarationsRepository } from '../modules/declarations/DeclarationsRepository.js';
import { DeclarationsService } from '../modules/declarations/declarationsService.js';
import {
  createDefaultCoDiscrepancyRunner,
  type CoDiscrepancyRunner,
} from '../modules/declarations/ecusCoDiscrepancyRunner.js';
import { AuthService } from '../modules/auth/authService.js';

export function buildLegacyCompatRouter(
  persistence: RuntimePersistence,
  options: {
    ecusImportRunner?: CoDiscrepancyRunner;
    coDiscrepancyRunner?: CoDiscrepancyRunner;
    sqlHealthCheck?: EcusSqlHealthCheck;
    importerCompatTracker?: ImporterCompatTrafficTracker;
  } = {},
): Router {
  const router = express.Router();
  const authService = new AuthService(persistence.authStore);
  const declarationsRepository = new DeclarationsRepository(persistence.declarationsReader);
  const declarationsService = new DeclarationsService(
    declarationsRepository,
    persistence.declarationsStore,
  );
  const ecusFetchRunner =
    options.ecusImportRunner ??
    options.coDiscrepancyRunner ??
    createDefaultCoDiscrepancyRunner(persistence.declarationsReader);
  const declarationsImportService = new DeclarationsImportService(
    declarationsRepository,
    persistence.declarationsStore,
    ecusFetchRunner,
  );
  const declarationsImportJobService = new DeclarationsImportJobService(declarationsImportService);
  const declarationsAlertsService = new DeclarationsAlertsService(
    declarationsRepository,
    persistence.declarationsStore,
  );
  const declarationsCoMonitoringService = new DeclarationsCoMonitoringService(
    declarationsRepository,
    declarationsImportService,
    persistence.declarationsStore,
    options.coDiscrepancyRunner ?? ecusFetchRunner,
  );
  const declarationsEcusSyncService = new DeclarationsEcusSyncService(
    persistence.declarationsStore,
    options.sqlHealthCheck ?? createDefaultEcusSqlHealthCheck(),
  );
  const declarationsController = new DeclarationsController(
    declarationsService,
    declarationsImportService,
    declarationsImportJobService,
    declarationsAlertsService,
    declarationsCoMonitoringService,
    declarationsEcusSyncService,
    persistence.authStore,
  );
  const importerCompatTracker = options.importerCompatTracker;

  const wrapImporterCompatRoute = (
    method: 'GET' | 'POST' | 'PUT',
    legacyPath: string,
    handler: (req: Request, res: Response) => unknown,
  ) => {
    const route = getImporterCompatRouteDefinition(method, legacyPath);

    return (req: Request, res: Response) => {
      if (route && importerCompatTracker) {
        const blocked = importerCompatTracker.shouldBlock(route);
        importerCompatTracker.record(route, { blocked });
        if (blocked) {
          res.status(409).json({
            ok: false,
            error:
              'Legacy importer compatibility route is blocked during staged cutover. Use the canonical declarations route instead.',
            legacyRoute: route.legacyPath,
            canonicalRoute: route.canonicalPath,
          });
          return;
        }
      }

      return handler(req, res);
    };
  };

  router.get('/api/health', async (_req, res) => {
    res.status(200).json({
      ok: true,
      version: 'legacy-compat',
      source: persistence.sourceKind,
    });
  });

  registerLegacyCompatAuthRoutes(router, { persistence, authService });
  registerLegacyCompatBootstrapRoutes(router, { persistence, authService });
  registerLegacyCompatImporterRoutes(router, {
    declarationsController,
    wrapImporterCompatRoute,
  });
  registerLegacyCompatStorageRoutes(router, { persistence, authService });

  return router;
}
