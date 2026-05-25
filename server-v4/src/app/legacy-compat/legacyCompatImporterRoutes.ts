import type { Request, Response, Router } from 'express';

import { DeclarationsController } from '../../modules/declarations/declarationsController.js';

type LegacyCompatImporterRouteWrapper = (
  method: 'GET' | 'POST' | 'PUT',
  legacyPath: string,
  handler: (req: Request, res: Response) => unknown,
) => (req: Request, res: Response) => unknown;

export function registerLegacyCompatImporterRoutes(
  router: Router,
  context: {
    declarationsController: DeclarationsController;
    wrapImporterCompatRoute: LegacyCompatImporterRouteWrapper;
  },
): void {
  const { declarationsController, wrapImporterCompatRoute } = context;

  router.post(
    '/api/import/ecus/preview',
    wrapImporterCompatRoute('POST', '/api/import/ecus/preview', (req, res) =>
      void declarationsController.previewEcusImport(req, res),
    ),
  );
  router.post(
    '/api/import/ecus/run',
    wrapImporterCompatRoute('POST', '/api/import/ecus/run', (req, res) =>
      void declarationsController.commitEcusImport(req, res),
    ),
  );
  router.get(
    '/api/import/alerts',
    wrapImporterCompatRoute('GET', '/api/import/alerts', (req, res) =>
      void declarationsController.listImportAlerts(req, res),
    ),
  );
  router.get(
    '/api/import/alerts/config',
    wrapImporterCompatRoute('GET', '/api/import/alerts/config', (req, res) =>
      void declarationsController.readImportAlertConfig(req, res),
    ),
  );
  router.put(
    '/api/import/alerts/config',
    wrapImporterCompatRoute('PUT', '/api/import/alerts/config', (req, res) =>
      void declarationsController.updateImportAlertConfig(req, res),
    ),
  );
  router.post(
    '/api/import/alerts/review',
    wrapImporterCompatRoute('POST', '/api/import/alerts/review', (req, res) =>
      void declarationsController.markImportAlertsReviewed(req, res),
    ),
  );
  router.post(
    '/api/import/alerts/unreview',
    wrapImporterCompatRoute('POST', '/api/import/alerts/unreview', (req, res) =>
      void declarationsController.unmarkImportAlertsReviewed(req, res),
    ),
  );
  router.get(
    '/api/import/co-codes',
    wrapImporterCompatRoute('GET', '/api/import/co-codes', (req, res) =>
      void declarationsController.readCoCodeConfig(req, res),
    ),
  );
  router.put(
    '/api/import/co-codes',
    wrapImporterCompatRoute('PUT', '/api/import/co-codes', (req, res) =>
      void declarationsController.updateCoCodeConfig(req, res),
    ),
  );
  router.get(
    '/api/import/co-discrepancy',
    wrapImporterCompatRoute('GET', '/api/import/co-discrepancy', (req, res) =>
      void declarationsController.readCoDiscrepancy(req, res),
    ),
  );
  router.post(
    '/api/import/co-discrepancy/run',
    wrapImporterCompatRoute('POST', '/api/import/co-discrepancy/run', (req, res) =>
      void declarationsController.runCoDiscrepancy(req, res),
    ),
  );
  router.put(
    '/api/import/co-discrepancy/config',
    wrapImporterCompatRoute('PUT', '/api/import/co-discrepancy/config', (req, res) =>
      void declarationsController.updateCoDiscrepancyConfig(req, res),
    ),
  );
}
