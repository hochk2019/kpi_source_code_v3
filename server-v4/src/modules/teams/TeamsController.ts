import type { Request, Response } from 'express';
import { z } from 'zod';

import { BaseController } from '../../http/BaseController.js';
import type { AuthStore } from '../auth/authStore.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import type { TeamsActor } from './teamsStore.js';
import { TeamsHttpError, TeamsService } from './teamsService.js';

const replaceRosterBodySchema = z.union([
  z
    .object({
      version: z.unknown().optional(),
      teams: z.array(z.unknown()).optional(),
    })
    .passthrough(),
  z.array(z.unknown()),
]);

export class TeamsController extends BaseController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly authStore?: AuthStore,
  ) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    void req;

    try {
      const roster = await this.teamsService.listTeams();
      this.handleSuccess(res, roster);
    } catch (error) {
      this.handleError(error, res, 'list teams');
    }
  }

  async replace(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      const payload = replaceRosterBodySchema.parse(req.body ?? {});
      const roster = await this.teamsService.replaceRoster(actor, payload);
      this.handleSuccess(res, roster);
    } catch (error) {
      this.handleTeamsError(error, res, 'replace teams');
    }
  }

  private async readActor(req: Request): Promise<TeamsActor> {
    const account = await readSessionAccount(this.authStore, readSessionTokenFromRequest(req));
    if (!account) {
      throw new TeamsHttpError(401, 'auth_required', 'Bạn cần đăng nhập để thao tác tổ đội.');
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

  private handleTeamsError(error: unknown, res: Response, context: string): void {
    if (error instanceof TeamsHttpError) {
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
