import express, { type Request, type Response, type Router } from 'express';

import {
  isAdminRole,
  MANAGER_ROLE,
  normalizeRoleKey,
} from '../../../../packages/domain/src/accountRoles.js';
import type { DomainModule } from '../../app/domain-module.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import type { AuthStore } from '../auth/authStore.js';
import type { AuthAccountRecord } from '../auth/authTypes.js';

type DuplicatePolicyPayload = {
  config: unknown;
  state: unknown;
  summary: unknown;
};

type DuplicatePolicyRuntime = {
  readDuplicatePolicySnapshot?: () => Promise<DuplicatePolicyPayload> | DuplicatePolicyPayload;
  updateDuplicatePolicySnapshot?: (input: {
    actor: string;
    body: Record<string, unknown>;
  }) => Promise<DuplicatePolicyPayload> | DuplicatePolicyPayload;
};

export function buildDuplicatePolicyRouter(
  domainModule: DomainModule,
  authStore: AuthStore | null | undefined,
  runtime: DuplicatePolicyRuntime | null | undefined = null,
): Router {
  const router = express.Router();

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/', async (req, res) => {
    const account = await requireDuplicatePolicyManage(req, res, authStore);
    if (!account) {
      return;
    }

    const reader = runtime?.readDuplicatePolicySnapshot;
    if (typeof reader !== 'function') {
      res.status(503).json({ ok: false, error: 'Duplicate policy runtime chưa sẵn sàng.' });
      return;
    }

    try {
      const payload = await reader();
      res.json({ ok: true, ...payload });
    } catch (error) {
      res.status(500).json({ ok: false, error: asMessage(error, 'Không thể tải chính sách trùng 11 số') });
    }
  });

  router.put('/', async (req, res) => {
    const account = await requireDuplicatePolicyManage(req, res, authStore);
    if (!account) {
      return;
    }

    const writer = runtime?.updateDuplicatePolicySnapshot;
    if (typeof writer !== 'function') {
      res.status(503).json({ ok: false, error: 'Duplicate policy runtime chưa sẵn sàng.' });
      return;
    }

    try {
      const payload = await writer({
        actor: account.username || 'system',
        body: isPlainObject(req.body) ? req.body : {},
      });
      res.json({ ok: true, ...payload });
    } catch (error) {
      res.status(500).json({ ok: false, error: asMessage(error, 'Không thể cập nhật chính sách trùng 11 số') });
    }
  });

  return router;
}

async function requireDuplicatePolicyManage(
  req: Request,
  res: Response,
  authStore: AuthStore | null | undefined,
): Promise<AuthAccountRecord | null> {
  const token = readSessionTokenFromRequest(req);
  const account = await readSessionAccount(authStore, token);

  if (!account) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập bằng tài khoản quản trị.' });
    return null;
  }

  const role = normalizeRoleKey(account.role);
  if (!(isAdminRole(role) || role === MANAGER_ROLE)) {
    res.status(403).json({
      ok: false,
      error: 'Chỉ quản trị viên hoặc quản lý mới được phép chỉnh sửa chính sách trùng 11 số.',
    });
    return null;
  }

  if (!account.permissions?.syncManage) {
    res.status(403).json({
      ok: false,
      error: 'Tài khoản hiện chưa được cấp quyền quản lý dữ liệu nhập khẩu.',
    });
    return null;
  }

  return account;
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
