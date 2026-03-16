import express, { type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import type { AuthStore } from '../auth/authStore.js';
import { DeclarationsController } from './DeclarationsController.js';
import { DeclarationsAlertsService } from './declarationsAlertsService.js';
import { DeclarationsCoMonitoringService } from './declarationsCoMonitoringService.js';
import {
  createDefaultEcusSqlHealthCheck,
  DeclarationsEcusSyncService,
  type EcusSqlHealthCheck,
} from './declarationsEcusSyncService.js';
import { DeclarationsImportService } from './declarationsImportService.js';
import { DeclarationsRepository } from './DeclarationsRepository.js';
import type { DeclarationAsyncReader } from './declarationAsyncReader.js';
import { DeclarationsService } from './declarationsService.js';
import type { DeclarationsStore } from './declarationsStore.js';
import {
  createDefaultCoDiscrepancyRunner,
  type CoDiscrepancyRunner,
} from './ecusCoDiscrepancyRunner.js';
import { createNoopDeclarationsStore } from './noopDeclarationsStore.js';

export function buildDeclarationsRouter(
  domainModule: DomainModule,
  reader: DeclarationAsyncReader,
  store: DeclarationsStore = createNoopDeclarationsStore(),
  authStore?: AuthStore,
  options: {
    ecusImportRunner?: CoDiscrepancyRunner;
    coDiscrepancyRunner?: CoDiscrepancyRunner;
    sqlHealthCheck?: EcusSqlHealthCheck;
  } = {},
): Router {
  const router = express.Router();
  const repository = new DeclarationsRepository(reader);
  const service = new DeclarationsService(repository, store);
  const ecusFetchRunner =
    options.ecusImportRunner ?? options.coDiscrepancyRunner ?? createDefaultCoDiscrepancyRunner(reader);
  const importService = new DeclarationsImportService(repository, store, ecusFetchRunner);
  const alertsService = new DeclarationsAlertsService(repository, store);
  const coMonitoringService = new DeclarationsCoMonitoringService(
    repository,
    importService,
    store,
    options.coDiscrepancyRunner ?? ecusFetchRunner,
  );
  const ecusSyncService = new DeclarationsEcusSyncService(
    store,
    options.sqlHealthCheck ?? createDefaultEcusSqlHealthCheck(),
  );
  const controller = new DeclarationsController(
    service,
    importService,
    alertsService,
    coMonitoringService,
    ecusSyncService,
    authStore,
  );

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/imports/ecus-config', (req, res) => void controller.readEcusConfig(req, res));
  router.post('/imports/ecus-preview', (req, res) => void controller.previewEcusImport(req, res));
  router.post('/imports/ecus-commit', (req, res) => void controller.commitEcusImport(req, res));
  router.get('/imports/co-codes', (req, res) => void controller.readCoCodeConfig(req, res));
  router.put('/imports/co-codes', (req, res) => void controller.updateCoCodeConfig(req, res));
  router.get('/imports/co-discrepancy', (req, res) => void controller.readCoDiscrepancy(req, res));
  router.post('/imports/co-discrepancy/run', (req, res) => void controller.runCoDiscrepancy(req, res));
  router.put('/imports/co-discrepancy/config', (req, res) =>
    void controller.updateCoDiscrepancyConfig(req, res),
  );
  router.get('/imports/alerts', (req, res) => void controller.listImportAlerts(req, res));
  router.get('/imports/alerts/config', (req, res) => void controller.readImportAlertConfig(req, res));
  router.put('/imports/alerts/config', (req, res) => void controller.updateImportAlertConfig(req, res));
  router.post('/imports/alerts/review', (req, res) => void controller.markImportAlertsReviewed(req, res));
  router.post('/imports/alerts/unreview', (req, res) => void controller.unmarkImportAlertsReviewed(req, res));
  router.get('/', (req, res) => void controller.list(req, res));
  router.get('/:declarationId/events', (req, res) => void controller.listEvents(req, res));
  router.patch('/:declarationId', (req, res) => void controller.update(req, res));

  return router;
}
