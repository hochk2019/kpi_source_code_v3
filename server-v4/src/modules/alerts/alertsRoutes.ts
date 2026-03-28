import express, { type Request, type Response, type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import type { AuthStore } from '../auth/authStore.js';
import type { AuthAccountRecord } from '../auth/authTypes.js';
import type { AlertsRuntime } from './alertsRuntime.js';

export function buildAlertsRouter(
  domainModule: DomainModule,
  authStore: AuthStore | null | undefined,
  alertsRuntime: AlertsRuntime,
): Router {
  const router = express.Router();

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/summary', async (req, res) => {
    const account = await requireAlertsManage(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      const payload = alertsRuntime.domain.buildAlertPayload();
      res.json({ ok: true, ...payload });
    } catch (error) {
      res.status(500).json({ ok: false, error: asMessage(error, 'Không thể tải cảnh báo tờ khai') });
    }
  });

  router.get('/config', async (req, res) => {
    const account = await requireAlertsManage(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      res.json({ ok: true, config: alertsRuntime.domain.getAlertConfig() });
    } catch (error) {
      res.status(500).json({ ok: false, error: asMessage(error, 'Không thể tải cấu hình cảnh báo') });
    }
  });

  router.put('/config', async (req, res) => {
    const account = await requireAlertsManage(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      const config = isPlainObject(req.body?.config) ? req.body.config : {};
      const result = alertsRuntime.domain.updateAlertConfig({
        actor: account.username || 'system',
        config,
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({ ok: false, error: asMessage(error, 'Không thể cập nhật cấu hình cảnh báo') });
    }
  });

  router.post('/review', async (req, res) => {
    const account = await requireAlertsManage(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      const keys = parseKeys(req.body?.keys);
      const result = alertsRuntime.domain.reviewAlerts({
        actor: account.username || 'system',
        keys,
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({ ok: false, error: asMessage(error, 'Không thể cập nhật trạng thái cảnh báo') });
    }
  });

  router.post('/unreview', async (req, res) => {
    const account = await requireAlertsManage(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      const keys = parseKeys(req.body?.keys);
      const result = alertsRuntime.domain.unreviewAlerts({
        actor: account.username || 'system',
        keys,
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({ ok: false, error: asMessage(error, 'Không thể bỏ đánh dấu đã review') });
    }
  });

  router.get('/notifications', async (req, res) => {
    const account = await requireNotificationView(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      const events = alertsRuntime.domain.listNotifications({
        limit: parsePositiveInt(req.query?.limit, 50),
      });
      res.json({ ok: true, events });
    } catch (error) {
      res.status(500).json({ ok: false, error: asMessage(error, 'Không thể tải thông báo') });
    }
  });

  router.get('/notifications/stream', async (req, res) => {
    const account = await requireNotificationView(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      alertsRuntime.registerNotificationStream(res);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: asMessage(error, 'Không thể mở luồng thông báo') });
        return;
      }

      res.end();
    }
  });

  return router;
}

async function requireAlertsManage(
  req: Request,
  res: Response,
  authStore: AuthStore | null | undefined,
): Promise<AuthAccountRecord | null> {
  const account = await requireAuthenticatedAccount(
    req,
    res,
    authStore,
    'Bạn cần đăng nhập để xem hoặc quản lý cảnh báo tờ khai.',
  );
  if (!account) {
    return null;
  }

  if (account.permissions?.alertsManage !== true) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền quản lý cảnh báo tờ khai.' });
    return null;
  }

  return account;
}

async function requireNotificationView(
  req: Request,
  res: Response,
  authStore: AuthStore | null | undefined,
): Promise<AuthAccountRecord | null> {
  const account = await requireAuthenticatedAccount(
    req,
    res,
    authStore,
    'Vui lòng đăng nhập để xem thông báo hệ thống.',
  );
  if (!account) {
    return null;
  }

  if (account.permissions && account.permissions.notificationView === false) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không được phép xem thông báo hệ thống.' });
    return null;
  }

  return account;
}

async function requireAuthenticatedAccount(
  req: Request,
  res: Response,
  authStore: AuthStore | null | undefined,
  message: string,
): Promise<AuthAccountRecord | null> {
  const token = readSessionTokenFromRequest(req);
  const account = await readSessionAccount(authStore, token);

  if (!account) {
    res.status(401).json({ ok: false, error: message });
    return null;
  }

  return account;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(`${value ?? fallback}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseKeys(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return fallback;
}
