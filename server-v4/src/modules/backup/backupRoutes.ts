import express, { type Request, type Response, type Router } from 'express';

import cron from 'node-cron';

import { isAdminRole, normalizeRoleKey } from '../../../../packages/domain/src/accountRoles.js';
import {
  translateBackupFailure,
  translateBackupReason,
} from '../../../../packages/domain/src/backupMessages.js';
import type { DomainModule } from '../../app/domain-module.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import type { AuthStore } from '../auth/authStore.js';
import type { AuthAccountRecord } from '../auth/authTypes.js';
import type { BackupAdminRuntime } from './backupRuntime.js';

type RetentionParseResult =
  | { ok: true; value: number | null }
  | { error: string; field: string; ok: false };

export function buildBackupRouter(
  domainModule: DomainModule,
  authStore: AuthStore | null | undefined,
  backupAdmin: BackupAdminRuntime,
): Router {
  const router = express.Router();

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  router.get('/summary', async (req, res) => {
    const account = await requireAuditView(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      const limit = parsePositiveInt(req.query?.limit, 10);
      const summary = backupAdmin.domain.buildBackupSummary({ limit });
      res.json({ ok: true, summary });
    } catch (error) {
      res.status(500).json({ ok: false, error: asMessage(error, 'Không thể tải thông tin sao lưu') });
    }
  });

  router.get('/files', async (req, res) => {
    const account = await requireAdminBackupManage(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      const limit = parsePositiveInt(req.query?.limit, 50);
      const files = await backupAdmin.domain.listBackupFiles({ limit });
      res.json({ ok: true, files });
    } catch (error) {
      res
        .status(500)
        .json({ ok: false, error: asMessage(error, 'Không thể tải danh sách bản sao lưu') });
    }
  });

  router.post('/run', async (req, res) => {
    const account = await requireAdminBackupManage(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      const body = req.body ?? {};
      const reasonRaw = typeof body.reason === 'string' ? body.reason.trim() : '';
      const reason = reasonRaw || 'manual';
      const note = typeof body.note === 'string' ? body.note : null;
      const retention = Number.isFinite(body.retention) ? Number(body.retention) : undefined;

      let backupDirOverride: string | undefined;
      if (Object.prototype.hasOwnProperty.call(body, 'directory')) {
        const directoryResult = backupAdmin.normalizeBackupDirectoryInput(body.directory);
        if (directoryResult.reason) {
          res.status(400).json({
            ok: false,
            error: backupAdmin.describeBackupDirectoryError(directoryResult.reason),
            field: 'directory',
            reason: directoryResult.reason,
          });
          return;
        }

        const updatedConfig = backupAdmin.saveBackupConfig({ directory: directoryResult.raw });
        backupAdmin.domain.refreshDatabaseBackupSchedule();
        backupDirOverride = updatedConfig.directory;
      }

      const result = await backupAdmin.domain.performDatabaseBackup({
        actor: account.username || 'system',
        backupDir: backupDirOverride,
        note,
        reason,
        retention,
      });

      if (result?.ok === false) {
        const message =
          translateBackupFailure(result.reason) ||
          translateBackupReason(result.reason) ||
          'Không thể sao lưu CSDL.';
        const status = ['in_progress', 'restore_in_progress'].includes(`${result.reason ?? ''}`) ? 409 : 400;
        res.status(status).json({ ok: false, error: message, reason: result.reason });
        return;
      }

      res.json({ ok: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: asMessage(error, 'Không thể thực hiện sao lưu ngay') });
    }
  });

  router.post('/schedule', async (req, res) => {
    const account = await requireAdminBackupManage(req, res, authStore);
    if (!account) {
      return;
    }

    try {
      const body = req.body ?? {};
      const cronExpr = normalizeCronExpression(body?.cron);

      if (!cronExpr) {
        res.status(400).json({ ok: false, error: 'Vui lòng nhập biểu thức cron.' });
        return;
      }

      if (cronExpr.toLowerCase() !== 'never' && typeof cron.validate === 'function' && !cron.validate(cronExpr)) {
        res.status(400).json({ ok: false, error: 'Biểu thức cron không hợp lệ.' });
        return;
      }

      const retentionField =
        Object.prototype.hasOwnProperty.call(body, 'retentionCopies') ||
        Object.prototype.hasOwnProperty.call(body, 'retention')
          ? Object.prototype.hasOwnProperty.call(body, 'retentionCopies')
            ? body.retentionCopies
            : body.retention
          : undefined;
      const retentionResult = parseRetentionCopies(retentionField);
      if (!retentionResult.ok) {
        res.status(400).json({ ok: false, error: retentionResult.error, field: retentionResult.field });
        return;
      }

      let directoryValue: string | null | undefined;
      if (Object.prototype.hasOwnProperty.call(body, 'directory')) {
        const directoryResult = backupAdmin.normalizeBackupDirectoryInput(body.directory);
        if (directoryResult.reason) {
          res.status(400).json({
            ok: false,
            error: backupAdmin.describeBackupDirectoryError(directoryResult.reason),
            field: 'directory',
            reason: directoryResult.reason,
          });
          return;
        }
        directoryValue = directoryResult.raw;
      }

      const configPayload: {
        cron: string;
        directory?: string | null;
        retentionCopies?: number | null;
      } = { cron: cronExpr };
      if (retentionField !== undefined) {
        configPayload.retentionCopies = retentionResult.value;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'directory')) {
        configPayload.directory = directoryValue ?? null;
      }

      const config = backupAdmin.saveBackupConfig(configPayload);
      backupAdmin.domain.refreshDatabaseBackupSchedule();
      backupAdmin.pushAuditLog({
        actor: account.username || 'system',
        action: 'db.backup_schedule.update',
        detail: 'Cập nhật lịch sao lưu CSDL',
        meta: {
          cron: cronExpr,
          directory: config.directory,
          retentionCopies: config.retentionCopies,
        },
      });

      const summary = backupAdmin.domain.buildBackupSummary();
      res.json({ ok: true, config, summary });
    } catch (error) {
      res.status(500).json({ ok: false, error: asMessage(error, 'Không thể cập nhật lịch sao lưu') });
    }
  });

  return router;
}

