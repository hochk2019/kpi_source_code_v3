import path from 'node:path';

import type { ImporterCompatGuardMode } from '../app/importerCompatTraffic.js';

export type ServerV4PersistenceMode = 'sqlite-dual-write' | 'postgres';

export type ServerV4ConfigInput = {
  dbFile?: string | null;
  importerCompatGuardMode?: ImporterCompatGuardMode;
  persistenceMode?: ServerV4PersistenceMode;
  postgresUrl?: string | null;
  postgresLegacySqliteFallback?: boolean;
};

export type ServerV4Config = {
  dbFile: string | null;
  importerCompatGuardMode: ImporterCompatGuardMode;
  persistenceMode: ServerV4PersistenceMode;
  postgresUrl: string | null;
  postgresLegacySqliteFallback: boolean;
};

export function resolveServerV4Config(input: ServerV4ConfigInput = {}): ServerV4Config {
  const importerCompatGuardMode = resolveImporterCompatGuardMode(input.importerCompatGuardMode);
  const persistenceMode = resolvePersistenceMode(input.persistenceMode);
  const postgresLegacySqliteFallback = resolvePostgresLegacySqliteFallback(
    input.postgresLegacySqliteFallback,
  );

  return {
    dbFile: resolveDbFile(input.dbFile, {
      persistenceMode,
      postgresLegacySqliteFallback,
    }),
    importerCompatGuardMode,
    persistenceMode,
    postgresUrl: resolvePostgresUrl(input.postgresUrl),
    postgresLegacySqliteFallback,
  };
}

function resolveDbFile(
  value: string | null | undefined,
  options: {
    persistenceMode: ServerV4PersistenceMode;
    postgresLegacySqliteFallback: boolean;
  },
): string | null {
  if (!value) {
    if (options.persistenceMode === 'postgres' && !options.postgresLegacySqliteFallback) {
      return null;
    }

    return path.resolve(process.cwd(), 'server', 'data', 'storage.sqlite');
  }

  if (value === ':memory:') {
    return value;
  }

  if (path.isAbsolute(value)) {
    return value;
  }

  return path.resolve(process.cwd(), value);
}

function resolvePersistenceMode(value?: string): ServerV4PersistenceMode {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return 'sqlite-dual-write';
  }

  if (normalized === 'sqlite-dual-write' || normalized === 'postgres') {
    return normalized;
  }

  throw new Error(`Invalid persistence mode: ${normalized}`);
}

function resolveImporterCompatGuardMode(value?: string): ImporterCompatGuardMode {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return 'off';
  }

  if (normalized === 'off' || normalized === 'block-migrated') {
    return normalized;
  }

  throw new Error(`Invalid importer compat guard mode: ${normalized}`);
}

function resolvePostgresUrl(value?: string | null): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function resolvePostgresLegacySqliteFallback(value?: boolean): boolean {
  return value === true;
}
