import express, { type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import type { MstAssignmentAsyncReader } from './mstAssignmentAsyncReader.js';
import { MstAssignmentsController } from './MstAssignmentsController.js';
import { MstAssignmentsRepository } from './MstAssignmentsRepository.js';
import { MstAssignmentsService } from './mstAssignmentsService.js';

export function buildMstAssignmentsRouter(
  domainModule: DomainModule,
  reader: MstAssignmentAsyncReader
): Router {
  const router = express.Router();
  const repository = new MstAssignmentsRepository(reader);
  const service = new MstAssignmentsService(repository);
  const controller = new MstAssignmentsController(service);

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/', (req, res) => controller.list(req, res));
  router.get('/resolve', (req, res) => controller.resolve(req, res));

  return router;
}
