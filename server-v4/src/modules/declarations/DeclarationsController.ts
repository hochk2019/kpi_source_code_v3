import type { Request, Response } from 'express';
import { z } from 'zod';

import { BaseController } from '../../http/BaseController.js';
import type { AuthStore } from '../auth/authStore.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import { DeclarationsAlertsService } from './declarationsAlertsService.js';
import { DeclarationsCoMonitoringService } from './declarationsCoMonitoringService.js';
import { DeclarationsEcusSyncService } from './declarationsEcusSyncService.js';
import {
  type DeclarationsImportCommitRequest,
  type DeclarationsImportService,
} from './declarationsImportService.js';
import type { DeclarationActor } from './declarationsStore.js';
import { DeclarationsHttpError, DeclarationsService } from './declarationsService.js';
import { readEcusBridgeActor, readEcusSyncManageActor } from './ecusBridgeAccess.js';

const listDeclarationsQuerySchema = z.object({
  mst: z.string().trim().optional(),
  soTk: z.string().trim().optional(),
  branch: z.string().trim().optional(),
  limit: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : value),
      z.coerce.number().int().positive().max(500).optional()
    ),
});

const legacyImportSearchQuerySchema = z.object({
  page: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  pageSize: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
});

const declarationEventsQuerySchema = z.object({
  limit: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : value),
    z.coerce.number().int().positive().max(500).optional(),
  ),
});

const declarationPatchBodySchema = z.object({
  nhan_vien: z.string().trim().optional(),
  staffName: z.string().trim().optional(),
  staff_name_snapshot: z.string().trim().optional(),
  team: z.string().trim().optional(),
  teamName: z.string().trim().optional(),
  team_name_snapshot: z.string().trim().optional(),
  agency: z.string().trim().optional(),
  dai_ly: z.string().trim().optional(),
  agencyText: z.string().trim().optional(),
  agency_text: z.string().trim().optional(),
  licenses: z.union([z.coerce.number().finite(), z.literal('')]).optional(),
  so_luong_gp: z.union([z.coerce.number().finite(), z.literal('')]).optional(),
  licenseManualCount: z.union([z.coerce.number().finite(), z.null()]).optional(),
  license_count: z.union([z.coerce.number().finite(), z.literal('')]).optional(),
  licenseCodes: z.array(z.string().trim()).optional(),
  license_codes: z.array(z.string().trim()).optional(),
  licenseSourceCodes: z.array(z.string().trim()).optional(),
  license_source_codes: z.array(z.string().trim()).optional(),
  licenseExcludedCodes: z.array(z.string().trim()).optional(),
  license_excluded_codes: z.array(z.string().trim()).optional(),
});

const ecusRangeSchema = z
  .object({
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
  })
  .optional();

const ecusImportPreviewBodySchema = z.object({
  rawRows: z.array(z.unknown()).optional(),
  range: ecusRangeSchema,
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  limit: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : value),
    z.coerce.number().int().positive().max(5000).optional(),
  ),
  includeTaxCodes: z.array(z.string().trim()).optional(),
  excludeTaxCodes: z.array(z.string().trim()).optional(),
});

const ecusImportCommitBodySchema = ecusImportPreviewBodySchema.extend({
  fetchedTotal: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : value),
    z.coerce.number().int().nonnegative().optional(),
  ),
  actor: z.string().trim().optional(),
  reason: z.string().trim().optional(),
});

const declarationAlertConfigBodySchema = z.object({
  config: z.record(z.unknown()).optional().default({}),
});

const coMonitoringConfigBodySchema = z.object({
  config: z.record(z.unknown()).optional().default({}),
});

const ecusSyncConfigBodySchema = z.object({
  config: z.record(z.unknown()).optional().default({}),
  preservePassword: z.boolean().optional().default(false),
});

const coDiscrepancyRunBodySchema = z.object({
  range: ecusRangeSchema,
  reason: z.string().trim().optional(),
});

const declarationAlertKeysBodySchema = z.object({
  keys: z.array(z.string().trim()).optional().default([]),
});

export class DeclarationsController extends BaseController {
  constructor(
    private readonly declarationsService: DeclarationsService,
    private readonly declarationsImportService: DeclarationsImportService,
    private readonly declarationsAlertsService: DeclarationsAlertsService,
    private readonly declarationsCoMonitoringService: DeclarationsCoMonitoringService,
    private readonly declarationsEcusSyncService: DeclarationsEcusSyncService,
    private readonly authStore?: AuthStore,
  ) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = listDeclarationsQuerySchema.parse({
        mst: pickQueryValue(req.query.mst),
        soTk: pickQueryValue(req.query.soTk ?? req.query.so_tk),
        branch: pickQueryValue(req.query.branch ?? req.query.nhanh),
        limit: pickQueryValue(req.query.limit),
      });

