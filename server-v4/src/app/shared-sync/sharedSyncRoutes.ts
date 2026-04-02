import { randomUUID } from 'node:crypto';

import express, { type Router } from 'express';
import { z, ZodError } from 'zod';

import type { AuthStore } from '../../modules/auth/authStore.js';
import { AuthHttpError, AuthService } from '../../modules/auth/authService.js';
import { getSessionTokenFromRequest } from '../../modules/auth/authShared.js';
import type { RuntimePersistence } from '../../persistence/runtimePersistence.js';
import { patchSharedSyncDeclarations } from './sharedSyncDeclarationPatch.js';
import {
  buildSharedSyncBootstrapResponse,
  normalizeSharedSyncRawValue,
  readSharedSyncValue,
  writeSharedSyncValue,
} from './sharedSyncStorage.js';

const sharedSyncWriteSchema = z.object({
  value: z.unknown().nullable(),
});

const sharedSyncDeclarationsPatchSchema = z.object({
  updates: z.array(
    z.object({
      key: z.string().trim().min(1),
      row: z.record(z.unknown()).optional(),
      updates: z.record(z.unknown()).optional(),
    }),
  ),
});

export function buildSharedSyncRouter(persistence: RuntimePersistence, authStore: AuthStore): Router {
  const router = express.Router();
  const authService = new AuthService(authStore);

  router.get('/bootstrap', async (req, res) => {
    const requestId = startSharedSyncRequest(res);
    const startedAt = Date.now();

    try {
      await requireSharedSyncUser(authService, getSessionTokenFromRequest(req));
      const payload = await buildSharedSyncBootstrapResponse(
        persistence,
        typeof req.query.mode === 'string' ? req.query.mode : null,
      );
      res.status(200).json({
        ...payload,
        meta: {
          ...payload.meta,
          requestId,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (error) {
      respondSharedSyncError(res, error, 'bootstrap sync data', requestId, startedAt);
    }
  });

  router.get('/storage/:key', async (req, res) => {
    const requestId = startSharedSyncRequest(res);
    const startedAt = Date.now();

    try {
      await requireSharedSyncUser(authService, getSessionTokenFromRequest(req));
      const key = `${req.params.key ?? ''}`.trim();
      const value = await readSharedSyncValue(persistence, key);
      if (respondUnknownSharedSyncKey(res, key, value, requestId, startedAt)) {
        return;
      }

      res.status(200).json({
        ok: true,
        key,
        value,
        raw: normalizeSharedSyncRawValue(value),
        meta: {
          requestId,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (error) {
      respondSharedSyncError(res, error, 'read sync storage key', requestId, startedAt);
    }
  });

  router.put('/storage/:key', async (req, res) => {
    const requestId = startSharedSyncRequest(res);
    const startedAt = Date.now();

    try {
      await requireSharedSyncUser(authService, getSessionTokenFromRequest(req));
      const key = `${req.params.key ?? ''}`.trim();
      const payload = sharedSyncWriteSchema.parse(req.body ?? {});
      const value = await writeSharedSyncValue(persistence, key, payload.value);
      if (respondUnknownSharedSyncKey(res, key, value, requestId, startedAt)) {
        return;
      }

      res.status(200).json({
        ok: true,
        key,
        value,
        raw: normalizeSharedSyncRawValue(value),
        meta: {
          requestId,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (error) {
      respondSharedSyncError(res, error, 'write sync storage key', requestId, startedAt);
    }
  });

  router.patch('/declarations', async (req, res) => {
    const requestId = startSharedSyncRequest(res);
    const startedAt = Date.now();

    try {
      const user = await requireSharedSyncUser(authService, getSessionTokenFromRequest(req));
      const payload = sharedSyncDeclarationsPatchSchema.parse(req.body ?? {});
      const result = await patchSharedSyncDeclarations(persistence, payload.updates, {
        username: user.username,
        role: user.role,
        name: user.name,
        permissions: user.permissions,
        memberId: user.memberId,
        memberName: user.memberName,
        teamId: user.teamId,
        teamName: user.teamName,
      });
      res.status(200).json({
        ok: true,
        ...result,
        meta: {
          requestId,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (error) {
      respondSharedSyncError(res, error, 'patch declarations', requestId, startedAt);
    }
  });

  return router;
}

async function requireSharedSyncUser(authService: AuthService, token: string) {
  const result = await authService.restoreSession(token);
  if (!result.user) {
    throw new AuthHttpError(401, 'auth_required', 'Bạn cần đăng nhập.');
  }
  return result.user;
}

function startSharedSyncRequest(res: {
  setHeader(name: string, value: string): void;
}): string {
  const requestId = randomUUID();
  res.setHeader('x-request-id', requestId);
  return requestId;
}

function respondUnknownSharedSyncKey(
  res: {
    status(code: number): { json(payload: unknown): void };
  },
  key: string,
  value: unknown,
  requestId: string,
  startedAt: number,
): boolean {
  if (value !== undefined) {
    return false;
  }

  res.status(404).json({
    ok: false,
    error: {
      code: 'not_found',
      message: `Unknown storage key: ${key}`,
    },
    meta: {
      requestId,
      durationMs: Date.now() - startedAt,
    },
  });
  return true;
}

function respondSharedSyncError(
  res: {
    status(code: number): { json(payload: unknown): void };
  },
  error: unknown,
  context: string,
  requestId: string,
  startedAt: number,
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'validation_error',
        message: `Invalid request for ${context}.`,
        details: error.flatten(),
      },
      meta: {
        requestId,
        durationMs: Date.now() - startedAt,
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
      meta: {
        requestId,
        durationMs: Date.now() - startedAt,
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
    meta: {
      requestId,
      durationMs: Date.now() - startedAt,
    },
  });
}
