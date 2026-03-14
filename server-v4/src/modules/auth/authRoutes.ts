import express, { type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import { AuthController } from './AuthController.js';
import type { AuthStore } from './authStore.js';
import { AuthService } from './authService.js';

export function buildAuthRouter(domainModule: DomainModule, authStore: AuthStore): Router {
  const router = express.Router();
  const service = new AuthService(authStore);
  const controller = new AuthController(service);

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/session', (req, res) => void controller.session(req, res));
  router.post('/login', (req, res) => void controller.login(req, res));
  router.post('/logout', (req, res) => void controller.logout(req, res));
  router.get('/accounts', (req, res) => void controller.listAccounts(req, res));
  router.post('/accounts', (req, res) => void controller.createAccount(req, res));
  router.patch('/accounts/:username', (req, res) => void controller.updateAccount(req, res));

  return router;
}
