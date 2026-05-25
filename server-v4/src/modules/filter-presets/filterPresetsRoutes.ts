import express, { type Request, type Response, type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import type { AuthStore } from '../auth/authStore.js';
import type { AuthAccountRecord } from '../auth/authTypes.js';

const FILTER_PRESET_SCOPE_DEFAULT = 'data-importer';
const KNOWN_FILTER_PRESET_SCOPES = new Set([FILTER_PRESET_SCOPE_DEFAULT, 'report-viewer']);

type FilterPresetResult = {
  preset?: {
    id?: string;
    name?: string;
    scope?: string;
  };
  deleted?: boolean;
  removed?: {
    name?: string;
  };
  presets?: unknown[];
  updatedAt?: string | null;
};

export type FilterPresetsRuntime = {
  sanitizeFilterPresetScope?: (scope: unknown) => string;
  listFilterPresetsForUser?: (
    username: string,
    options?: { scope?: unknown },
  ) => Promise<FilterPresetResult> | FilterPresetResult;
  createFilterPresetForUser?: (
    username: string,
    body: unknown,
    options?: { actor?: string },
  ) => Promise<FilterPresetResult> | FilterPresetResult;
  updateFilterPresetForUser?: (
    username: string,
    presetId: string,
    body: unknown,
    options?: { actor?: string },
  ) => Promise<FilterPresetResult> | FilterPresetResult;
  deleteFilterPresetForUser?: (
    username: string,
    presetId: string,
    options?: { actor?: string },
  ) => Promise<FilterPresetResult> | FilterPresetResult;
  pushAuditLog?: (entry: {
    actor: string;
    action: string;
    detail: string;
  }) => void;
};

export function buildFilterPresetsRouter(
  domainModule: DomainModule,
  authStore: AuthStore | null | undefined,
  runtime: FilterPresetsRuntime | null | undefined = null,
): Router {
  const router = express.Router();

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/', async (req, res) => {
    const account = await requireFilterPresetUser(
      req,
      res,
      authStore,
      'Bạn cần đăng nhập để sử dụng bộ lọc đã lưu.',
    );
    if (!account) {
      return;
    }

    const reader = runtime?.listFilterPresetsForUser;
    if (typeof reader !== 'function') {
      res.status(503).json({ ok: false, error: 'Filter presets runtime chưa sẵn sàng.' });
      return;
    }

    const sanitizeScope = runtime?.sanitizeFilterPresetScope ?? fallbackSanitizeFilterPresetScope;
    const scope = sanitizeScope(req.query?.scope);

    try {
      const payload = await reader(account.username, { scope });
      res.json({
        ok: true,
        scope,
        presets: Array.isArray(payload?.presets) ? payload.presets : [],
        updatedAt: payload?.updatedAt ?? null,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: asMessage(error, 'Không thể tải bộ lọc đã lưu.') });
    }
  });

  router.post('/', async (req, res) => {
    const account = await requireFilterPresetUser(req, res, authStore, 'Bạn cần đăng nhập để lưu bộ lọc.');
    if (!account) {
      return;
    }

    const writer = runtime?.createFilterPresetForUser;
    if (typeof writer !== 'function') {
      res.status(503).json({ ok: false, error: 'Filter presets runtime chưa sẵn sàng.' });
      return;
    }

    try {
      const payload = await writer(account.username, req.body || {}, { actor: account.username });
      const presetName = payload?.preset?.name || 'preset';
      const presetScope = payload?.preset?.scope || FILTER_PRESET_SCOPE_DEFAULT;
      runtime?.pushAuditLog?.({
        actor: account.username,
        action: 'filter.preset.create',
        detail: `Tạo bộ lọc "${presetName}" (scope ${presetScope})`,
      });
      res.status(201).json({ ok: true, preset: payload?.preset, updatedAt: payload?.updatedAt ?? null });
    } catch (error) {
      const errorCode = getErrorCode(error);
      if (errorCode === 'INVALID_FILTERS') {
        res.status(400).json({ ok: false, error: 'Không có điều kiện lọc hợp lệ để lưu.' });
        return;
      }
      if (errorCode === 'INVALID_USER') {
        res.status(400).json({ ok: false, error: 'Thiếu thông tin tài khoản để lưu bộ lọc.' });
        return;
      }
      res.status(500).json({ ok: false, error: 'Không thể lưu bộ lọc đã lưu.' });
    }
  });

  router.put('/:presetId', async (req, res) => {
    const account = await requireFilterPresetUser(
      req,
      res,
      authStore,
      'Bạn cần đăng nhập để cập nhật bộ lọc.',
    );
    if (!account) {
      return;
    }

    const writer = runtime?.updateFilterPresetForUser;
    if (typeof writer !== 'function') {
      res.status(503).json({ ok: false, error: 'Filter presets runtime chưa sẵn sàng.' });
      return;
    }

    try {
      const payload = await writer(account.username, String(req.params.presetId || ''), req.body || {}, {
        actor: account.username,
      });
      const presetName = payload?.preset?.name || req.params.presetId || 'preset';
      runtime?.pushAuditLog?.({
        actor: account.username,
        action: 'filter.preset.update',
        detail: `Cập nhật bộ lọc "${presetName}"`,
      });
      res.json({ ok: true, preset: payload?.preset, updatedAt: payload?.updatedAt ?? null });
    } catch (error) {
      const errorCode = getErrorCode(error);
      if (errorCode === 'INVALID_ID') {
        res.status(400).json({ ok: false, error: 'Thiếu mã bộ lọc cần cập nhật.' });
        return;
      }
      if (errorCode === 'INVALID_FILTERS') {
        res.status(400).json({ ok: false, error: 'Không có điều kiện lọc hợp lệ để lưu.' });
        return;
      }
      if (errorCode === 'NOT_FOUND') {
        res.status(404).json({ ok: false, error: 'Không tìm thấy bộ lọc đã lưu tương ứng.' });
        return;
      }
      if (errorCode === 'INVALID_USER') {
        res.status(400).json({ ok: false, error: 'Thiếu thông tin tài khoản để cập nhật bộ lọc.' });
        return;
      }
      res.status(500).json({ ok: false, error: 'Không thể cập nhật bộ lọc đã lưu.' });
    }
  });

  router.delete('/:presetId', async (req, res) => {
    const account = await requireFilterPresetUser(req, res, authStore, 'Bạn cần đăng nhập để xoá bộ lọc.');
    if (!account) {
      return;
    }

    const writer = runtime?.deleteFilterPresetForUser;
    if (typeof writer !== 'function') {
      res.status(503).json({ ok: false, error: 'Filter presets runtime chưa sẵn sàng.' });
      return;
    }

    try {
      const payload = await writer(account.username, String(req.params.presetId || ''), {
        actor: account.username,
      });
      const removedName = payload?.removed?.name || req.params.presetId || 'preset';
      runtime?.pushAuditLog?.({
        actor: account.username,
        action: 'filter.preset.delete',
        detail: `Xoá bộ lọc "${removedName}"`,
      });
      res.json({ ok: true, deleted: payload?.deleted === true, updatedAt: payload?.updatedAt ?? null });
    } catch (error) {
      const errorCode = getErrorCode(error);
      if (errorCode === 'INVALID_ID') {
        res.status(400).json({ ok: false, error: 'Thiếu mã bộ lọc cần xoá.' });
        return;
      }
      if (errorCode === 'NOT_FOUND') {
        res.status(404).json({ ok: false, error: 'Không tìm thấy bộ lọc đã lưu tương ứng.' });
        return;
      }
      if (errorCode === 'INVALID_USER') {
        res.status(400).json({ ok: false, error: 'Thiếu thông tin tài khoản để xoá bộ lọc.' });
        return;
      }
      res.status(500).json({ ok: false, error: 'Không thể xoá bộ lọc đã lưu.' });
    }
  });

  return router;
}

async function requireFilterPresetUser(
  req: Request,
  res: Response,
  authStore: AuthStore | null | undefined,
  unauthorizedMessage: string,
): Promise<AuthAccountRecord | null> {
  const token = readSessionTokenFromRequest(req);
  const account = await readSessionAccount(authStore, token);

  if (!account) {
    res.status(401).json({ ok: false, error: unauthorizedMessage });
    return null;
  }

  return account;
}

function fallbackSanitizeFilterPresetScope(scope: unknown): string {
  const candidate = Array.isArray(scope) ? scope[0] : scope;
  if (typeof candidate !== 'string') {
    return FILTER_PRESET_SCOPE_DEFAULT;
  }
  const normalized = candidate.trim().toLowerCase();
  if (!normalized) {
    return FILTER_PRESET_SCOPE_DEFAULT;
  }
  if (!KNOWN_FILTER_PRESET_SCOPES.has(normalized)) {
    return FILTER_PRESET_SCOPE_DEFAULT;
  }
  return normalized;
}

function getErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return null;
}

function asMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}
