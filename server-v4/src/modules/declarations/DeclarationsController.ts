import type { Request, Response } from 'express';
import { z } from 'zod';

import { BaseController } from '../../http/BaseController.js';
import type { AuthStore } from '../auth/authStore.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import type { DeclarationActor } from './declarationsStore.js';
import { DeclarationsHttpError, DeclarationsService } from './declarationsService.js';

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

export class DeclarationsController extends BaseController {
  constructor(
    private readonly declarationsService: DeclarationsService,
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
      const actor = await this.readActor(req);
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

  private async readActor(req: Request): Promise<DeclarationActor> {
    const account = await readSessionAccount(this.authStore, readSessionTokenFromRequest(req));
    if (!account) {
      throw new DeclarationsHttpError(401, 'auth_required', 'Bạn cần đăng nhập để chỉnh sửa tờ khai.');
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
