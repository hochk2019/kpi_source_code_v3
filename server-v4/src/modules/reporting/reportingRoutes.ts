import express, { type Request, type Response, type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import type { ReportingProjectionPersistence } from '../../persistence/reportingProjectionPersistence.js';
import { ReportingController } from './ReportingController.js';
import { ReportingRepository, type ReportingRepositoryReaders } from './ReportingRepository.js';
import { ReportingService } from './reportingService.js';

export type ReportingRouterReaders = ReportingRepositoryReaders;

export type ReportingRuntime = {
  exportReport?: (req: Request, res: Response) => Promise<void> | void;
  listExportAudit?: (req: Request, res: Response) => Promise<void> | void;
  exportAdminAudit?: (req: Request, res: Response) => Promise<void> | void;
};

export function buildReportingRouter(
  domainModule: DomainModule,
  projections: ReportingProjectionPersistence,
  readers: ReportingRouterReaders,
  runtime?: ReportingRuntime,
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
  router.post('/exports', async (req, res) => {
    const handler = runtime?.exportReport;
    if (typeof handler !== 'function') {
      res.status(503).json({ ok: false, error: 'Report export runtime chưa sẵn sàng.' });
      return;
    }
    await handler(req, res);
  });
  router.get('/exports/audit', async (req, res) => {
    const handler = runtime?.listExportAudit;
    if (typeof handler !== 'function') {
      res.status(503).json({ ok: false, error: 'Report export audit runtime chưa sẵn sàng.' });
      return;
    }
    await handler(req, res);
  });
  router.get('/audit/export', async (req, res) => {
    const handler = runtime?.exportAdminAudit;
    if (typeof handler !== 'function') {
      res.status(503).json({ ok: false, error: 'Admin audit export runtime chưa sẵn sàng.' });
      return;
    }
    await handler(req, res);
  });
  router.get('/schedules', (req, res) => void controller.listSchedules(req, res));
  router.post('/schedules', (req, res) => void controller.saveSchedule(req, res));
  router.delete('/schedules/:id', (req, res) => void controller.deleteSchedule(req, res));

  return router;
}
