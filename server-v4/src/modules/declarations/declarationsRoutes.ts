import express, { type Router } from 'express';
import { z } from 'zod';

import type { DomainModule } from '../../app/domain-module.js';
import { validateBody } from '../../middleware/validateBody.js';
import type { AuthStore } from '../auth/authStore.js';
import { DeclarationsController } from './declarationsController.js';
import { DeclarationsAlertsService } from './declarationsAlertsService.js';
import { DeclarationsCoMonitoringService } from './declarationsCoMonitoringService.js';
import {
  createDefaultEcusSqlHealthCheck,
  DeclarationsEcusSyncService,
  type EcusSqlHealthCheck,
} from './declarationsEcusSyncService.js';
import { DeclarationsImportService } from './declarationsImportService.js';
import { DeclarationsImportJobService } from './declarationsImportJobService.js';
import { DeclarationsRepository } from './DeclarationsRepository.js';
import type { DeclarationAsyncReader } from './declarationAsyncReader.js';
import { DeclarationsService } from './declarationsService.js';
import type { DeclarationsStore } from './declarationsStore.js';
import type { DeclarationsImportJobStore } from './declarationsImportJobStore.js';
import {
  createDefaultCoDiscrepancyRunner,
  type CoDiscrepancyRunner,
} from './ecusCoDiscrepancyRunner.js';
import { createNoopDeclarationsStore } from './noopDeclarationsStore.js';

// ---------------------------------------------------------------------------
// Route-level Zod schemas for request body validation
// ---------------------------------------------------------------------------

const ecusRangeSchema = z
  .object({ from: z.string().trim().optional(), to: z.string().trim().optional() })
  .optional();

const ecusSyncConfigSchema = z.object({
  config: z.record(z.unknown()).optional().default({}),
  preservePassword: z.boolean().optional().default(false),
});

const ecusImportPreviewSchema = z.object({
  rawRows: z.array(z.unknown()).optional(),
  range: ecusRangeSchema,
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  limit: z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? undefined : v),
    z.coerce.number().int().positive().max(5000).optional(),
  ),
  includeTaxCodes: z.array(z.string().trim()).optional(),
  excludeTaxCodes: z.array(z.string().trim()).optional(),
});

const ecusImportCommitSchema = ecusImportPreviewSchema.extend({
  fetchedTotal: z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? undefined : v),
    z.coerce.number().int().nonnegative().optional(),
  ),
  actor: z.string().trim().optional(),
  reason: z.string().trim().optional(),
  previewHash: z.string().trim().optional(),
  async: z.boolean().optional().default(false),
});

const coDiscrepancyRunSchema = z.object({
  range: ecusRangeSchema,
  reason: z.string().trim().optional(),
});

const coMonitoringConfigSchema = z.object({
  config: z.record(z.unknown()).optional().default({}),
});

const alertConfigSchema = z.object({
  config: z.record(z.unknown()).optional().default({}),
});

const alertKeysSchema = z.object({
  keys: z.array(z.string().trim()).optional().default([]),
});

const declarationPatchSchema = z.object({
  nhan_vien: z.string().trim().optional(),
  staffName: z.string().trim().optional(),
  staff_name_snapshot: z.string().trim().optional(),
  team: z.string().trim().optional(),
  teamName: z.string().trim().optional(),
  team_name_snapshot: z.string().trim().optional(),
  agency: z.string().trim().optional(),
  dai_ly: z.string().trim().optional(),
  agencyText: z.string().trim().optional(),
  agency_text: z.string().trim().optional(),
  licenses: z.union([z.coerce.number().finite(), z.literal('')]).optional(),
  so_luong_gp: z.union([z.coerce.number().finite(), z.literal('')]).optional(),
  licenseManualCount: z.union([z.coerce.number().finite(), z.null()]).optional(),
  license_count: z.union([z.coerce.number().finite(), z.literal('')]).optional(),
  licenseCodes: z.array(z.string().trim()).optional(),
  license_codes: z.array(z.string().trim()).optional(),
  licenseSourceCodes: z.array(z.string().trim()).optional(),
  license_source_codes: z.array(z.string().trim()).optional(),
  licenseExcludedCodes: z.array(z.string().trim()).optional(),
  license_excluded_codes: z.array(z.string().trim()).optional(),
});

