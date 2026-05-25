import fs from 'node:fs/promises';
import path from 'node:path';

import cron from 'node-cron';

import type { AuthStore } from '../auth/authStore.js';
import { createBackupDomain } from './backupDomain.js';

export type BackupConfigSnapshot = {
  cron: string;
  retentionCopies: number | null;
  directory: string;
  directoryRaw: string | null;
};

export type BackupDirectoryInputResult = {
  raw: string | null;
  resolved: string | null;
  reason: string | null;
};

type BackupAuditEntry = Record<string, unknown>;

type BackupDomainResult = {
  ok?: boolean;
  reason?: string;
  error?: string;
  [key: string]: unknown;
};

export interface BackupAdminDomain {
  buildBackupSummary(options?: { limit?: number }): unknown;
  listBackupFiles(options?: { limit?: number }): Promise<unknown[]>;
  performDatabaseBackup(options?: {
    actor?: string;
    backupDir?: string;
    note?: string | null;
    reason?: string;
    retention?: number | null;
  }): Promise<BackupDomainResult>;
  restoreDatabaseBackup(options?: {
    actor?: string;
    filename?: string;
    note?: string | null;
    reason?: string;
    backupDir?: string;
  }): Promise<BackupDomainResult>;
  refreshDatabaseBackupSchedule(): void;
}

export interface BackupAdminRuntime {
  describeBackupDirectoryError(reason: string | null | undefined): string;
  dispose?(): Promise<void> | void;
  domain: BackupAdminDomain;
  normalizeBackupDirectoryInput(value: unknown): BackupDirectoryInputResult;
  pushAuditLog(entry: BackupAuditEntry): void;
  saveBackupConfig(config: {
    cron?: string;
    directory?: string | null;
    retentionCopies?: number | null;
  }): BackupConfigSnapshot;
}

type CreateBackupAdminRuntimeOptions = {
  authStore?: AuthStore | null;
  dbFile: string | null;
  defaultCron?: string;
  defaultRetentionCopies?: number;
  logger?: Pick<Console, 'error' | 'log' | 'warn'>;
};

type BackupScheduleMeta = {
  active: boolean;
  cron: string;
  description: string;
  lastError: string | null;
  reasons: string[];
  refreshedAt: string | null;
};

type BackupRuntimeState = {
  backupInProgress: boolean;
  backupScheduleMeta: BackupScheduleMeta;
  dbBackupJob: { nextDates?: () => unknown; stop?: () => void } | null;
  restoreInProgress: boolean;
};

const DEFAULT_BACKUP_CRON = '0 3 * * *';
const DEFAULT_BACKUP_RETENTION = 14;

export function createBackupAdminRuntime(
  options: CreateBackupAdminRuntimeOptions,
): BackupAdminRuntime {
  const logger = options.logger ?? console;
  const auditLogs: BackupAuditEntry[] = [];
  const state: BackupRuntimeState = {
    backupInProgress: false,
    backupScheduleMeta: {
      active: false,
      cron: '',
      description: '',
      lastError: null,
      reasons: [],
      refreshedAt: null,
    },
    dbBackupJob: null,
    restoreInProgress: false,
  };
  const defaultDirectory = resolveDefaultBackupDirectory(options.dbFile);
  const configState = {
    cron: normalizeCronExpression(options.defaultCron ?? DEFAULT_BACKUP_CRON),
    directoryRaw: null as string | null,
    retentionCopies: normalizeRetentionCopies(
      options.defaultRetentionCopies ?? DEFAULT_BACKUP_RETENTION,
    ),
  };

  let currentDbHandle: { close?: () => void } | null = createManagedDatabaseHandle(options.authStore);

  function getBackupConfig(): BackupConfigSnapshot {
    const cronValue = normalizeCronExpression(configState.cron) || DEFAULT_BACKUP_CRON;
    const directoryRaw = sanitizeStoredBackupDirectory(configState.directoryRaw);
    const directory = directoryRaw ? resolveBackupDir(directoryRaw) : defaultDirectory;

    return {
      cron: cronValue,
      retentionCopies: configState.retentionCopies,
      directory,
      directoryRaw,
    };
  }

  function saveBackupConfig(config: {
    cron?: string;
    directory?: string | null;
    retentionCopies?: number | null;
  }): BackupConfigSnapshot {
    if (Object.prototype.hasOwnProperty.call(config, 'cron')) {
      configState.cron = normalizeCronExpression(config.cron) || DEFAULT_BACKUP_CRON;
    }

    if (Object.prototype.hasOwnProperty.call(config, 'retentionCopies')) {
      configState.retentionCopies = normalizeRetentionCopies(config.retentionCopies);
    }

    if (Object.prototype.hasOwnProperty.call(config, 'directory')) {
      configState.directoryRaw = sanitizeStoredBackupDirectory(config.directory);
    }

    return getBackupConfig();
  }

  function pushAuditLog(entry: BackupAuditEntry): void {
    auditLogs.unshift({
      ...entry,
      ts:
        typeof entry.ts === 'string' && entry.ts.trim()
          ? entry.ts
          : new Date().toISOString(),
    });
  }

  const domain = createBackupDomain({
    cron,
    describeCronExpression,
    formatNextRunHuman,
    fs,
    getBackupConfig,
    getBackupDirectory: () => getBackupConfig().directory,
    getDatabase: () => currentDbHandle,
    getDbFile: () => options.dbFile,
    getDefaultBackupRetention: () => DEFAULT_BACKUP_RETENTION,
    getJSONValue: (key: string, fallback: unknown) => (key === 'audit_logs_v1' ? auditLogs : fallback),
    getState: () => state,
    inferAuditCategory: inferAuditCategory,
    initializeDatabase: async () => currentDbHandle,
    isCronDisabled: () => false,
    logger,
    normalizeCronExpression,
    onRestoreSuccess: undefined,
    path,
    pushAuditLog,
    setBackupInProgress: (value: boolean) => {
      state.backupInProgress = value;
    },
    setBackupJob: (value: BackupRuntimeState['dbBackupJob']) => {
      state.dbBackupJob = value;
    },
    setDatabase: (value: typeof currentDbHandle) => {
      currentDbHandle = value ?? createManagedDatabaseHandle(options.authStore);
    },
    setRestoreInProgress: (value: boolean) => {
      state.restoreInProgress = value;
    },
  });

  return {
    describeBackupDirectoryError,
    dispose: async () => {
      state.dbBackupJob?.stop?.();
      state.dbBackupJob = null;
      currentDbHandle?.close?.();
      currentDbHandle = null;
    },
    domain,
    normalizeBackupDirectoryInput,
    pushAuditLog,
    saveBackupConfig,
  };
}

