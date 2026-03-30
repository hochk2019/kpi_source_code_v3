import type { Response, Router } from 'express';
import { z } from 'zod';

import type { RuntimePersistence } from '../../persistence/runtimePersistence.js';
import { AuthService } from '../../modules/auth/authService.js';
import { getSessionTokenFromRequest } from '../../modules/auth/authShared.js';
import {
  handleLegacyAuthError,
  readLegacyStorageValue,
  requireAuthenticatedUser,
  writeLegacyStorageValue,
} from './legacyCompatShared.js';

const legacyStoragePayloadSchema = z.object({
  value: z.unknown().nullable(),
});

export function registerLegacyCompatStorageRoutes(
  router: Router,
  context: {
    persistence: RuntimePersistence;
    authService: AuthService;
  },
): void {
  const { persistence, authService } = context;

  router.get('/api/storage/:key', async (req, res) => {
    try {
      await requireAuthenticatedUser(authService, getSessionTokenFromRequest(req));
      const key = `${req.params.key ?? ''}`.trim();
      const value = await readLegacyStorageValue(persistence, key);
      if (respondUnknownLegacyStorageKey(res, key, value)) return;

      res.status(200).json({
        ok: true,
        key,
        value,
        raw: value === null ? null : JSON.stringify(value),
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'read storage key');
    }
  });

  router.put('/api/storage/:key', async (req, res) => {
    try {
      await requireAuthenticatedUser(authService, getSessionTokenFromRequest(req));
      const key = `${req.params.key ?? ''}`.trim();
      const payload = legacyStoragePayloadSchema.parse(req.body ?? {});
      const value = await writeLegacyStorageValue(persistence, key, payload.value);
      if (respondUnknownLegacyStorageKey(res, key, value)) return;

      res.status(200).json({
        ok: true,
        key,
        value,
        raw: value === null ? null : JSON.stringify(value),
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'write storage key');
    }
  });
}

function respondUnknownLegacyStorageKey(res: Response, key: string, value: unknown): boolean {
  if (value !== undefined) {
    return false;
  }

  res.status(404).json({
    ok: false,
    error: {
      code: 'not_found',
      message: `Unknown storage key: ${key}`,
    },
  });
  return true;
}
