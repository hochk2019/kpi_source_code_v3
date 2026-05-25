import type { Request, Response } from 'express';
import { z } from 'zod';

import { BaseController } from '../../http/BaseController.js';
import type { AuthStore } from '../auth/authStore.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import { KpiAdjustmentsHttpError, KpiAdjustmentsService } from './kpiAdjustmentsService.js';
import type { KpiAdjustmentActor } from './kpiAdjustmentsStore.js';

const listKpiAdjustmentsQuerySchema = z.object({
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
    .optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  staff: z.string().trim().optional(),
  team: z.string().trim().optional(),
  category: z.string().trim().optional(),
  limit: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : value),
    z.coerce.number().int().positive().max(500).optional(),
  ),
});

const adjustmentBodySchema = z.object({
  category: z.string().trim().min(1).optional(),
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
    .optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  staffName: z.string().trim().optional(),
  teamName: z.string().trim().optional(),
  quantity: z.coerce.number().finite().optional(),
  unitPoints: z.coerce.number().finite().optional(),
  extraQuantity: z.coerce.number().finite().nullable().optional(),
  extraUnitPoints: z.coerce.number().finite().nullable().optional(),
  totalPoints: z.coerce.number().finite().optional(),
  note: z.string().trim().optional(),
  mode: z.string().trim().optional(),
  licenseCode: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  taxCode: z.string().trim().optional(),
  references: z.array(z.string().trim()).optional(),
});

const adjustmentSettingsBodySchema = z.object({
  categories: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  autoApprove: z
    .object({
      enabled: z.boolean().optional(),
      note: z.string().trim().nullable().optional(),
    })
    .optional(),
});

export class KpiAdjustmentsController extends BaseController {
  constructor(
    private readonly kpiAdjustmentsService: KpiAdjustmentsService,
    private readonly authStore?: AuthStore,
  ) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = listKpiAdjustmentsQuerySchema.parse({
        month: pickQueryValue(req.query.month),
        status: pickQueryValue(req.query.status),
        staff: pickQueryValue(req.query.staff ?? req.query.staffName),
        team: pickQueryValue(req.query.team ?? req.query.teamName),
        category: pickQueryValue(req.query.category),
        limit: pickQueryValue(req.query.limit),
      });

      const payload = await this.kpiAdjustmentsService.listAdjustments(query);
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleError(error, res, 'list KPI adjustments');
    }
  }

  async readSettings(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      const payload = await this.kpiAdjustmentsService.readSettings(actor);
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleAdjustmentError(error, res, 'read KPI adjustment settings');
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      const payload = adjustmentBodySchema.parse(req.body ?? {});
      const result = await this.kpiAdjustmentsService.createAdjustment(actor, payload);
      this.handleSuccess(res, result, 201);
    } catch (error) {
      this.handleAdjustmentError(error, res, 'create KPI adjustment');
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      const payload = adjustmentBodySchema.parse(req.body ?? {});
      const result = await this.kpiAdjustmentsService.updateAdjustment(
        actor,
        `${req.params.adjustmentId ?? ''}`,
        payload,
      );
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleAdjustmentError(error, res, 'update KPI adjustment');
    }
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      const payload = adjustmentSettingsBodySchema.parse(req.body ?? {});
      const result = await this.kpiAdjustmentsService.updateSettings(actor, payload);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleAdjustmentError(error, res, 'update KPI adjustment settings');
    }
  }

  private async readActor(req: Request): Promise<KpiAdjustmentActor> {
    const account = await readSessionAccount(this.authStore, readSessionTokenFromRequest(req));
    if (!account) {
      throw new KpiAdjustmentsHttpError(401, 'auth_required', 'Bạn cần đăng nhập để thao tác KPI bổ sung.');
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

  private handleAdjustmentError(error: unknown, res: Response, context: string): void {
    if (error instanceof KpiAdjustmentsHttpError) {
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
