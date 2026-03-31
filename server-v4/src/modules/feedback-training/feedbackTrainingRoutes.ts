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

type FeedbackEntryInput = {
  category?: unknown;
  rating?: unknown;
  message?: unknown;
  actor?: unknown;
  contact?: unknown;
  meta?: unknown;
};

type FeedbackEntryResult = {
  id?: string;
  category?: string;
  actor?: string | null;
};

export type FeedbackTrainingRuntime = {
  getTrainingResources?: () => Promise<unknown[]> | unknown[];
  getFeedbackSummary?: () => Promise<unknown> | unknown;
  listFeedbackEntries?: (options?: { limit?: number }) => Promise<unknown[]> | unknown[];
  addFeedbackEntry?: (
    input: FeedbackEntryInput,
  ) => Promise<FeedbackEntryResult> | FeedbackEntryResult;
  pushNotification?: (payload: {
    type: string;
    severity?: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    meta?: Record<string, unknown>;
  }) => void;
};

export function buildFeedbackTrainingRouter(
  domainModule: DomainModule,
  authStore: AuthStore | null | undefined,
  runtime: FeedbackTrainingRuntime | null | undefined = null,
): Router {
  const router = express.Router();

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/training-resources', async (_req, res) => {
    const reader = runtime?.getTrainingResources;
    if (typeof reader !== 'function') {
      res.status(503).json({ ok: false, error: 'Feedback/training runtime chưa sẵn sàng.' });
      return;
    }

    try {
      const resources = await reader();
      res.json({ ok: true, resources: Array.isArray(resources) ? resources : [] });
    } catch {
      res.status(500).json({ ok: false, error: 'Không thể tải tài liệu đào tạo' });
    }
  });

  router.get('/feedback/summary', async (_req, res) => {
    const reader = runtime?.getFeedbackSummary;
    if (typeof reader !== 'function') {
      res.status(503).json({ ok: false, error: 'Feedback/training runtime chưa sẵn sàng.' });
      return;
    }

    try {
      const summary = await reader();
      res.json({ ok: true, summary: summary && typeof summary === 'object' ? summary : {} });
    } catch {
      res.status(500).json({ ok: false, error: 'Không thể tổng hợp phản hồi' });
    }
  });

  router.get('/feedback', async (req, res) => {
    const account = await requireFeedbackReview(req, res, authStore);
    if (!account) {
      return;
    }

    const reader = runtime?.listFeedbackEntries;
    if (typeof reader !== 'function') {
      res.status(503).json({ ok: false, error: 'Feedback/training runtime chưa sẵn sàng.' });
      return;
    }

    try {
      const limitRaw = Number.parseInt(String(req.query?.limit ?? '50'), 10);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
      const entries = await reader({ limit });
      res.json({ ok: true, entries: Array.isArray(entries) ? entries : [] });
    } catch {
      res.status(500).json({ ok: false, error: 'Không thể tải phản hồi người dùng' });
    }
  });

  router.post('/feedback', async (req, res) => {
    const writer = runtime?.addFeedbackEntry;
    if (typeof writer !== 'function') {
      res.status(503).json({ ok: false, error: 'Feedback/training runtime chưa sẵn sàng.' });
      return;
    }

    const token = readSessionTokenFromRequest(req);
    const sessionAccount = await readSessionAccount(authStore, token);
    const body = isPlainObject(req.body) ? req.body : {};
    const actor = sessionAccount?.username || readStringValue(body.actor) || null;

    try {
      const entry = await writer({
        category: readStringValue(body.category) || 'khac',
        rating: body.rating,
        message: body.message,
        actor,
        contact: body.contact,
        meta: body.meta,
      });

      runtime?.pushNotification?.({
        type: 'feedback.new',
        severity: 'info',
        title: 'Phản hồi mới từ người dùng',
        message: `${entry?.actor || 'Người dùng ẩn danh'} vừa gửi góp ý: ${entry?.category || 'khac'}`,
        meta: { feedbackId: entry?.id || null },
      });

      res.status(201).json({ ok: true, entry });
    } catch (error) {
      res.status(400).json({ ok: false, error: asMessage(error, 'Không thể lưu phản hồi') });
    }
  });

  return router;
}

async function requireFeedbackReview(
  req: Request,
  res: Response,
  authStore: AuthStore | null | undefined,
): Promise<AuthAccountRecord | null> {
  const token = readSessionTokenFromRequest(req);
  const account = await readSessionAccount(authStore, token);

  if (!account) {
    res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập để xem phản hồi người dùng.' });
    return null;
  }

  const role = normalizeRoleKey(account.role);
  if (!(isAdminRole(role) || role === MANAGER_ROLE)) {
    res.status(403).json({
      ok: false,
      error: 'Chỉ quản trị viên hoặc trưởng bộ phận mới xem được phản hồi người dùng.',
    });
    return null;
  }

  return account;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readStringValue(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function asMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}
