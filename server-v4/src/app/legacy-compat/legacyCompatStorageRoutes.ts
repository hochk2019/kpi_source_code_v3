import type { Router } from 'express';

import type { RuntimePersistence } from '../../persistence/runtimePersistence.js';
import { AuthService } from '../../modules/auth/authService.js';
import { getSessionTokenFromRequest } from '../../modules/auth/authShared.js';
import {
  handleLegacyAuthError,
  readLegacyStorageValue,
  requireAuthenticatedUser,
} from './legacyCompatShared.js';

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
      if (value === undefined) {
        res.status(404).json({
          ok: false,
          error: `Unknown storage key: ${key}`,
        });
        return;
      }

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
}
