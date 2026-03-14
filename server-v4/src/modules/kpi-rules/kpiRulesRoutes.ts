import express, { type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import type { AuthStore } from '../auth/authStore.js';
import { KpiRulesController } from './KpiRulesController.js';
import { KpiRulesRepository } from './KpiRulesRepository.js';
import type { KpiRulesAsyncReader } from './kpiRulesAsyncReader.js';
import { createNoopKpiRulesStore } from './noopKpiRulesStore.js';
import { KpiRulesService } from './kpiRulesService.js';
import type { KpiRulesStore } from './kpiRulesStore.js';

export function buildKpiRulesRouter(
  domainModule: DomainModule,
  reader: KpiRulesAsyncReader,
  store?: KpiRulesStore,
  authStore?: AuthStore,
): Router {
  const router = express.Router();
  const repository = new KpiRulesRepository(reader);
  const service = new KpiRulesService(repository, store ?? createNoopKpiRulesStore());
  const controller = new KpiRulesController(service, authStore);

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/', (req, res) => void controller.list(req, res));
  router.post('/', (req, res) => void controller.create(req, res));
  router.post('/:ruleSetId/activate', (req, res) => void controller.activate(req, res));

  return router;
}