export function buildDeclarationsRouter(
  domainModule: DomainModule,
  reader: DeclarationAsyncReader,
  store: DeclarationsStore = createNoopDeclarationsStore(),
  authStore?: AuthStore,
  options: {
    ecusImportRunner?: CoDiscrepancyRunner;
    coDiscrepancyRunner?: CoDiscrepancyRunner;
    sqlHealthCheck?: EcusSqlHealthCheck;
    jobStore?: DeclarationsImportJobStore;
  } = {},
): Router {
  const router = express.Router();
  const repository = new DeclarationsRepository(reader);
  const service = new DeclarationsService(repository, store);
  const ecusFetchRunner =
    options.ecusImportRunner ?? options.coDiscrepancyRunner ?? createDefaultCoDiscrepancyRunner(reader);
  const importService = new DeclarationsImportService(repository, store, ecusFetchRunner);
  const importJobService = new DeclarationsImportJobService(importService, options.jobStore);
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
    importJobService,
    alertsService,
    coMonitoringService,
    ecusSyncService,
    authStore,
  );

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/imports/ecus-config', (req, res) => void controller.readEcusConfig(req, res));
  router.put('/imports/ecus-config', validateBody(ecusSyncConfigSchema), (req, res) => void controller.updateEcusConfig(req, res));
  router.get('/imports/ecus-status', (req, res) => void controller.readEcusStatus(req, res));
  router.post('/imports/ecus-preview', validateBody(ecusImportPreviewSchema), (req, res) => void controller.previewEcusImport(req, res));
  router.post('/imports/ecus-commit', validateBody(ecusImportCommitSchema), (req, res) => void controller.commitEcusImport(req, res));
  router.get('/imports/ecus-jobs/:jobId', (req, res) => void controller.readEcusImportJob(req, res));
  router.get('/imports/search', (req, res) => void controller.searchImportDeclarations(req, res));
  router.get('/imports/deleted-declarations', (req, res) =>
    void controller.listDeletedDeclarations(req, res),
  );
  router.get('/imports/co-codes', (req, res) => void controller.readCoCodeConfig(req, res));
  router.put('/imports/co-codes', (req, res) => void controller.updateCoCodeConfig(req, res));
  router.get('/imports/co-discrepancy', (req, res) => void controller.readCoDiscrepancy(req, res));
  router.post('/imports/co-discrepancy/run', validateBody(coDiscrepancyRunSchema), (req, res) => void controller.runCoDiscrepancy(req, res));
  router.put('/imports/co-discrepancy/config', validateBody(coMonitoringConfigSchema), (req, res) =>
    void controller.updateCoDiscrepancyConfig(req, res),
  );
  router.get('/imports/alerts', (req, res) => void controller.listImportAlerts(req, res));
  router.get('/imports/alerts/config', (req, res) => void controller.readImportAlertConfig(req, res));
  router.put('/imports/alerts/config', validateBody(alertConfigSchema), (req, res) => void controller.updateImportAlertConfig(req, res));
  router.post('/imports/alerts/review', validateBody(alertKeysSchema), (req, res) => void controller.markImportAlertsReviewed(req, res));
  router.post('/imports/alerts/unreview', validateBody(alertKeysSchema), (req, res) => void controller.unmarkImportAlertsReviewed(req, res));
  router.get('/', (req, res) => void controller.list(req, res));
  router.get('/:declarationId/events', (req, res) => void controller.listEvents(req, res));
  router.patch('/:declarationId', validateBody(declarationPatchSchema), (req, res) => void controller.update(req, res));

  return router;
}