async function requireAuditView(
  req: Request,
  res: Response,
  authStore: AuthStore | null | undefined,
): Promise<AuthAccountRecord | null> {
  const account = await requireAuthenticatedAccount(
    req,
    res,
    authStore,
    'Bạn cần đăng nhập để xem nhật ký sao lưu.',
  );

  if (!account) {
    return null;
  }

  if (!(account.permissions?.auditView || account.permissions?.accountManage)) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền xem nhật ký hệ thống.' });
    return null;
  }

  return account;
}

async function requireAdminBackupManage(
  req: Request,
  res: Response,
  authStore: AuthStore | null | undefined,
): Promise<AuthAccountRecord | null> {
  const account = await requireAuthenticatedAccount(
    req,
    res,
    authStore,
    'Bạn cần đăng nhập bằng tài khoản quản trị.',
  );

  if (!account) {
    return null;
  }

  if (!isAdminRole(normalizeRoleKey(account.role))) {
    res.status(403).json({ ok: false, error: 'Chỉ tài khoản quản trị mới được phép chỉnh sửa lịch sao lưu.' });
    return null;
  }

  if (!account.permissions?.accountManage) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện chưa được cấp quyền quản trị hệ thống.' });
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

function normalizeCronExpression(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return `${value}`.trim();
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(`${value ?? fallback}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseRetentionCopies(value: unknown): RetentionParseResult {
  if (value === undefined) {
    return { ok: true, value: null };
  }

  if (value === null || (typeof value === 'string' && value.trim() === '')) {
    return { ok: true, value: null };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      return {
        ok: false,
        field: 'retentionCopies',
        error: 'Số bản sao lưu giữ lại phải là số nguyên không âm.',
      };
    }

    return { ok: true, value: Math.trunc(value) };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/u.test(trimmed)) {
      return {
        ok: false,
        field: 'retentionCopies',
        error: 'Số bản sao lưu giữ lại phải là số nguyên không âm.',
      };
    }

    return { ok: true, value: Number.parseInt(trimmed, 10) };
  }

  return {
    ok: false,
    field: 'retentionCopies',
    error: 'Số bản sao lưu giữ lại phải là số nguyên không âm.',
  };
}

function asMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return fallback;
}
