import type { Request, Response } from 'express';
import { ZodError, z } from 'zod';

import { ACCOUNT_PERMISSION_KEYS } from '../../../../packages/domain/src/accountRoles.js';
import {
  MIN_PASSWORD_LENGTH,
  clearSessionCookie,
  getSessionTokenFromRequest,
  setSessionCookie,
} from './authShared.js';
import { AuthHttpError, AuthService } from './authService.js';

const permissionShape = Object.fromEntries(
  ACCOUNT_PERMISSION_KEYS.map((key) => [key, z.boolean().optional()]),
);

const loginBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const createAccountBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().trim().min(MIN_PASSWORD_LENGTH),
  role: z.string().trim().optional(),
  name: z.string().trim().optional(),
  permissions: z.object(permissionShape).partial().optional(),
  memberId: z.string().trim().nullable().optional(),
  memberName: z.string().trim().nullable().optional(),
  teamId: z.string().trim().nullable().optional(),
  teamName: z.string().trim().nullable().optional(),
});

const updateAccountBodySchema = z.object({
  role: z.string().trim().optional(),
  name: z.string().trim().optional(),
  permissions: z.object(permissionShape).partial().optional(),
  memberId: z.string().trim().nullable().optional(),
  memberName: z.string().trim().nullable().optional(),
  teamId: z.string().trim().nullable().optional(),
  teamName: z.string().trim().nullable().optional(),
});

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async login(req: Request, res: Response): Promise<void> {
    try {
      const payload = loginBodySchema.parse(req.body ?? {});
      const result = await this.authService.login(payload);
      setSessionCookie(req, res, result.token, result.expiresAt);
      res.status(200).json({
        ok: true,
        data: {
          user: result.user,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      clearSessionCookie(req, res);
      this.handleError(error, res, 'login');
    }
  }

  async session(req: Request, res: Response): Promise<void> {
    try {
      const token = getSessionTokenFromRequest(req);
      const result = await this.authService.restoreSession(token);
      if (result.clearCookie) {
        clearSessionCookie(req, res);
      }
      res.status(200).json({
        ok: true,
        data: {
          user: result.user,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      this.handleError(error, res, 'restore session');
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const token = getSessionTokenFromRequest(req);
      await this.authService.logout(token);
      clearSessionCookie(req, res);
      res.status(200).json({ ok: true, data: {} });
    } catch (error) {
      this.handleError(error, res, 'logout');
    }
  }

  async listAccounts(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.authService.listAccounts(getSessionTokenFromRequest(req));
      res.status(200).json({ ok: true, data: result });
    } catch (error) {
      this.handleError(error, res, 'list accounts');
    }
  }

  async createAccount(req: Request, res: Response): Promise<void> {
    try {
      const payload = createAccountBodySchema.parse(req.body ?? {});
      const result = await this.authService.createAccount(getSessionTokenFromRequest(req), payload);
      res.status(201).json({ ok: true, data: result });
    } catch (error) {
      this.handleError(error, res, 'create account');
    }
  }

  async updateAccount(req: Request, res: Response): Promise<void> {
    try {
      const payload = updateAccountBodySchema.parse(req.body ?? {});
      const result = await this.authService.updateAccount(
        getSessionTokenFromRequest(req),
        `${req.params.username ?? ''}`,
        payload,
      );
      res.status(200).json({ ok: true, data: result });
    } catch (error) {
      this.handleError(error, res, 'update account');
    }
  }

  private handleError(error: unknown, res: Response, context: string): void {
    if (error instanceof ZodError) {
      res.status(400).json({
        ok: false,
        error: {
          code: 'validation_error',
          message: `Invalid request for ${context}.`,
          details: error.flatten(),
        },
      });
      return;
    }

    if (error instanceof AuthHttpError) {
      res.status(error.statusCode).json({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'internal_error',
        message: `Failed to ${context}.`,
      },
    });
  }
}
