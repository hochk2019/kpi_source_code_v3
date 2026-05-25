import express, { type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import type { AuthStore } from '../auth/authStore.js';
import type { AdjustmentAsyncReader } from './adjustmentAsyncReader.js';
import { KpiAdjustmentsController } from './KpiAdjustmentsController.js';
import { KpiAdjustmentsRepository } from './KpiAdjustmentsRepository.js';
import { createNoopKpiAdjustmentsStore } from './noopKpiAdjustmentsStore.js';
import { KpiAdjustmentsService } from './kpiAdjustmentsService.js';
import type { KpiAdjustmentsStore } from './kpiAdjustmentsStore.js';

export function buildKpiAdjustmentsRouter(
  domainModule: DomainModule,
  reader: AdjustmentAsyncReader,
  store?: KpiAdjustmentsStore,
  authStore?: AuthStore,
): Router {
  const router = express.Router();
  const repository = new KpiAdjustmentsRepository(reader);
  const service = new KpiAdjustmentsService(repository, store ?? createNoopKpiAdjustmentsStore());
  const controller = new KpiAdjustmentsController(service, authStore);

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/settings', (req, res) => void controller.readSettings(req, res));
  router.put('/settings', (req, res) => void controller.updateSettings(req, res));
  router.get('/', (req, res) => void controller.list(req, res));
  router.post('/', (req, res) => void controller.create(req, res));
  router.patch('/:adjustmentId', (req, res) => void controller.update(req, res));

  return router;
}
