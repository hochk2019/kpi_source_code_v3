import express, { type Request, type Response, type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import type { AuthStore } from '../auth/authStore.js';
import type { AuthAccountRecord } from '../auth/authTypes.js';

type DataHealthRuntime = {
  readDataHealthSnapshot?: () => Promise<unknown>;
};

export function buildDataHealthRouter(
  domainModule: DomainModule,
  authStore: AuthStore | null | undefined,
  runtime: DataHealthRuntime | null | undefined = null,
): Router {
  const router = express.Router();

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/summary', async (req, res) => {
    const account = await requireDataHealthView(req, res, authStore);
    if (!account) {
      return;
    }

    const reader = runtime?.readDataHealthSnapshot;
    if (typeof reader !== 'function') {
      res.status(503).json({ ok: false, error: 'Data health runtime chưa sẵn sàng.' });
      return;
    }

    try {
      const summary = await reader();
      res.json({ ok: true, summary });
    } catch (error) {
      res
        .status(500)
        .json({ ok: false, error: asMessage(error, 'Không thể tải sức khỏe dữ liệu') });
    }
  });

  return router;
}

async function requireDataHealthView(
  req: Request,
  res: Response,
  authStore: AuthStore | null | undefined,
): Promise<AuthAccountRecord | null> {
  const token = readSessionTokenFromRequest(req);
  const account = await readSessionAccount(authStore, token);

  if (!account) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để xem sức khỏe dữ liệu.' });
    return null;
  }

  if (
    !(
      account.permissions?.dataHealthView ||
      account.permissions?.dataHealthManage ||
      account.permissions?.accountManage
    )
  ) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền xem sức khỏe dữ liệu.' });
    return null;
  }

  return account;
}

function asMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return fallback;
}

