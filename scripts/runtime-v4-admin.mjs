import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveApiProjectRoot, resolveApiRuntimeConfig } from '../apps/api/src/apiRuntimeConfig.js';

export function resolveServerV4RuntimePath(projectRoot = resolveApiProjectRoot()) {
  return path.resolve(projectRoot, 'dist', 'server-v4', 'index.js');
}

export async function loadServerV4RuntimeModule({
  projectRoot = resolveApiProjectRoot(),
  runtimeModuleLoader,
} = {}) {
  const runtimePath = resolveServerV4RuntimePath(projectRoot);
  if (typeof runtimeModuleLoader === 'function') {
    return runtimeModuleLoader(runtimePath);
  }

  try {
    return await import(pathToFileURL(runtimePath).href);
  } catch (error) {
    if (!existsSync(runtimePath)) {
      throw new Error(`Missing compiled server-v4 runtime at ${runtimePath}. Run "pnpm build:server-v4" first.`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot load compiled server-v4 runtime at ${runtimePath}: ${message}`);
  }
}

export async function createRuntimeAdminContext({
  runtimeConfigInput = {},
  env = process.env,
  logger = console,
  runtimeModule,
  runtimeModuleLoader,
} = {}) {
  const config = resolveApiRuntimeConfig(runtimeConfigInput, env);
  const loadedRuntimeModule =
    runtimeModule ??
    (await loadServerV4RuntimeModule({
      projectRoot: config.projectRoot,
      runtimeModuleLoader,
    }));

  if (typeof loadedRuntimeModule?.createRuntimePersistence !== 'function') {
    throw new Error('Compiled server-v4 runtime is missing createRuntimePersistence().');
  }
  if (typeof loadedRuntimeModule?.createBackupAdminRuntime !== 'function') {
    throw new Error('Compiled server-v4 runtime is missing createBackupAdminRuntime().');
  }

  const persistence = loadedRuntimeModule.createRuntimePersistence({
    dbFile: config.dbFile,
    persistenceMode: config.persistenceMode,
    postgresUrl: config.postgresUrl,
    postgresLegacySqliteFallback: config.postgresLegacySqliteFallback,
  });
  const backupAdmin = loadedRuntimeModule.createBackupAdminRuntime({
    authStore: persistence.authStore,
    dbFile: config.dbFile,
    logger,
  });

  return {
    config,
    runtimeModule: loadedRuntimeModule,
    persistence,
    backupAdmin,
    async dispose() {
      await backupAdmin.dispose?.();
      await persistence.dispose?.();
    },
  };
}

export async function ensureSqliteBaseline(runtimeContext) {
  const authStore = runtimeContext?.persistence?.authStore;
  if (typeof authStore?.listAccounts !== 'function') {
    return;
  }
  await authStore.listAccounts();
}

export function resolveDefaultBackupDirectory(dbFile) {
  if (typeof dbFile === 'string' && dbFile.trim() && dbFile !== ':memory:') {
    return path.resolve(path.dirname(dbFile), 'backups');
  }
  return path.resolve(process.cwd(), 'data', 'backups');
}
