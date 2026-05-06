/* eslint-env node */

/* @vitest-environment node */

import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  createRuntimeAdminContext,
  ensureSqliteBaseline,
  loadServerV4RuntimeModule,
  resolveDefaultBackupDirectory,
} from '../scripts/runtime-v4-admin.mjs';

describe('runtime-v4 admin helpers', () => {
  it('resolveDefaultBackupDirectory dung vi tri theo db file', () => {
    expect(resolveDefaultBackupDirectory('/workspace/server/data/storage.sqlite')).toBe(
      path.resolve('/workspace/server/data/backups'),
    );
  });

  it('resolveDefaultBackupDirectory fallback ve cwd khi db memory', () => {
    expect(resolveDefaultBackupDirectory(':memory:')).toBe(path.resolve(process.cwd(), 'data', 'backups'));
  });

  it('ensureSqliteBaseline goi listAccounts neu authStore co san', async () => {
    const listAccounts = vi.fn(async () => []);
    await ensureSqliteBaseline({ persistence: { authStore: { listAccounts } } });
    expect(listAccounts).toHaveBeenCalledTimes(1);
  });

  it('loadServerV4RuntimeModule cho phep inject runtimeModuleLoader', async () => {
    const runtimeModule = { marker: 'stub' };
    const runtimeModuleLoader = vi.fn(async () => runtimeModule);
    const loaded = await loadServerV4RuntimeModule({
      projectRoot: '/workspace/kpi',
      runtimeModuleLoader,
    });

    expect(loaded).toBe(runtimeModule);
    expect(runtimeModuleLoader).toHaveBeenCalledWith(
      path.resolve('/workspace/kpi', 'dist', 'server-v4', 'index.js'),
    );
  });

  it('createRuntimeAdminContext wire dung persistence + backup runtime', async () => {
    const persistenceDispose = vi.fn(async () => {});
    const backupDispose = vi.fn(async () => {});
    const authStore = {};
    const runtimeModule = {
      createRuntimePersistence: vi.fn(() => ({
        authStore,
        dispose: persistenceDispose,
      })),
      createBackupAdminRuntime: vi.fn(() => ({
        domain: { performDatabaseBackup: vi.fn() },
        dispose: backupDispose,
      })),
    };
    const dbFile = path.join(os.tmpdir(), 'kpi-runtime-admin.sqlite');

    const context = await createRuntimeAdminContext({
      runtimeConfigInput: {
        projectRoot: '/workspace/kpi',
        dbFile,
      },
      env: {},
      runtimeModule,
      logger: console,
    });

    expect(runtimeModule.createRuntimePersistence).toHaveBeenCalledWith(
      expect.objectContaining({
        dbFile,
      }),
    );
    expect(runtimeModule.createBackupAdminRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        authStore,
        dbFile,
      }),
    );

    await context.dispose();
    expect(backupDispose).toHaveBeenCalledTimes(1);
    expect(persistenceDispose).toHaveBeenCalledTimes(1);
  });

  it('createRuntimeAdminContext throw khi runtime module thieu factory bat buoc', async () => {
    await expect(
      createRuntimeAdminContext({
        runtimeConfigInput: { projectRoot: '/workspace/kpi' },
        env: {},
        runtimeModule: {},
      }),
    ).rejects.toThrow(/createRuntimePersistence/);
  });
});
