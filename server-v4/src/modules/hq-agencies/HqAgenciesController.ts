import type { Request, Response } from 'express';
import { z } from 'zod';

import { BaseController } from '../../http/BaseController.js';
import type { AuthStore } from '../auth/authStore.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import type { HqAgencyActor } from './hqAgenciesStore.js';
import { HqAgenciesHttpError, HqAgenciesService } from './hqAgenciesService.js';

const listBindingsQuerySchema = z.object({
  mst: z.string().trim().optional(),
  company: z.string().trim().optional(),
  agent: z.string().trim().optional(),
  limit: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : value),
    z.coerce.number().int().positive().max(500).optional(),
  ),
});

const listHistoryQuerySchema = z.object({
  mst: z.string().trim().optional(),
  limit: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : value),
    z.coerce.number().int().positive().max(500).optional(),
  ),
});

export class HqAgenciesController extends BaseController {
  constructor(
    private readonly hqAgenciesService: HqAgenciesService,
    private readonly authStore?: AuthStore,
  ) {
    super();
  }

  async listBindings(req: Request, res: Response): Promise<void> {
    try {
      const query = listBindingsQuerySchema.parse({
        mst: pickQueryValue(req.query.mst ?? req.query.taxCode),
        company: pickQueryValue(req.query.company ?? req.query.companyName),
        agent: pickQueryValue(req.query.agent),
        limit: pickQueryValue(req.query.limit),
      });

      const payload = await this.hqAgenciesService.listBindings(query);
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleError(error, res, 'list HQ agencies');
    }
  }

  async listHistory(req: Request, res: Response): Promise<void> {
    try {
      const query = listHistoryQuerySchema.parse({
        mst: pickQueryValue(req.query.mst ?? req.query.taxCode),
        limit: pickQueryValue(req.query.limit),
      });

      const payload = await this.hqAgenciesService.listHistory(query);
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleError(error, res, 'list HQ agency history');
    }
  }

  async upsertBinding(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      const payload = bindingBodySchema.parse(req.body ?? {});
      const result = await this.hqAgenciesService.upsertBinding(actor, payload);
      this.handleSuccess(res, result, result.operation === 'create' ? 201 : 200);
    } catch (error) {
      this.handleHqAgenciesError(error, res, 'upsert HQ agency');
    }
  }

  async deleteBinding(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      const result = await this.hqAgenciesService.deleteBinding(actor, `${req.params.taxCode ?? ''}`);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleHqAgenciesError(error, res, 'delete HQ agency');
    }
  }

  private async readActor(req: Request): Promise<HqAgencyActor> {
    const account = await readSessionAccount(this.authStore, readSessionTokenFromRequest(req));
    if (!account) {
      throw new HqAgenciesHttpError(401, 'auth_required', 'Bạn cần đăng nhập để thao tác Đại lý HQ.');
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

  private handleHqAgenciesError(error: unknown, res: Response, context: string): void {
    if (error instanceof HqAgenciesHttpError) {
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

const agentFieldSchema = z.union([z.string().trim(), z.array(z.string().trim())]).optional();

const bindingBodySchema = z.object({
  mst: z.string().trim().optional(),
  taxCode: z.string().trim().optional(),
  tax_code: z.string().trim().optional(),
  company: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  company_name: z.string().trim().optional(),
  agents: agentFieldSchema,
  agent: agentFieldSchema,
  agency: agentFieldSchema,
  dai_ly: agentFieldSchema,
  dai_ly_hq: agentFieldSchema,
});
