import express, { type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import type { ReportingProjectionPersistence } from '../../persistence/reportingProjectionPersistence.js';
import { ReportingController } from './ReportingController.js';
import { ReportingRepository, type ReportingRepositoryReaders } from './ReportingRepository.js';
import { ReportingService } from './reportingService.js';

export type ReportingRouterReaders = ReportingRepositoryReaders;

export function buildReportingRouter(
  domainModule: DomainModule,
  projections: ReportingProjectionPersistence,
  readers: ReportingRouterReaders,
): Router {
  const router = express.Router();
  const repository = new ReportingRepository(projections, readers);
  const service = new ReportingService(repository);
  const controller = new ReportingController(service);

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/view', (req, res) => void controller.getView(req, res));
  router.get('/observability', (req, res) => void controller.getObservability(req, res));
  router.get('/aggregates/monthly', (req, res) => void controller.getMonthlyAggregates(req, res));
  router.get('/schedules', (req, res) => void controller.listSchedules(req, res));
  router.post('/schedules', (req, res) => void controller.saveSchedule(req, res));
  router.delete('/schedules/:id', (req, res) => void controller.deleteSchedule(req, res));

  return router;
}
