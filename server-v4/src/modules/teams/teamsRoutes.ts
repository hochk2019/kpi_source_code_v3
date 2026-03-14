import express, { type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import type { AuthStore } from '../auth/authStore.js';
import type { TeamRosterAsyncReader } from './teamRosterAsyncReader.js';
import { TeamsController } from './TeamsController.js';
import { TeamsRepository } from './TeamsRepository.js';
import { createNoopTeamsStore } from './noopTeamsStore.js';
import { TeamsService } from './teamsService.js';
import type { TeamsStore } from './teamsStore.js';

export function buildTeamsRouter(
  domainModule: DomainModule,
  reader: TeamRosterAsyncReader,
  store: TeamsStore = createNoopTeamsStore(),
  authStore?: AuthStore,
): Router {
  const router = express.Router();
  const repository = new TeamsRepository(reader);
  const service = new TeamsService(repository, store);
  const controller = new TeamsController(service, authStore);

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/', (req, res) => controller.list(req, res));
  router.put('/', (req, res) => controller.replace(req, res));

  return router;
}