      const payload = await this.declarationsService.listDeclarations(query);
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleError(error, res, 'list declarations');
    }
  }

  async searchLegacyImportDeclarations(req: Request, res: Response): Promise<void> {
    try {
      await this.readActor(req, 'Bạn cần đăng nhập để tra cứu tờ khai.');
      const query = legacyImportSearchQuerySchema.parse({
        page: pickQueryValue(req.query.page),
        pageSize: pickQueryValue(req.query.pageSize),
      });
      const result = await this.declarationsService.searchImportDeclarations({
        filters: req.query ?? {},
        page: query.page,
        pageSize: query.pageSize,
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'search legacy import declarations');
    }
  }

  async listEvents(req: Request, res: Response): Promise<void> {
    try {
      const query = declarationEventsQuerySchema.parse({
        limit: pickQueryValue(req.query.limit),
      });

      const payload = await this.declarationsService.listDeclarationEvents(
        `${req.params.declarationId ?? ''}`,
        query,
      );
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleDeclarationsError(error, res, 'list declaration events');
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để chỉnh sửa tờ khai.');
      const payload = declarationPatchBodySchema.parse(req.body ?? {});
      const result = await this.declarationsService.patchDeclaration(
        actor,
        `${req.params.declarationId ?? ''}`,
        payload,
      );
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleDeclarationsError(error, res, 'update declaration');
    }
  }

  async previewEcusImport(req: Request, res: Response): Promise<void> {
    try {
      const actor = await readEcusBridgeActor(req, this.authStore);
      const payload = ecusImportPreviewBodySchema.parse(req.body ?? {});
      const preview = await this.declarationsImportService.previewEcusImport(
        actor,
        {
          rawRows: payload.rawRows,
          rangeInput: payload.range ?? { from: payload.from, to: payload.to },
          includeTaxCodes: payload.includeTaxCodes,
          excludeTaxCodes: payload.excludeTaxCodes,
        },
        { limit: payload.limit },
      );

      res.json({
        ok: true,
        preview: {
          rows: preview.rows,
          limited: preview.limited,
          fetched: preview.fetched,
          range: preview.range,
        },
      });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'preview ECUS import');
    }
  }

  async commitEcusImport(req: Request, res: Response): Promise<void> {
    try {
      const actor = await readEcusBridgeActor(req, this.authStore);
      const payload = ecusImportCommitBodySchema.parse(req.body ?? {});
      const result = await this.declarationsImportService.commitEcusImport(
        actor,
        {
          rawRows: payload.rawRows,
          fetchedTotal: payload.fetchedTotal,
          actor: payload.actor,
          reason: payload.reason,
          rangeInput: payload.range ?? { from: payload.from, to: payload.to },
          includeTaxCodes: payload.includeTaxCodes,
          excludeTaxCodes: payload.excludeTaxCodes,
        } satisfies DeclarationsImportCommitRequest,
      );

      res.json({ ok: true, result });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'commit ECUS import');
    }
  }

  async readEcusConfig(req: Request, res: Response): Promise<void> {
    try {
      const actor = await readEcusBridgeActor(req, this.authStore);
      const config = await this.declarationsEcusSyncService.readConfig(actor);
      res.json({ ok: true, config });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'read ECUS sync config');
    }
  }

  async readLegacyEcusConfig(req: Request, res: Response): Promise<void> {
    try {
      const actor = await readEcusSyncManageActor(req, this.authStore);
      const config = await this.declarationsEcusSyncService.readConfig(actor);
      res.json({ ok: true, config });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'read legacy ECUS sync config');
    }
  }

  async updateLegacyEcusConfig(req: Request, res: Response): Promise<void> {
    try {
      const actor = await readEcusSyncManageActor(req, this.authStore);
      const rawBody = isRecord(req.body) ? req.body : {};
      const { preservePassword, config: wrappedConfig, ...legacyConfig } = rawBody;
      const payload = ecusSyncConfigBodySchema.parse({
        config: isRecord(wrappedConfig) ? wrappedConfig : legacyConfig,
        preservePassword,
      });
      const config = await this.declarationsEcusSyncService.updateConfig(actor, payload.config, {
        preservePassword: payload.preservePassword,
      });
      res.json({ ok: true, config });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'update legacy ECUS sync config');
    }
  }

  async readLegacyEcusStatus(req: Request, res: Response): Promise<void> {
    try {
      const actor = await readEcusSyncManageActor(req, this.authStore);
      const payload = await this.declarationsEcusSyncService.readStatus(actor);
      res.json({ ok: true, ...payload });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'read legacy ECUS sync status');
    }
  }

  async readCoCodeConfig(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để quản lý cấu hình C/O.');
      const config = await this.declarationsCoMonitoringService.readCoCodeConfig(actor);
      res.json({ ok: true, config });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'read C/O code config');
    }
  }

  async updateCoCodeConfig(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để quản lý cấu hình C/O.');
      const payload = coMonitoringConfigBodySchema.parse(req.body ?? {});
      const config = await this.declarationsCoMonitoringService.updateCoCodeConfig(actor, payload.config);
      res.json({ ok: true, config });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'update C/O code config');
    }
  }

  async readCoDiscrepancy(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để quản lý đối soát C/O.');
      const payload = await this.declarationsCoMonitoringService.readCoDiscrepancy(actor);
      res.json({ ok: true, ...payload });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'read C/O discrepancy state');
    }
  }

  async updateCoDiscrepancyConfig(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để quản lý đối soát C/O.');
      const payload = coMonitoringConfigBodySchema.parse(req.body ?? {});
      const config = await this.declarationsCoMonitoringService.updateCoDiscrepancyConfig(
        actor,
        payload.config,
      );
      res.json({ ok: true, config });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'update C/O discrepancy config');
    }
  }

  async runCoDiscrepancy(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để quản lý đối soát C/O.');
      const payload = coDiscrepancyRunBodySchema.parse(req.body ?? {});
      const result = await this.declarationsCoMonitoringService.runCoDiscrepancy(actor, {
        rangeInput: payload.range,
        reason: payload.reason,
      });
      res.json({ ok: true, result });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'run C/O discrepancy check');
    }
  }

  async listImportAlerts(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để xem hoặc quản lý cảnh báo tờ khai.');
      const payload = await this.declarationsAlertsService.listAlerts(actor);
      res.json({ ok: true, ...payload });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'list declaration alerts');
    }
  }

  async readImportAlertConfig(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để xem hoặc quản lý cảnh báo tờ khai.');
      const config = await this.declarationsAlertsService.readAlertConfig(actor);
      res.json({ ok: true, config });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'read declaration alert config');
    }
  }

  async updateImportAlertConfig(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để xem hoặc quản lý cảnh báo tờ khai.');
      const payload = declarationAlertConfigBodySchema.parse(req.body ?? {});
      const result = await this.declarationsAlertsService.updateAlertConfig(actor, payload.config);
      res.json({ ok: true, ...result });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'update declaration alert config');
    }
  }

  async markImportAlertsReviewed(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để xem hoặc quản lý cảnh báo tờ khai.');
      const payload = declarationAlertKeysBodySchema.parse(req.body ?? {});
      const result = await this.declarationsAlertsService.markReviewed(actor, payload.keys);
      res.json({ ok: true, ...result });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'mark declaration alerts reviewed');
    }
  }

  async unmarkImportAlertsReviewed(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req, 'Bạn cần đăng nhập để xem hoặc quản lý cảnh báo tờ khai.');
      const payload = declarationAlertKeysBodySchema.parse(req.body ?? {});
      const result = await this.declarationsAlertsService.unmarkReviewed(actor, payload.keys);
      res.json({ ok: true, ...result });
    } catch (error) {
      this.handleDeclarationsError(error, res, 'unmark declaration alerts reviewed');
    }
  }

  private async readActor(req: Request, authRequiredMessage: string): Promise<DeclarationActor> {
    const account = await readSessionAccount(this.authStore, readSessionTokenFromRequest(req));
    if (!account) {
      throw new DeclarationsHttpError(401, 'auth_required', authRequiredMessage);
    }

    return {
      username: account.username,
      role: account.role,
      name: account.name,
      permissions: account.permissions,
      memberId: account.memberId,
      memberName: account.memberName,
      teamId: account.teamId,
      teamName: account.teamName,
    };
  }

  private handleDeclarationsError(error: unknown, res: Response, context: string): void {
    if (error instanceof DeclarationsHttpError) {
      res.status(error.statusCode).json({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    this.handleError(error, res, context);
  }
}

function pickQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
