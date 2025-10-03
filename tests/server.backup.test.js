/* eslint-env node */
/* @vitest-environment node */
import process from 'node:process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.KPI_DB_FILE = ':memory:';
process.env.KPI_SKIP_LISTEN = '1';
process.env.KPI_DISABLE_CRON = '1';

let initializeDatabase;
let performDatabaseBackup;
let resetDatabaseForTests;
let getDatabaseHandle;

beforeAll(async () => {
  ({
    initializeDatabase,
    performDatabaseBackup,
    resetDatabaseForTests,
    getDatabaseHandle,
  } = await import('../server/index.js'));
});

beforeEach(() => {
  resetDatabaseForTests();
});

function readAuditLogs() {
  const db = getDatabaseHandle();
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('audit_logs_v1');
  if (!row || row.value == null) {
    return [];
  }
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

describe('performDatabaseBackup', () => {
  it('tạo file sao lưu và giới hạn số lượng theo retention', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-backup-'));
    const dbFile = path.join(tmpDir, 'storage.sqlite');
    const backupDir = path.join(tmpDir, 'backups');

    const db = await initializeDatabase({ dbFile });
    db.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)').run('custom_key', '"value"');
    db.close();

    const first = await performDatabaseBackup({
      dbFile,
      backupDir,
      retention: 2,
      reason: 'test',
      actor: 'tester',
    });
    expect(first.ok).toBe(true);
    const filesAfterFirst = await fs.readdir(backupDir);
    expect(filesAfterFirst.length).toBe(1);

    const pause = () => new Promise((resolve) => setTimeout(resolve, 10));
    await pause();
    await performDatabaseBackup({ dbFile, backupDir, retention: 2, reason: 'test', actor: 'tester' });
    await pause();
    await performDatabaseBackup({ dbFile, backupDir, retention: 2, reason: 'test', actor: 'tester' });

    const files = await fs.readdir(backupDir);
    expect(files.length).toBeLessThanOrEqual(2);

    const logs = readAuditLogs();
    expect(logs.length).toBeGreaterThanOrEqual(3);
    expect(logs[0]).toMatchObject({
      actor: 'tester',
      action: 'db.backup',
      meta: expect.objectContaining({ status: 'success', reason: 'test' }),
    });

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('ghi nhận audit khi sao lưu thành công', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-backup-'));
    const dbFile = path.join(tmpDir, 'storage.sqlite');
    const backupDir = path.join(tmpDir, 'backups');

    const db = await initializeDatabase({ dbFile });
    db.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)').run('custom_key', '"value"');
    db.close();

    const result = await performDatabaseBackup({
      dbFile,
      backupDir,
      retention: 5,
      reason: 'audit-success',
      actor: 'auditor',
    });
    expect(result.ok).toBe(true);

    const logs = readAuditLogs();
    expect(logs[0]).toMatchObject({
      actor: 'auditor',
      action: 'db.backup',
    });
    expect(logs[0].detail).toContain('Sao lưu CSDL');
    expect(logs[0].detail).toContain('audit-success');
    expect(logs[0].meta).toMatchObject({
      status: 'success',
      reason: 'audit-success',
      bytes: result.bytes,
      file: result.file,
    });

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('ghi nhận audit khi sao lưu thất bại', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-backup-'));
    const backupDir = path.join(tmpDir, 'backups');

    const result = await performDatabaseBackup({
      dbFile: ':memory:',
      backupDir,
      reason: 'audit-failure',
      actor: 'auditor',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('memory_db');

    const logs = readAuditLogs();
    expect(logs[0]).toMatchObject({
      actor: 'auditor',
      action: 'db.backup',
    });
    expect(logs[0].detail).toContain('thất bại');
    expect(logs[0].meta).toMatchObject({ status: 'failure', reason: 'memory_db' });

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('không xóa bản sao lưu khi retention = 0', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-backup-'));
    const dbFile = path.join(tmpDir, 'storage.sqlite');
    const backupDir = path.join(tmpDir, 'backups');

    const db = await initializeDatabase({ dbFile });
    db.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)').run('custom_key', '"value"');
    db.close();

    await performDatabaseBackup({ dbFile, backupDir, retention: 0, reason: 'keep-all', actor: 'auditor' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await performDatabaseBackup({ dbFile, backupDir, retention: 0, reason: 'keep-all', actor: 'auditor' });

    const files = await fs.readdir(backupDir);
    expect(files.length).toBe(2);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
