/* eslint-env node */

/* @vitest-environment node */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

let tempRoot;
let backupDir;
let dbFile;
let parseBackupCliArgs;
let runBackupCli;
let runtimeContext;
let runtimeContextFactory;
let listAccountsMock;
let performBackupMock;
let disposeMock;

beforeAll(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-backup-cli-'));
  dbFile = path.join(tempRoot, 'storage.sqlite');
  backupDir = path.join(path.dirname(dbFile), 'backups');

  await fs.writeFile(dbFile, 'seed');

  ({ parseBackupCliArgs, main: runBackupCli } = await import('../scripts/run-backup-core.mjs'));
});

beforeEach(async () => {
  await fs.rm(backupDir, { recursive: true, force: true });
  listAccountsMock = vi.fn(async () => [{ username: 'admin' }]);
  performBackupMock = vi.fn(async ({ backupDir: targetDir }) => {
    await fs.mkdir(targetDir, { recursive: true });
    const file = path.join(targetDir, 'storage-2026.sqlite');
    await fs.writeFile(file, 'backup');
    return {
      ok: true,
      file,
    };
  });
  disposeMock = vi.fn(async () => {});

  runtimeContext = {
    config: { dbFile },
    persistence: {
      authStore: {
        listAccounts: listAccountsMock,
      },
    },
    backupAdmin: {
      domain: {
        performDatabaseBackup: performBackupMock,
      },
    },
    dispose: disposeMock,
  };
  runtimeContextFactory = vi.fn(async () => runtimeContext);
});

afterAll(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

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
      ]),
    ).toEqual({
      reason: 'manual-seed',
      note: 'tao baseline',
      retention: 5,
      directory: 'tmp/backups',
      actor: 'tester',
    });
  });

  it('tao backup thanh cong qua runtime-v4 context', async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = await runBackupCli(['--reason', 'manual-seed', '--note', 'baseline local'], {
      logger,
      runtimeContextFactory,
    });

    expect(result.ok).toBe(true);
    expect(result.file).toBe(path.join(backupDir, 'storage-2026.sqlite'));
    expect(runtimeContextFactory).toHaveBeenCalled();
    expect(listAccountsMock).toHaveBeenCalledTimes(1);
    expect(performBackupMock).toHaveBeenCalledWith({
      reason: 'manual-seed',
      note: 'baseline local',
      retention: undefined,
      actor: 'local-cli',
      backupDir,
    });
    expect(disposeMock).toHaveBeenCalledTimes(1);
    await expect(fs.access(result.file)).resolves.toBeUndefined();

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Đã tạo backup local'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('pnpm healthcheck'));
  });
});
