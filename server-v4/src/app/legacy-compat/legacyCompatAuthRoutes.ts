import type { Router } from 'express';
import { z } from 'zod';

import type { RuntimePersistence } from '../../persistence/runtimePersistence.js';
import { AuthService } from '../../modules/auth/authService.js';
import {
  MIN_PASSWORD_LENGTH,
  clearSessionCookie,
  getSessionTokenFromRequest,
  setSessionCookie,
} from '../../modules/auth/authShared.js';
import {
  changeOwnPassword,
  deleteAccount,
  handleLegacyAuthError,
  setAccountPassword,
} from './legacyCompatShared.js';

const loginBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const createAccountBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().trim().min(MIN_PASSWORD_LENGTH),
  role: z.string().trim().optional(),
  name: z.string().trim().optional(),
  permissions: z.record(z.boolean()).optional(),
  memberId: z.string().trim().nullable().optional(),
  memberName: z.string().trim().nullable().optional(),
  teamId: z.string().trim().nullable().optional(),
  teamName: z.string().trim().nullable().optional(),
});

const updateAccountBodySchema = z.object({
  role: z.string().trim().optional(),
  name: z.string().trim().optional(),
  permissions: z.record(z.boolean()).optional(),
  memberId: z.string().trim().nullable().optional(),
  memberName: z.string().trim().nullable().optional(),
  teamId: z.string().trim().nullable().optional(),
  teamName: z.string().trim().nullable().optional(),
});

const setPasswordBodySchema = z.object({
  password: z.string().trim().min(MIN_PASSWORD_LENGTH),
});

const changeOwnPasswordBodySchema = z.object({
  username: z.string().trim().min(1),
  currentPassword: z.string().min(1),
  newPassword: z.string().trim().min(MIN_PASSWORD_LENGTH),
});

export function registerLegacyCompatAuthRoutes(
  router: Router,
  context: {
    persistence: RuntimePersistence;
    authService: AuthService;
  },
): void {
  const { persistence, authService } = context;

  router.post('/api/auth/login', async (req, res) => {
    try {
      const payload = loginBodySchema.parse(req.body ?? {});
      const result = await authService.login(payload);
      setSessionCookie(req, res, result.token, result.expiresAt);
      res.status(200).json({
        ok: true,
        user: result.user,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      clearSessionCookie(req, res);
      handleLegacyAuthError(error, res, 'login');
    }
  });

  router.get('/api/auth/session', async (req, res) => {
    try {
      const token = getSessionTokenFromRequest(req);
      const result = await authService.restoreSession(token);
      if (result.clearCookie) {
        clearSessionCookie(req, res);
      }
      res.status(200).json({
        ok: true,
        user: result.user,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'restore session');
    }
  });

  router.post('/api/auth/logout', async (req, res) => {
    try {
      await authService.logout(getSessionTokenFromRequest(req));
      clearSessionCookie(req, res);
      res.status(200).json({ ok: true });
    } catch (error) {
      handleLegacyAuthError(error, res, 'logout');
    }
  });

  router.get('/api/auth/accounts', async (req, res) => {
    try {
      const result = await authService.listAccounts(getSessionTokenFromRequest(req));
      res.status(200).json({
        ok: true,
        accounts: result.accounts,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'list accounts');
    }
  });

  router.post('/api/auth/accounts', async (req, res) => {
    try {
      const payload = createAccountBodySchema.parse(req.body ?? {});
      const result = await authService.createAccount(getSessionTokenFromRequest(req), payload);
      res.status(201).json({
        ok: true,
        account: result.account,
        accounts: result.accounts,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'create account');
    }
  });

  router.patch('/api/auth/accounts/:username', async (req, res) => {
    try {
      const payload = updateAccountBodySchema.parse(req.body ?? {});
      const result = await authService.updateAccount(
        getSessionTokenFromRequest(req),
        `${req.params.username ?? ''}`,
        payload,
      );
      res.status(200).json({
        ok: true,
        account: result.account,
        accounts: result.accounts,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'update account');
    }
  });

  router.post('/api/auth/accounts/:username/password', async (req, res) => {
    try {
      const payload = setPasswordBodySchema.parse(req.body ?? {});
      const result = await setAccountPassword(persistence, authService, getSessionTokenFromRequest(req), {
        username: `${req.params.username ?? ''}`.trim(),
        password: payload.password,
      });
      res.status(200).json({
        ok: true,
        account: result.account,
        accounts: result.accounts,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'set account password');
    }
  });

  router.delete('/api/auth/accounts/:username', async (req, res) => {
    try {
      const result = await deleteAccount(
        persistence,
        authService,
        getSessionTokenFromRequest(req),
        `${req.params.username ?? ''}`.trim(),
      );
      res.status(200).json({
        ok: true,
        accounts: result.accounts,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'delete account');
    }
  });

  router.post('/api/auth/password/change', async (req, res) => {
    try {
      const payload = changeOwnPasswordBodySchema.parse(req.body ?? {});
      const result = await changeOwnPassword(
        persistence,
        authService,
        getSessionTokenFromRequest(req),
        payload,
      );
      setSessionCookie(req, res, result.token, result.expiresAt);
      res.status(200).json({
        ok: true,
        account: result.account,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'change password');
    }
  });
}
