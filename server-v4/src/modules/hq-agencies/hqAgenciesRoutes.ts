import express, { type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import type { AuthStore } from '../auth/authStore.js';
import type { HqAgenciesAsyncReader } from './hqAgenciesAsyncReader.js';
import { HqAgenciesController } from './HqAgenciesController.js';
import { HqAgenciesRepository } from './HqAgenciesRepository.js';
import { HqAgenciesService } from './hqAgenciesService.js';
import { createNoopHqAgenciesStore } from './noopHqAgenciesStore.js';
import type { HqAgenciesStore } from './hqAgenciesStore.js';

export function buildHqAgenciesRouter(
  domainModule: DomainModule,
  reader: HqAgenciesAsyncReader,
  store?: HqAgenciesStore,
  authStore?: AuthStore,
): Router {
  const router = express.Router();
  const repository = new HqAgenciesRepository(reader);
  const service = new HqAgenciesService(repository, store ?? createNoopHqAgenciesStore());
  const controller = new HqAgenciesController(service, authStore);

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/history', (req, res) => void controller.listHistory(req, res));
  router.get('/', (req, res) => void controller.listBindings(req, res));
  router.post('/', (req, res) => void controller.upsertBinding(req, res));
  router.delete('/:taxCode', (req, res) => void controller.deleteBinding(req, res));

  return router;
}
