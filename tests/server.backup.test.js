/* eslint-env node */
/* @vitest-environment node */
import process from 'node:process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, it, expect, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.KPI_SKIP_LISTEN = '1';
process.env.KPI_DISABLE_CRON = '1';

let initializeDatabase;
let performDatabaseBackup;

beforeAll(async () => {
  ({ initializeDatabase, performDatabaseBackup } = await import('../server/index.js'));
});

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

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
