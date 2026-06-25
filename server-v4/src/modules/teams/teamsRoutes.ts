import express, { type Router } from 'express';
import { z } from 'zod';

import type { DomainModule } from '../../app/domain-module.js';
import { validateBody } from '../../middleware/validateBody.js';
import type { AuthStore } from '../auth/authStore.js';
import type { TeamRosterAsyncReader } from './teamRosterAsyncReader.js';
import { TeamsController } from './TeamsController.js';
import { TeamsRepository } from './TeamsRepository.js';
import { createNoopTeamsStore } from './noopTeamsStore.js';
import { TeamsService } from './teamsService.js';
import type { TeamsStore } from './teamsStore.js';

const replaceRosterBodySchema = z.union([
  z
    .object({
      version: z.unknown().optional(),
      teams: z.array(z.unknown()).optional(),
    })
    .passthrough(),
  z.array(z.unknown()),
]);

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
  router.put('/', validateBody(replaceRosterBodySchema), (req, res) => controller.replace(req, res));

  return router;
}
