import type { Request, Response } from 'express';
import { z } from 'zod';

import { BaseController } from '../../http/BaseController.js';
import type { AuthStore } from '../auth/authStore.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import { KpiRulesHttpError, KpiRulesService } from './kpiRulesService.js';
import type { KpiRulesActor } from './kpiRulesStore.js';

const ruleTierSchema = z.object({
  minItems: z.coerce.number().finite(),
  points: z.coerce.number().finite(),
});

const ruleGroupSchema = z.object({
  key: z.string().trim().optional(),
  title: z.string().trim().optional(),
  description: z.string().trim().optional(),
  codes: z.array(z.string().trim()).optional(),
  base: z.coerce.number().finite().optional(),
  perItem: z.coerce.number().finite().optional(),
  tierMode: z.string().trim().optional(),
  tiers: z.array(ruleTierSchema).optional(),
});

const createRuleSetBodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  applyFrom: z.string().trim().optional(),
  groups: z.record(z.string(), ruleGroupSchema).optional(),
  license: z
    .object({
      defaultPoints: z.coerce.number().finite().optional(),
      codePoints: z
        .array(
          z.object({
            code: z.string().trim().min(1),
            points: z.coerce.number().finite(),
          }),
        )
        .optional(),
      exclude: z
        .object({
          codes: z.array(z.string().trim()).optional(),
          agencies: z
            .array(
              z.object({
                agency: z.string().trim().min(1),
                codes: z.array(z.string().trim()).optional(),
              }),
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
  bonuses: z
    .object({
      co: z
        .object({
          enabled: z.boolean().optional(),
          label: z.string().trim().optional(),
          points: z.coerce.number().finite().optional(),
          perLine: z.coerce.number().finite().optional(),
        })
        .optional(),
    })
    .optional(),
});

export class KpiRulesController extends BaseController {
  constructor(
    private readonly kpiRulesService: KpiRulesService,
    private readonly authStore?: AuthStore,
  ) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      void req;
      const payload = await this.kpiRulesService.getRuleCollection();
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleError(error, res, 'list KPI rules');
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      const payload = createRuleSetBodySchema.parse(req.body ?? {});
      const result = await this.kpiRulesService.createRuleSetDraft(actor, payload);
      this.handleSuccess(res, result, 201);
    } catch (error) {
      this.handleRulesError(error, res, 'create KPI rule set');
    }
  }

  async activate(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      const result = await this.kpiRulesService.activateRuleSet(actor, `${req.params.ruleSetId ?? ''}`);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleRulesError(error, res, 'activate KPI rule set');
    }
  }

  private async readActor(req: Request): Promise<KpiRulesActor> {
    const account = await readSessionAccount(this.authStore, readSessionTokenFromRequest(req));
    if (!account) {
      throw new KpiRulesHttpError(401, 'auth_required', 'Bạn cần đăng nhập để thao tác bộ quy tắc KPI.');
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

  private handleRulesError(error: unknown, res: Response, context: string): void {
    if (error instanceof KpiRulesHttpError) {
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
