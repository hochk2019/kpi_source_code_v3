import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 0;
const DEFAULT_PERSISTENCE_MODE = "sqlite-dual-write";
const DEFAULT_IMPORTER_COMPAT_GUARD_MODE = "off";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export function resolveApiProjectRoot() {
  return path.resolve(moduleDirectory, "../../..");
}

export function resolveApiRuntimeConfig(input = {}, env = process.env) {
  const projectRoot = input.projectRoot ?? resolveApiProjectRoot();
  const persistenceMode = resolvePersistenceMode(input.persistenceMode ?? env.KPI_API_PERSISTENCE_MODE);
  const postgresLegacySqliteFallback = resolveBooleanFlag(
    input.postgresLegacySqliteFallback ?? env.KPI_API_POSTGRES_LEGACY_SQLITE_FALLBACK,
  );

  return {
    projectRoot,
    host: resolveHost(input.host ?? env.KPI_API_HOST ?? env.HOST),
    port: resolvePort(input.port ?? env.KPI_API_PORT ?? env.PORT),
    dbFile: resolveDbFile(input.dbFile ?? env.KPI_API_DB_FILE ?? env.DB_FILE, projectRoot, {
      persistenceMode,
      postgresLegacySqliteFallback,
    }),
    persistenceMode,
    postgresUrl: resolvePostgresUrl(input.postgresUrl ?? env.KPI_API_POSTGRES_URL),
    postgresLegacySqliteFallback,
    importerCompatGuardMode: resolveImporterCompatGuardMode(
      input.importerCompatGuardMode ?? env.KPI_API_IMPORTER_COMPAT_GUARD_MODE,
    ),
  };
}

function resolveHost(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || DEFAULT_HOST;
}

function resolvePort(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 65535) {
    return value;
  }

  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid API port: ${normalized}`);
  }

  return parsed;
}

function resolveDbFile(value, projectRoot, options) {
  if (!value) {
    if (options.persistenceMode === "postgres" && !options.postgresLegacySqliteFallback) {
      return null;
    }

    return path.resolve(projectRoot, "data", "storage.sqlite");
  }

  if (value === ":memory:") {
    return value;
  }

  if (path.isAbsolute(value)) {
    return value;
  }

  return path.resolve(projectRoot, value);
}

function resolvePersistenceMode(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return DEFAULT_PERSISTENCE_MODE;
  }

  if (normalized === "sqlite-dual-write" || normalized === "postgres") {
    return normalized;
  }

  throw new Error(`Invalid API persistence mode: ${normalized}`);
}

function resolvePostgresUrl(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return null;
  }

  return normalized;
}

function resolveBooleanFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return false;
  }

  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function resolveImporterCompatGuardMode(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return DEFAULT_IMPORTER_COMPAT_GUARD_MODE;
  }

  if (normalized === "off" || normalized === "block-migrated") {
    return normalized;
  }

  throw new Error(`Invalid importer compat guard mode: ${normalized}`);
}
