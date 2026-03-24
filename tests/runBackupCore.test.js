/* eslint-env node */

/* @vitest-environment node */

import process from 'node:process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.KPI_SKIP_LISTEN = '1';
process.env.KPI_DISABLE_CRON = '1';

let tempRoot;
let backupDir;
let dbFile;
let parseBackupCliArgs;
let runBackupCli;
let getDatabaseHandle;
let resetDatabaseForTests;

beforeAll(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-backup-cli-'));
  backupDir = path.join(tempRoot, 'backups');
  dbFile = path.join(tempRoot, 'storage.sqlite');

  process.env.KPI_DB_FILE = dbFile;
  process.env.KPI_DB_BACKUP_DIR = backupDir;

  ({ parseBackupCliArgs, main: runBackupCli } = await import('../scripts/run-backup-core.mjs'));
  ({ getDatabaseHandle, resetDatabaseForTests } = await import('../server/index.js'));
});

beforeEach(async () => {
  resetDatabaseForTests();
  await fs.rm(backupDir, { recursive: true, force: true });
});

afterAll(async () => {
  getDatabaseHandle()?.close?.();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function readAuditLogs() {
  const db = getDatabaseHandle();
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('audit_logs_v1');
  if (!row?.value) {
    return [];
  }
  const parsed = JSON.parse(row.value);
  return Array.isArray(parsed) ? parsed : [];
}

describe('run-backup CLI core', () => {
  it('parse args cho backup CLI', () => {
    expect(
      parseBackupCliArgs([
        '--reason',
        'manual-seed',
        '--note',
        'tao baseline',
        '--retention',
        '5',
        '--directory',
        'tmp/backups',
        '--actor',
        'tester',
      ])
    ).toEqual({
      reason: 'manual-seed',
      note: 'tao baseline',
      retention: 5,
      directory: 'tmp/backups',
      actor: 'tester',
    });
  });

  it('tao backup thanh cong va ghi audit log qua CLI', async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = await runBackupCli(['--reason', 'manual-seed', '--note', 'baseline local'], { logger });

    expect(result.ok).toBe(true);
    expect(result.file).toContain('storage-');

    const files = await fs.readdir(backupDir);
    expect(files.some((file) => file.endsWith('.sqlite'))).toBe(true);

    const logs = readAuditLogs();
    expect(logs[0]).toMatchObject({
      actor: 'local-cli',
      action: 'db.backup',
      result: 'success',
      note: 'baseline local',
      meta: expect.objectContaining({
        status: 'success',
        reason: 'manual-seed',
      }),
    });

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Đã tạo backup local'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('pnpm healthcheck'));
  });
});
