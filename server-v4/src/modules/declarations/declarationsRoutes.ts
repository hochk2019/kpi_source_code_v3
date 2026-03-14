import express, { type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import type { AuthStore } from '../auth/authStore.js';
import { DeclarationsController } from './DeclarationsController.js';
import { DeclarationsRepository } from './DeclarationsRepository.js';
import type { DeclarationAsyncReader } from './declarationAsyncReader.js';
import { DeclarationsService } from './declarationsService.js';
import type { DeclarationsStore } from './declarationsStore.js';
import { createNoopDeclarationsStore } from './noopDeclarationsStore.js';

export function buildDeclarationsRouter(
  domainModule: DomainModule,
  reader: DeclarationAsyncReader,
  store: DeclarationsStore = createNoopDeclarationsStore(),
  authStore?: AuthStore,
): Router {
  const router = express.Router();
  const repository = new DeclarationsRepository(reader);
  const service = new DeclarationsService(repository, store);
  const controller = new DeclarationsController(service, authStore);

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/', (req, res) => void controller.list(req, res));
  router.get('/:declarationId/events', (req, res) => void controller.listEvents(req, res));
  router.patch('/:declarationId', (req, res) => void controller.update(req, res));

  return router;
}
