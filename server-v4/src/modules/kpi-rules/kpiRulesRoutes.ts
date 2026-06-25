import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';

import type { DomainModule } from '../../app/domain-module.js';
import { validateBody } from '../../middleware/validateBody.js';
import type { AuthStore } from '../auth/authStore.js';
import { KpiRulesController } from './KpiRulesController.js';
import { KpiRulesRepository } from './KpiRulesRepository.js';
import type { KpiRulesAsyncReader } from './kpiRulesAsyncReader.js';
import { createNoopKpiRulesStore } from './noopKpiRulesStore.js';
import { KpiRulesService } from './kpiRulesService.js';
import type { KpiRulesStore } from './kpiRulesStore.js';

export type KpiRulesRuntime = {
  getRulesHistory?: (req: Request, res: Response) => Promise<void> | void;
};

const createRuleSetRouteSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  applyFrom: z.string().trim().optional(),
  groups: z.record(z.string(), z.object({}).passthrough()).optional(),
  license: z.object({}).passthrough().optional(),
  bonuses: z.object({}).passthrough().optional(),
});

export function buildKpiRulesRouter(
  domainModule: DomainModule,
  reader: KpiRulesAsyncReader,
  store?: KpiRulesStore,
  authStore?: AuthStore,
  runtime?: KpiRulesRuntime,
): Router {
  const router = express.Router();
  const repository = new KpiRulesRepository(reader);
  const service = new KpiRulesService(repository, store ?? createNoopKpiRulesStore());
  const controller = new KpiRulesController(service, authStore);

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/history', async (req, res) => {
    const handler = runtime?.getRulesHistory;
    if (typeof handler !== 'function') {
      res.status(503).json({ ok: false, error: 'Rules history runtime chưa sẵn sàng.' });
      return;
    }

    await handler(req, res);
  });

  router.get('/', (req, res) => void controller.list(req, res));
  router.post('/', validateBody(createRuleSetRouteSchema), (req, res) => void controller.create(req, res));
  router.post('/:ruleSetId/activate', (req, res) => void controller.activate(req, res));

  return router;
}
