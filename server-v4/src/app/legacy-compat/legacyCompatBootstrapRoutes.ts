import type { Router } from 'express';

import type { RuntimePersistence } from '../../persistence/runtimePersistence.js';
import { AuthService } from '../../modules/auth/authService.js';
import { getSessionTokenFromRequest } from '../../modules/auth/authShared.js';
import {
  buildLegacyBootstrapSnapshot,
  handleLegacyAuthError,
  requireAuthenticatedUser,
} from './legacyCompatShared.js';

export function registerLegacyCompatBootstrapRoutes(
  router: Router,
  context: {
    persistence: RuntimePersistence;
    authService: AuthService;
  },
): void {
  const { persistence, authService } = context;

  router.get('/api/bootstrap', async (req, res) => {
    try {
      await requireAuthenticatedUser(authService, getSessionTokenFromRequest(req));
      const store = await buildLegacyBootstrapSnapshot(persistence);
      res.status(200).json({ data: store });
    } catch (error) {
      handleLegacyAuthError(error, res, 'bootstrap application data');
    }
  });
}
