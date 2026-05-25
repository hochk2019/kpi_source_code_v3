/* eslint-env node */
/* @vitest-environment node */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBackupDomain } from '../../server-v4/src/modules/backup/backupDomain.js';

function createHarness({
  dbFile,
  backupDir,
  cronExpression = '0 1 * * *',
  retentionCopies = 1,
  defaultRetention = 2,
} = {}) {
  const state = {
    dbBackupJob: null,
    backupInProgress: false,
    restoreInProgress: false,
    backupScheduleMeta: {
      active: false,
      reasons: [],
      lastError: null,
      refreshedAt: null,
      cron: '',
      description: '',
    },
  };
  const auditLogs = [];
  const logger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const cronApi = {
    validate: vi.fn(() => true),
    schedule: vi.fn((expression, job) => ({
      expression,
      job,
      stop: vi.fn(),
      nextDates: () => new Date('2024-01-02T00:00:00.000Z'),
    })),
  };
  const initializeDatabase = vi.fn(async () => ({ close: vi.fn() }));

  let databaseHandle = { close: vi.fn() };
  let restoreSuccessCount = 0;

  const domain = createBackupDomain({
    fs,
    path,
    cron: cronApi,
    logger,
    getDbFile: () => dbFile,
    getBackupDirectory: () => backupDir,
    getBackupConfig: () => ({
      cron: cronExpression,
      retentionCopies,
      directory: backupDir,
      directoryRaw: backupDir,
    }),
    getDefaultBackupRetention: () => defaultRetention,
    getState: () => state,
    setBackupInProgress: (value) => {
      state.backupInProgress = value;
    },
    setRestoreInProgress: (value) => {
      state.restoreInProgress = value;
    },
    setBackupJob: (value) => {
      state.dbBackupJob = value;
    },
    getJSONValue: (key, fallback) => (key === 'audit_logs_v1' ? auditLogs : fallback),
    inferAuditCategory: (action) => action.split('.')[1] || 'audit',
    pushAuditLog: (entry) => {
      auditLogs.unshift(entry);
    },
    initializeDatabase,
    getDatabase: () => databaseHandle,
    setDatabase: (value) => {
      databaseHandle = value;
    },
    onRestoreSuccess: () => {
      restoreSuccessCount += 1;
    },
    normalizeCronExpression: (value) => (typeof value === 'string' ? value.trim() : ''),
    describeCronExpression: (value) => (value ? `Cron ${value}` : 'disabled'),
    formatNextRunHuman: (value) => (value ? 'soon' : 'never'),
    isCronDisabled: () => false,
  });

  return {
    domain,
    state,
    auditLogs,
    logger,
    cronApi,
    initializeDatabase,
    getDatabaseHandle: () => databaseHandle,
    getRestoreSuccessCount: () => restoreSuccessCount,
  };
}

let tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function createTempRoot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-backup-domain-'));
  tempDirs.push(dir);
  return dir;
}

describe('createBackupDomain', () => {
  it('backs up the database and applies retention from config', async () => {
    const root = await createTempRoot();
    const dbFile = path.join(root, 'storage.sqlite');
    const backupDir = path.join(root, 'backups');
    await fs.writeFile(dbFile, 'primary-db');

    const { domain, auditLogs } = createHarness({
      dbFile,
      backupDir,
      retentionCopies: 1,
    });

    const first = await domain.performDatabaseBackup({ actor: 'tester', reason: 'config-retention' });
    expect(first.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await domain.performDatabaseBackup({ actor: 'tester', reason: 'config-retention' });
    expect(second.ok).toBe(true);

    const files = await fs.readdir(backupDir);
    expect(files).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      action: 'db.backup',
      result: 'success',
      actor: 'tester',
      meta: expect.objectContaining({
        status: 'success',
        reason: 'config-retention',
      }),
    });
  });

  it('restores a backup file and reinitializes database state', async () => {
    const root = await createTempRoot();
    const dbFile = path.join(root, 'storage.sqlite');
    const backupDir = path.join(root, 'backups');
    const backupFile = path.join(backupDir, 'storage-restore.sqlite');

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(dbFile, 'old-data');
    await fs.writeFile(backupFile, 'new-data');

    const { domain, initializeDatabase, getRestoreSuccessCount, auditLogs } = createHarness({
      dbFile,
      backupDir,
    });

    const result = await domain.restoreDatabaseBackup({
      filename: 'storage-restore.sqlite',
      actor: 'restorer',
      note: 'restore smoke',
    });

    expect(result.ok).toBe(true);
    expect(await fs.readFile(dbFile, 'utf8')).toBe('new-data');
    expect(initializeDatabase).toHaveBeenCalledWith({ dbFile });
    expect(getRestoreSuccessCount()).toBe(1);
    expect(auditLogs[0]).toMatchObject({
      action: 'db.restore',
      result: 'success',
      actor: 'restorer',
    });
  });

  it('schedules backup cron and exposes schedule metadata in summary', async () => {
    const root = await createTempRoot();
    const dbFile = path.join(root, 'storage.sqlite');
    const backupDir = path.join(root, 'backups');
    await fs.writeFile(dbFile, 'primary-db');

    const { domain, state, cronApi, auditLogs } = createHarness({
      dbFile,
      backupDir,
      cronExpression: '15 2 * * *',
      retentionCopies: 3,
    });

    auditLogs.push({
      ts: '2024-01-01T00:00:00.000Z',
      actor: 'tester',
      action: 'db.backup',
      detail: 'success',
      result: 'success',
      meta: { status: 'success', reason: 'scheduled' },
    });

    domain.refreshDatabaseBackupSchedule();
    const summary = domain.buildBackupSummary({ limit: 5 });

    expect(cronApi.schedule).toHaveBeenCalledWith('15 2 * * *', expect.any(Function));
    expect(state.backupScheduleMeta.active).toBe(true);
    expect(summary.schedule).toMatchObject({
      cron: '15 2 * * *',
      cronDescription: 'Cron 15 2 * * *',
      retentionCopies: 3,
      active: true,
      nextRunHuman: 'soon',
    });
    expect(summary.lastSuccess).toMatchObject({
      action: 'db.backup',
      result: 'success',
    });
  });
});
