/* eslint-env node */

/* @vitest-environment node */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runInitDatabase } from '../scripts/init-database.mjs';

let tempRoot;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-init-db-'));
});

afterEach(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  }
});

function createLogger() {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('init-database core', () => {
  it('tra ve 0 khi SQLite file da san sang', async () => {
    const dbFile = path.join(tempRoot, 'storage.sqlite');
    await fs.writeFile(dbFile, 'seed');

    const listAccounts = vi.fn(async () => []);
    const dispose = vi.fn(async () => {});
    const ensureSqlite = vi.fn(async () => {});
    const logger = createLogger();

    const exitCode = await runInitDatabase({
      env: {},
      logger,
      ensureSqlite,
      runtimeContextFactory: async () => ({
        config: { dbFile },
        persistence: { authStore: { listAccounts } },
        dispose,
      }),
    });

    expect(exitCode).toBe(0);
    expect(ensureSqlite).toHaveBeenCalledTimes(1);
    expect(listAccounts).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Đã sẵn sàng cơ sở dữ liệu SQLite'));
  });

  it('tra ve 1 khi dbFile la memory mode', async () => {
    const ensureSqlite = vi.fn(async () => {});
    const dispose = vi.fn(async () => {});
    const logger = createLogger();

    const exitCode = await runInitDatabase({
      env: {},
      logger,
      ensureSqlite,
      runtimeContextFactory: async () => ({
        config: { dbFile: ':memory:' },
        persistence: { authStore: { listAccounts: vi.fn(async () => []) } },
        dispose,
      }),
    });

    expect(exitCode).toBe(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Không xác định được đường dẫn cơ sở dữ liệu SQLite cho runtime-v4.');
  });

  it('tra ve 1 khi SQLite file khong ton tai sau bootstrap', async () => {
    const dbFile = path.join(tempRoot, 'missing.sqlite');
    const ensureSqlite = vi.fn(async () => {});
    const logger = createLogger();

    const exitCode = await runInitDatabase({
      env: {},
      logger,
      ensureSqlite,
      runtimeContextFactory: async () => ({
        config: { dbFile },
        persistence: { authStore: { listAccounts: vi.fn(async () => []) } },
        dispose: vi.fn(async () => {}),
      }),
    });

    expect(exitCode).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Không thể tạo file SQLite'));
  });
});
