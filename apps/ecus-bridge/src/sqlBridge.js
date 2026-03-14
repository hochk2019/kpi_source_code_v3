import sql from "mssql";

import { getSecureSqlCredentials } from "./bridgeSecureCredentials.js";

export const SQL_POOL_DEFAULT_CONNECTION_TIMEOUT = 5000;
export const SQL_POOL_DEFAULT_REQUEST_TIMEOUT = 10000;
export const SQL_POOL_DEFAULT_OPTIONS = { max: 5, min: 0, idleTimeoutMillis: 5000 };

const SQL_CAPABILITY_CACHE = new Map();

function parseTimeout(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : undefined;
}

export function buildSqlConnectionConfig(config) {
  const connection = config?.connection || {};
  const poolOptions = connection.pool && typeof connection.pool === "object" ? connection.pool : undefined;
  const secureCredentials = getSecureSqlCredentials();
  const server = `${connection.server || secureCredentials.server || ""}`.trim();
  const database = `${connection.database || secureCredentials.database || ""}`.trim();
  const user = `${connection.user || secureCredentials.user || ""}`.trim();
  const password = connection.password || secureCredentials.password || "";
  return {
    server,
    database,
    user,
    password,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      ...(connection.options || {}),
    },
    port: connection.port ? Number(connection.port) : undefined,
    connectionTimeout: parseTimeout(connection.connectionTimeout),
    requestTimeout: parseTimeout(connection.requestTimeout),
    pool: poolOptions,
  };
}

export function resetSqlCapabilityCache() {
  SQL_CAPABILITY_CACHE.clear();
}

export async function resolveSqlPaginationCapabilities(pool, connectionConfig, requestTimeout) {
  const server = String(connectionConfig?.server ?? "").trim();
  const database = String(connectionConfig?.database ?? "").trim();
  if (!server || !database) {
    return null;
  }

  const cacheKey = `${server}::${database}`;
  const cached = SQL_CAPABILITY_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const request = pool.request();
    if (Number.isFinite(requestTimeout) && requestTimeout > 0) {
      request.timeout = requestTimeout;
    }
    request.input("dbName", sql.NVarChar, database);
    const result = await request.query(`
      SELECT
        CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(128)) AS productVersion,
        CAST(SERVERPROPERTY('Edition') AS NVARCHAR(128)) AS edition,
        d.compatibility_level AS compatibilityLevel
      FROM sys.databases AS d
      WHERE d.name = @dbName;
    `);
    const row = result?.recordset?.[0] || {};
    const level = Number(row.compatibilityLevel);
    const compatibilityLevel = Number.isFinite(level) ? level : null;
    const supportsOffsetFetch = compatibilityLevel !== null ? compatibilityLevel >= 110 : false;
    if (!supportsOffsetFetch) {
      const levelText = compatibilityLevel === null ? "unknown" : compatibilityLevel;
      console.warn(
        `SQL Server compatibility level ${levelText} does not support OFFSET/FETCH pagination; falling back to non-paginated sync.`,
      );
    }
    const payload = {
      productVersion: row.productVersion || null,
      edition: row.edition || null,
      compatibilityLevel,
      supportsOffsetFetch,
    };

    SQL_CAPABILITY_CACHE.set(cacheKey, payload);
    return payload;
  } catch (err) {
    console.warn("Failed to discover SQL Server pagination capabilities", err);
    const fallback = { compatibilityLevel: null, supportsOffsetFetch: false };
    SQL_CAPABILITY_CACHE.set(cacheKey, fallback);
    return fallback;
  }
}

export function createSqlPoolManager() {
  let pool = null;
  let poolKey = null;
  let connectPromise = null;

  const close = async () => {
    const pending = connectPromise;
    connectPromise = null;
    if (pending) {
      try {
        await pending;
      } catch {
        // Bo qua loi ket noi dang xu ly.
      }
    }
    if (pool) {
      const closing = pool;
      pool = null;
      poolKey = null;
      try {
        await closing.close();
      } catch {
        // Bo qua loi dong ket noi.
      }
    }
  };

  const getPool = async (config) => {
    const { connectionTimeout, requestTimeout, pool: poolOptions, ...core } = config || {};
    const normalizedKey = JSON.stringify(core);
    if (pool && poolKey === normalizedKey) {
      if (pool.connected) {
        return pool;
      }
      if (!connectPromise) {
        connectPromise = pool.connect();
      }
      await connectPromise;
      connectPromise = null;
      return pool;
    }

    await close();
    const effectiveConnectionTimeout = connectionTimeout ?? SQL_POOL_DEFAULT_CONNECTION_TIMEOUT;
    const effectiveRequestTimeout = requestTimeout ?? SQL_POOL_DEFAULT_REQUEST_TIMEOUT;
    const effectivePoolOptions = {
      ...SQL_POOL_DEFAULT_OPTIONS,
      ...(poolOptions || {}),
    };
    const nextPool = new sql.ConnectionPool({
      ...core,
      connectionTimeout: effectiveConnectionTimeout,
      requestTimeout: effectiveRequestTimeout,
      pool: effectivePoolOptions,
    });
    pool = nextPool;
    poolKey = normalizedKey;
    connectPromise = nextPool.connect();
    try {
      await connectPromise;
    } catch (err) {
      await close();
      throw err;
    } finally {
      connectPromise = null;
    }
    return pool;
  };

  return {
    getPool,
    close,
  };
}