function createManagedDatabaseHandle(authStore: AuthStore | null | undefined): { close?: () => void } | null {
  if (!authStore?.reset) {
    return null;
  }

  return {
    close: () => {
      authStore.reset?.();
    },
  };
}

function normalizeCronExpression(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return `${value}`.trim();
}

function normalizeRetentionCopies(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return null;
  }

  return Math.trunc(normalized);
}

function resolveDefaultBackupDirectory(dbFile: string | null): string {
  if (typeof dbFile === 'string' && dbFile.trim() && dbFile !== ':memory:') {
    return path.resolve(path.dirname(dbFile), 'backups');
  }

  return path.resolve(process.cwd(), 'server', 'data', 'backups');
}

function resolveBackupDir(value: string): string {
  if (path.isAbsolute(value)) {
    return value;
  }

  return path.resolve(process.cwd(), value);
}

function sanitizeStoredBackupDirectory(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('\0') || trimmed === ':memory:') {
    return null;
  }

  return trimmed;
}

function normalizeBackupDirectoryInput(value: unknown): BackupDirectoryInputResult {
  if (value === null || value === undefined) {
    return { raw: null, resolved: null, reason: null };
  }

  if (typeof value !== 'string') {
    return { raw: null, resolved: null, reason: 'invalid_type' };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { raw: null, resolved: null, reason: null };
  }

  if (trimmed.includes('\0')) {
    return { raw: null, resolved: null, reason: 'invalid_characters' };
  }

  if (trimmed === ':memory:') {
    return { raw: null, resolved: null, reason: 'memory_not_supported' };
  }

  return {
    raw: trimmed,
    resolved: resolveBackupDir(trimmed),
    reason: null,
  };
}

function describeBackupDirectoryError(reason: string | null | undefined): string {
  switch (reason) {
    case 'invalid_characters':
      return 'Đường dẫn sao lưu chứa ký tự không hợp lệ.';
    case 'memory_not_supported':
      return 'Không thể sử dụng giá trị ":memory:" cho thư mục sao lưu.';
    case 'invalid_type':
      return 'Thư mục sao lưu không hợp lệ.';
    default:
      return 'Thư mục sao lưu không hợp lệ.';
  }
}

function describeCronExpression(expression: unknown): string {
  const cronExpr = normalizeCronExpression(expression);
  if (!cronExpr) {
    return '';
  }

  if (cronExpr.toLowerCase() === 'never') {
    return 'Không chạy tự động';
  }

  if (typeof cron.validate === 'function' && !cron.validate(cronExpr)) {
    return 'Biểu thức cron không hợp lệ';
  }

  return `Cron ${cronExpr}`;
}

function formatNextRunHuman(isoValue: unknown): string | null {
  const normalized = typeof isoValue === 'string' ? isoValue.trim() : '';
  if (!normalized) {
    return null;
  }

  const nextDate = new Date(normalized);
  if (Number.isNaN(nextDate.getTime())) {
    return null;
  }

  return nextDate.toLocaleString('vi-VN', { hour12: false });
}

function inferAuditCategory(action: unknown): string {
  if (typeof action !== 'string') {
    return 'audit';
  }

  const [, category] = action.split('.');
  return category || 'audit';
}
