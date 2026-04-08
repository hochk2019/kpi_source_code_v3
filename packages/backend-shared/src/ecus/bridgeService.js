import sql from "mssql";

import {
  buildSqlConnectionConfig,
  resolveSqlPaginationCapabilities,
  SQL_POOL_DEFAULT_REQUEST_TIMEOUT,
} from "../../../../apps/ecus-bridge/src/sqlBridge.js";

const DEFAULT_MST_HISTORY_TABLE_NAME =
  (process.env.KPI_MST_HISTORY_TABLE || "dbo.KPI_MST_HISTORY").trim() || "dbo.KPI_MST_HISTORY";
const DEFAULT_ACCOUNT_SYNC_TABLE_NAME =
  (process.env.KPI_ACCOUNT_SYNC_TABLE || "dbo.KPI_USER_ROLES").trim() || "dbo.KPI_USER_ROLES";
const DEFAULT_MST_HISTORY_MAX_ENTRIES = 500;
const DEFAULT_ACCOUNT_SYNC_MIN_INTERVAL_MS = 5000;

function parseSqlTableName(input) {
  const trimmed = `${input ?? ""}`.trim();
  if (!trimmed) {
    return null;
  }
  const rawParts = trimmed
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!rawParts.length || rawParts.length > 2) {
    return null;
  }
  const normalizedParts = rawParts
    .map((part) => part.replace(/[^a-zA-Z0-9_]/g, ""))
    .filter(Boolean);
  if (!normalizedParts.length || normalizedParts.length > 2) {
    return null;
  }
  if (normalizedParts.length === 1) {
    normalizedParts.unshift("dbo");
  }
  const objectId = normalizedParts.join(".");
  const quoted = normalizedParts.map((part) => `[${part}]`).join(".");
  const indexName = normalizedParts.join("_");
  return { objectId, quoted, indexName };
}

function escapeSqlLiteral(value, { nvarchar = false } = {}) {
  if (value === null || value === undefined) {
    return nvarchar ? "N''" : "''";
  }
  const text = `${value}`.replace(/'/g, "''");
  return nvarchar ? `N'${text}'` : `'${text}'`;
}

function toLoggerMethod(logger, method) {
  if (logger && typeof logger[method] === "function") {
    return logger[method].bind(logger);
  }
  return console[method].bind(console);
}

export function createEcusBridgeService({
  getEcusConfig,
  sqlPoolManager,
  loadAccountRecords,
  persistAccountRecords,
  sortAccountRecords,
  normalizeAccountRecordForStorage,
  normalizeRoleKey,
  normalizePermissionsForRole,
  normalizeAccountUpdatedAt,
  toNullableString,
  normalizeMST,
  normalizeStr,
  toISODate,
  safeParse,
  getValue,
  upsertValue,
  normalizeRangeDate,
  recordSqlTimeout = () => {},
  isSqlTimeoutError = () => false,
  logger = console,
  buildConnectionConfig = buildSqlConnectionConfig,
  resolvePaginationCapabilities = resolveSqlPaginationCapabilities,
  requestTimeoutDefault = SQL_POOL_DEFAULT_REQUEST_TIMEOUT,
  defaultSyncConfig = {},
  mstHistoryTableName = DEFAULT_MST_HISTORY_TABLE_NAME,
  accountSyncTableName = DEFAULT_ACCOUNT_SYNC_TABLE_NAME,
  mstHistoryMaxEntries = DEFAULT_MST_HISTORY_MAX_ENTRIES,
  accountSyncMinIntervalMs = DEFAULT_ACCOUNT_SYNC_MIN_INTERVAL_MS,
}) {
  const logError = toLoggerMethod(logger, "error");
  const mstHistoryTable = parseSqlTableName(mstHistoryTableName);
  const accountSyncTable = parseSqlTableName(accountSyncTableName);

  let mstHistoryEnsurePromise = null;
  let mstHistorySyncPromise = null;
  let accountTableEnsurePromise = null;
  let accountSyncPromise = null;
  let accountPullPromise = null;
  let lastAccountPullAt = 0;

  function getConnectionSummary(config = getEcusConfig()) {
    const connectionConfig = buildConnectionConfig(config);
    return {
      server: connectionConfig?.server || null,
      database: connectionConfig?.database || null,
    };
  }

  function hasConfiguredConnection(config = getEcusConfig()) {
    const connection = getConnectionSummary(config);
    return !!(connection.server && connection.database);
  }

  function hasMstHistorySqlConfig() {
    return !!resolveMstHistorySqlConfig();
  }

  function resolveMstHistorySqlConfig() {
    if (!mstHistoryTable) {
      return null;
    }
    const connectionConfig = buildConnectionConfig(getEcusConfig());
    if (!connectionConfig.server || !connectionConfig.database) {
      return null;
    }
    return { connectionConfig, table: mstHistoryTable };
  }

  async function ensureMstHistoryTable(pool, tableMeta) {
    if (!pool || !tableMeta) {
      return false;
    }
    if (mstHistoryEnsurePromise) {
      return mstHistoryEnsurePromise;
    }
    mstHistoryEnsurePromise = (async () => {
      try {
        const request = pool.request();
        const createSql = `
          IF OBJECT_ID('${tableMeta.objectId}', 'U') IS NULL
          BEGIN
            CREATE TABLE ${tableMeta.quoted} (
              id NVARCHAR(128) NOT NULL PRIMARY KEY,
              mst NVARCHAR(32) NOT NULL,
              field NVARCHAR(64) NOT NULL,
              from_value NVARCHAR(255) NULL,
              to_value NVARCHAR(255) NULL,
              actor NVARCHAR(128) NULL,
              changed_at DATETIME NOT NULL,
              row_key NVARCHAR(128) NULL,
              effective_from NVARCHAR(32) NULL,
              change_type NVARCHAR(32) NOT NULL
            );
            CREATE INDEX IX_${tableMeta.indexName}_mst_changed_at ON ${tableMeta.quoted}(mst, changed_at);
          END
        `;
        await request.query(createSql);
        return true;
      } catch (err) {
        logError("Không thể đảm bảo bảng lịch sử Gán MST tồn tại", err);
        recordSqlTimeout(err);
        return false;
      } finally {
        mstHistoryEnsurePromise = null;
      }
    })();
    return mstHistoryEnsurePromise;
  }

  function resolveEffectiveFrom(entry) {
    if (!entry) return "";
    const direct = entry.effective_from || entry.effectiveFrom;
    const normalizedDirect = toISODate(direct || "");
    if (normalizedDirect) {
      return normalizedDirect;
    }
    const rowKey = `${entry.rowKey || ""}`;
    const parts = rowKey.split("__");
    if (parts.length >= 2) {
      const iso = toISODate(parts[1]);
      if (iso) {
        return iso;
      }
    }
    return "";
  }

  function clampLength(value, max) {
    if (!value) return "";
    const str = `${value}`;
    return str.length > max ? str.slice(0, max) : str;
  }

  function normalizeMstHistoryEntries(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }
    const normalized = [];
    for (const entry of entries) {
      if (!entry) continue;
      const mst = normalizeMST(entry.mst);
      if (!mst) continue;
      const timestamp = new Date(entry.timestamp || Date.now());
      if (Number.isNaN(timestamp.getTime())) {
        timestamp.setTime(Date.now());
      }
      const field = normalizeStr(entry.field) || "field";
      const rowKey = normalizeStr(entry.rowKey) || `${mst}__${resolveEffectiveFrom(entry)}`;
      const actor = normalizeStr(entry.actor) || "system";
      const type = normalizeStr(entry.type) || "update";
      const effectiveFrom = resolveEffectiveFrom(entry);
      normalized.push({
        id: clampLength(entry.id || `mst-${mst}-${field}-${timestamp.getTime()}`, 120),
        mst,
        field: clampLength(field, 64),
        from: clampLength(normalizeStr(entry.from), 255),
        to: clampLength(normalizeStr(entry.to), 255),
        actor: clampLength(actor, 128),
        timestamp,
        rowKey: clampLength(rowKey, 128),
        effectiveFrom: clampLength(effectiveFrom, 32),
        type: clampLength(type, 32),
      });
    }
    normalized.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return normalized.slice(0, mstHistoryMaxEntries);
  }

  async function syncMstHistoryToSql(entries) {
    const config = resolveMstHistorySqlConfig();
    if (!config) {
      return;
    }
    try {
      const pool = await sqlPoolManager.getPool(config.connectionConfig);
      const ready = await ensureMstHistoryTable(pool, config.table);
      if (!ready) {
        return;
      }
      const normalizedEntries = normalizeMstHistoryEntries(entries);
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        const cleanupRequest = new sql.Request(transaction);
        await cleanupRequest.query(`DELETE FROM ${config.table.quoted};`);
        if (normalizedEntries.length) {
          const insert = new sql.PreparedStatement(transaction);
          insert.input("id", sql.NVarChar(128));
          insert.input("mst", sql.NVarChar(32));
          insert.input("field", sql.NVarChar(64));
          insert.input("from", sql.NVarChar(255));
          insert.input("to", sql.NVarChar(255));
          insert.input("actor", sql.NVarChar(128));
          insert.input("changed_at", sql.DateTime);
          insert.input("row_key", sql.NVarChar(128));
          insert.input("effective_from", sql.NVarChar(32));
          insert.input("change_type", sql.NVarChar(32));
          await insert.prepare(
            `INSERT INTO ${config.table.quoted} (id, mst, field, from_value, to_value, actor, changed_at, row_key, effective_from, change_type)
             VALUES (@id, @mst, @field, @from, @to, @actor, @changed_at, @row_key, @effective_from, @change_type)`,
          );
          try {
            for (const entry of normalizedEntries) {
              await insert.execute({
                id: entry.id,
                mst: entry.mst,
                field: entry.field,
                from: entry.from,
                to: entry.to,
                actor: entry.actor,
                changed_at: entry.timestamp,
                row_key: entry.rowKey,
                effective_from: entry.effectiveFrom,
                change_type: entry.type,
              });
            }
          } finally {
            await insert.unprepare().catch(() => {});
          }
        }
        await transaction.commit();
      } catch (err) {
        await transaction.rollback().catch(() => {});
        throw err;
      }
    } catch (err) {
      if (isSqlTimeoutError(err)) {
        recordSqlTimeout(err);
      }
      logError("Không thể đồng bộ lịch sử Gán MST lên SQL Server", err);
    }
  }

  async function fetchMstHistoryFromSql() {
    const config = resolveMstHistorySqlConfig();
    if (!config) {
      return [];
    }
    try {
      const pool = await sqlPoolManager.getPool(config.connectionConfig);
      const ready = await ensureMstHistoryTable(pool, config.table);
      if (!ready) {
        return [];
      }
      const request = pool.request();
      request.input("limit", sql.Int, mstHistoryMaxEntries);
      const result = await request.query(
        `SELECT TOP (@limit)
           id,
           mst,
           field,
           from_value,
           to_value,
           actor,
           changed_at,
           row_key,
           effective_from,
           change_type
         FROM ${config.table.quoted}
         ORDER BY changed_at DESC, id DESC;`,
      );
      const rows = Array.isArray(result?.recordset) ? result.recordset : [];
      return rows
        .map((row) => {
          const mst = normalizeMST(row?.mst);
          if (!mst) return null;
          const timestamp =
            row?.changed_at instanceof Date ? row.changed_at : new Date(row?.changed_at);
          if (Number.isNaN(timestamp?.getTime?.())) {
            return null;
          }
          return {
            id: clampLength(row?.id, 120),
            mst,
            field: clampLength(normalizeStr(row?.field), 64),
            from: clampLength(normalizeStr(row?.from_value), 255),
            to: clampLength(normalizeStr(row?.to_value), 255),
            actor: clampLength(normalizeStr(row?.actor), 128),
            timestamp: timestamp.toISOString(),
            rowKey: clampLength(
              normalizeStr(row?.row_key) || `${mst}__${toISODate(row?.effective_from || "")}`,
              128,
            ),
            type: clampLength(normalizeStr(row?.change_type), 32) || "update",
          };
        })
        .filter(Boolean);
    } catch (err) {
      if (isSqlTimeoutError(err)) {
        recordSqlTimeout(err);
      }
      logError("Không thể tải lịch sử Gán MST từ SQL Server", err);
      return [];
    }
  }

  async function maybeSyncMstHistoryFromSql() {
    const entries = await fetchMstHistoryFromSql();
    if (!entries.length) {
      return;
    }
    const normalized = JSON.stringify(entries);
    const current = getValue("mst_history_v1");
    if (current !== normalized) {
      upsertValue("mst_history_v1", normalized, { skipMstHistorySync: true });
    }
  }

  function scheduleMstHistorySyncFromJson(jsonValue) {
    const entries = safeParse(jsonValue, []);
    if (!Array.isArray(entries)) {
      return Promise.resolve();
    }
    const queue = mstHistorySyncPromise
      ? mstHistorySyncPromise.catch(() => {}).then(() => syncMstHistoryToSql(entries))
      : syncMstHistoryToSql(entries);
    mstHistorySyncPromise = queue
      .catch((err) => {
        logError("Đồng bộ lịch sử Gán MST lên SQL Server thất bại", err);
      })
      .finally(() => {
        if (mstHistorySyncPromise === queue) {
          mstHistorySyncPromise = null;
        }
      });
    return mstHistorySyncPromise;
  }

  function resolveAccountSqlConfig() {
    if (!accountSyncTable) {
      return null;
    }
    const connectionConfig = buildConnectionConfig(getEcusConfig());
    let serverName = String(connectionConfig.server || "").trim();
    if (!serverName || /^server$/i.test(serverName)) {
      const envServer = String(process.env.ECUS_SQL_SERVER || "").trim();
      if (!envServer || /^server$/i.test(envServer)) {
        return null;
      }
      connectionConfig.server = envServer;
      serverName = envServer;
    }
    if (!connectionConfig.database) {
      return null;
    }
    return { connectionConfig, table: accountSyncTable };
  }

  async function ensureAccountSyncTable(pool, tableMeta) {
    if (!pool || !tableMeta) {
      return false;
    }
    if (accountTableEnsurePromise) {
      return accountTableEnsurePromise;
    }
    accountTableEnsurePromise = (async () => {
      try {
        const request = pool.request();
        const createSql = `
          IF OBJECT_ID('${tableMeta.objectId}', 'U') IS NULL
          BEGIN
            CREATE TABLE ${tableMeta.quoted} (
              username NVARCHAR(128) NOT NULL PRIMARY KEY,
              password_hash NVARCHAR(255) NOT NULL,
              role NVARCHAR(32) NOT NULL,
              name NVARCHAR(255) NULL,
              permissions NVARCHAR(MAX) NOT NULL,
              updated_at DATETIME NOT NULL
            );
          END
        `;
        await request.query(createSql);
        const alterSql = `
          IF COL_LENGTH('${tableMeta.objectId}', 'member_id') IS NULL
          BEGIN
            ALTER TABLE ${tableMeta.quoted} ADD member_id NVARCHAR(128) NULL;
          END;
          IF COL_LENGTH('${tableMeta.objectId}', 'member_name') IS NULL
          BEGIN
            ALTER TABLE ${tableMeta.quoted} ADD member_name NVARCHAR(255) NULL;
          END;
          IF COL_LENGTH('${tableMeta.objectId}', 'team_id') IS NULL
          BEGIN
            ALTER TABLE ${tableMeta.quoted} ADD team_id NVARCHAR(128) NULL;
          END;
          IF COL_LENGTH('${tableMeta.objectId}', 'team_name') IS NULL
          BEGIN
            ALTER TABLE ${tableMeta.quoted} ADD team_name NVARCHAR(255) NULL;
          END;
        `;
        await request.query(alterSql);
        return true;
      } catch (err) {
        if (isSqlTimeoutError(err)) {
          recordSqlTimeout({
            message: err?.message,
            context: { feature: "account-sync", action: "ensure-table" },
          });
        }
        logError("Không thể đảm bảo bảng phân quyền tài khoản tồn tại", err);
        return false;
      } finally {
        accountTableEnsurePromise = null;
      }
    })();
    return accountTableEnsurePromise;
  }

  function serializeAccountRecordForSql(record) {
    if (!record) {
      return null;
    }
    const normalized = normalizeAccountRecordForStorage(record);
    if (!normalized) {
      return null;
    }
    return {
      username: normalized.username,
      passwordHash: normalized.passwordHash,
      role: normalized.role,
      name: normalized.name,
      permissionsJson: JSON.stringify(normalized.permissions || {}),
      updatedAt: normalized.updatedAt,
      memberId: normalized.memberId ?? null,
      memberName: normalized.memberName ?? null,
      teamId: normalized.teamId ?? null,
      teamName: normalized.teamName ?? null,
    };
  }

  function normalizeSqlAccountRow(row) {
    if (!row) return null;
    const username = normalizeStr(row.username);
    if (!username) {
      return null;
    }
    const passwordHash = (row.password_hash ?? row.passwordHash ?? "").toString().trim();
    if (!passwordHash) {
      return null;
    }
    const role = normalizeRoleKey(row.role);
    const name = normalizeStr(row.name) || username;
    const permissionsSource = row.permissions;
    let parsedPermissions = null;
    if (typeof permissionsSource === "string" && permissionsSource.trim()) {
      try {
        parsedPermissions = JSON.parse(permissionsSource);
      } catch {
        parsedPermissions = null;
      }
    } else if (permissionsSource && typeof permissionsSource === "object") {
      parsedPermissions = permissionsSource;
    }
    const permissions = normalizePermissionsForRole(parsedPermissions, role);
    const updatedAt = normalizeAccountUpdatedAt(row.updated_at || row.updatedAt);
    const memberId = toNullableString(row.member_id ?? row.memberId, { maxLength: 160 });
    const memberName = toNullableString(row.member_name ?? row.memberName, { maxLength: 255 });
    const teamId = toNullableString(row.team_id ?? row.teamId, { maxLength: 160 });
    const teamName = toNullableString(row.team_name ?? row.teamName, { maxLength: 255 });
    return {
      username,
      passwordHash,
      role,
      name,
      permissions,
      updatedAt,
      memberId,
      memberName,
      teamId,
      teamName,
    };
  }

  async function syncAccountsToSql(records) {
    const config = resolveAccountSqlConfig();
    if (!config) {
      return;
    }
    try {
      const pool = await sqlPoolManager.getPool(config.connectionConfig);
      const ready = await ensureAccountSyncTable(pool, config.table);
      if (!ready) {
        return;
      }
      const serialized = Array.isArray(records)
        ? records.map((record) => serializeAccountRecordForSql(record)).filter(Boolean)
        : [];
      const statements = serialized.map((record) => {
        const username = escapeSqlLiteral(record.username, { nvarchar: true });
        const passwordHash = escapeSqlLiteral(record.passwordHash, { nvarchar: true });
        const role = escapeSqlLiteral(record.role, { nvarchar: true });
        const name = escapeSqlLiteral(record.name || record.username, { nvarchar: true });
        const permissions = escapeSqlLiteral(record.permissionsJson || "{}", { nvarchar: true });
        const updatedAt = `CONVERT(DATETIME, ${escapeSqlLiteral(record.updatedAt, { nvarchar: true })}, 126)`;
        const memberId = escapeSqlLiteral(record.memberId, { nvarchar: true });
        const memberName = escapeSqlLiteral(record.memberName, { nvarchar: true });
        const teamId = escapeSqlLiteral(record.teamId, { nvarchar: true });
        const teamName = escapeSqlLiteral(record.teamName, { nvarchar: true });
        return `INSERT INTO ${config.table.quoted} (username, password_hash, role, name, permissions, updated_at, member_id, member_name, team_id, team_name)
VALUES (${username}, ${passwordHash}, ${role}, ${name}, ${permissions}, ${updatedAt}, ${memberId}, ${memberName}, ${teamId}, ${teamName});`;
      });
      const batch = [
        "BEGIN TRY",
        "BEGIN TRANSACTION;",
        `DELETE FROM ${config.table.quoted};`,
        ...statements,
        "COMMIT TRANSACTION;",
        "END TRY",
        "BEGIN CATCH",
        "  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;",
        "  THROW;",
        "END CATCH;",
      ].join("\n");
      await pool.request().query(batch);
    } catch (err) {
      if (isSqlTimeoutError(err)) {
        recordSqlTimeout({
          message: err?.message,
          context: { feature: "account-sync", action: "push" },
        });
      }
      logError("Không thể đồng bộ tài khoản lên SQL Server", err);
    }
  }

  function scheduleAccountSync(records) {
    if (!Array.isArray(records)) {
      return Promise.resolve();
    }
    const payload = records.map((record) => ({ ...record }));
    const queue = accountSyncPromise
      ? accountSyncPromise.catch(() => {}).then(() => syncAccountsToSql(payload))
      : syncAccountsToSql(payload);
    accountSyncPromise = queue
      .catch(() => {})
      .finally(() => {
        if (accountSyncPromise === queue) {
          accountSyncPromise = null;
        }
      });
    return accountSyncPromise;
  }

  async function waitForAccountSyncIdle() {
    if (!accountSyncPromise) {
      return;
    }
    try {
      await accountSyncPromise;
    } catch {
      // Bỏ qua lỗi để không làm gián đoạn luồng kiểm thử.
    }
  }

  async function maybeSyncAccountsFromSql({ force = false } = {}) {
    const config = resolveAccountSqlConfig();
    if (!config) {
      return false;
    }
    const now = Date.now();
    if (!force) {
      if (accountPullPromise) {
        return accountPullPromise;
      }
      if (lastAccountPullAt && now - lastAccountPullAt < accountSyncMinIntervalMs) {
        return false;
      }
    }
    if (accountPullPromise) {
      return accountPullPromise;
    }
    accountPullPromise = (async () => {
      try {
        const pool = await sqlPoolManager.getPool(config.connectionConfig);
        const ready = await ensureAccountSyncTable(pool, config.table);
        if (!ready) {
          return false;
        }
        const result = await pool
          .request()
          .query(
            `SELECT username, password_hash, role, name, permissions, updated_at, member_id, member_name, team_id, team_name FROM ${config.table.quoted};`,
          );
        const rows = Array.isArray(result?.recordset) ? result.recordset : [];
        const sqlRecords = rows.map((row) => normalizeSqlAccountRow(row)).filter(Boolean);
        if (!sqlRecords.length) {
          return false;
        }
        const currentRecords = loadAccountRecords();
        const currentMap = new Map();
        for (const record of currentRecords) {
          currentMap.set(record.username.toLowerCase(), normalizeAccountRecordForStorage(record));
        }
        let changed = false;
        for (const sqlRecord of sqlRecords) {
          const key = sqlRecord.username.toLowerCase();
          const existing = currentMap.get(key);
          if (!existing) {
            currentMap.set(key, sqlRecord);
            changed = true;
            continue;
          }
          const existingTime = Date.parse(existing.updatedAt) || 0;
          const sqlTime = Date.parse(sqlRecord.updatedAt) || 0;
          if (sqlTime >= existingTime) {
            const diff =
              existing.passwordHash !== sqlRecord.passwordHash ||
              existing.role !== sqlRecord.role ||
              existing.name !== sqlRecord.name ||
              JSON.stringify(existing.permissions) !== JSON.stringify(sqlRecord.permissions) ||
              sqlTime > existingTime;
            if (diff) {
              currentMap.set(key, sqlRecord);
              changed = true;
            }
          }
        }
        const merged = Array.from(currentMap.values());
        sortAccountRecords(merged);
        const serializedMerged = JSON.stringify(merged);
        const serializedCurrent = JSON.stringify(
          currentRecords
            .map((record) => normalizeAccountRecordForStorage(record))
            .sort((a, b) => a.username.localeCompare(b.username, "vi", { sensitivity: "base" })),
        );
        if (changed || serializedMerged !== serializedCurrent) {
          persistAccountRecords(merged, { skipSqlSync: true });
        }
        return changed;
      } catch (err) {
        if (isSqlTimeoutError(err)) {
          recordSqlTimeout({
            message: err?.message,
            context: { feature: "account-sync", action: "pull" },
          });
        }
        logError("Không thể tải tài khoản từ SQL Server", err);
        return false;
      } finally {
        lastAccountPullAt = Date.now();
        accountPullPromise = null;
      }
    })();
    return accountPullPromise;
  }

  function resetAccountSyncState() {
    accountSyncPromise = null;
    accountPullPromise = null;
    accountTableEnsurePromise = null;
    lastAccountPullAt = 0;
  }

  async function* fetchDeclarations(range, config, options = {}) {
    const connectionConfig = buildConnectionConfig(config);
    if (!connectionConfig.server || !connectionConfig.database) {
      throw new Error("Chưa cấu hình máy chủ hoặc cơ sở dữ liệu SQL Server");
    }
    const pool = await sqlPoolManager.getPool(connectionConfig);
    const requestTimeout = connectionConfig.requestTimeout ?? requestTimeoutDefault;
    const queryText = (config.query || defaultSyncConfig?.query || "").trim();
    if (!queryText) {
      return;
    }
    const baseQuery = queryText.replace(/;\s*$/u, "");
    const includeFilterSet =
      options?.includeTaxCodesSet instanceof Set
        ? new Set(
            Array.from(options.includeTaxCodesSet)
              .map((value) => normalizeMST(value))
              .filter(Boolean),
          )
        : new Set();
    const excludeFilterSet =
      options?.excludeTaxCodesSet instanceof Set
        ? new Set(
            Array.from(options.excludeTaxCodesSet)
              .map((value) => normalizeMST(value))
              .filter(Boolean),
          )
        : new Set();
    const includeFilterList = Array.from(includeFilterSet);
    const excludeFilterList = Array.from(excludeFilterSet);
    const applyIncludeInSql = includeFilterList.length > 0 && includeFilterList.length <= 50;
    const applyExcludeInSql = excludeFilterList.length > 0 && excludeFilterList.length <= 50;
    let workingQuery = baseQuery;
    if (applyIncludeInSql || applyExcludeInSql) {
      const alias = "filtered_source";
      const clauses = [];
      if (applyIncludeInSql) {
        const placeholders = includeFilterList.map((_, idx) => `@__include${idx}`);
        clauses.push(`${alias}.mst IN (${placeholders.join(", ")})`);
      }
      if (applyExcludeInSql) {
        const placeholders = excludeFilterList.map((_, idx) => `@__exclude${idx}`);
        clauses.push(`${alias}.mst NOT IN (${placeholders.join(", ")})`);
      }
      let innerQuery = baseQuery.trim();
      if (innerQuery.endsWith(";")) {
        innerQuery = innerQuery.slice(0, -1);
      }
      if (!/^select\s+top\s+\d+/iu.test(innerQuery)) {
        innerQuery = innerQuery.replace(/^select\s+/iu, "SELECT TOP 100 PERCENT ");
      }
      workingQuery = `SELECT * FROM (${innerQuery}) AS ${alias} WHERE ${clauses.join(" AND ")}`;
    }
    const configuredBatchSize = Number(config?.batchSize);
    const normalizedBatchSize =
      Number.isFinite(configuredBatchSize) && configuredBatchSize > 0
        ? configuredBatchSize
        : Number(defaultSyncConfig?.batchSize);
    const batchSize =
      Number.isFinite(normalizedBatchSize) && normalizedBatchSize > 0
        ? Math.max(1, Math.floor(normalizedBatchSize))
        : 0;
    const fromDate = normalizeRangeDate(range.from);
    const toDate = normalizeRangeDate(range.to, { isEnd: true });

    const attachRangeParameters = (request) => {
      if (fromDate instanceof Date && !Number.isNaN(fromDate.getTime())) {
        request.input("from", sql.DateTime, fromDate);
      }
      if (toDate instanceof Date && !Number.isNaN(toDate.getTime())) {
        request.input("to", sql.DateTime, toDate);
      }
    };

    const attachFilterParameters = (request) => {
      includeFilterList.forEach((mst, idx) => {
        request.input(`__include${idx}`, sql.NVarChar, mst);
      });
      excludeFilterList.forEach((mst, idx) => {
        request.input(`__exclude${idx}`, sql.NVarChar, mst);
      });
    };

    const lowerQuery = workingQuery.toLowerCase();
    const containsOffset =
      /\boffset\s+\d+/u.test(lowerQuery) || /\bfetch\s+next\s+/u.test(lowerQuery);
    let supportsOffsetFetch = true;
    if (batchSize > 0 && !containsOffset) {
      const capabilities = await resolvePaginationCapabilities(
        pool,
        connectionConfig,
        requestTimeout,
      );
      supportsOffsetFetch = capabilities?.supportsOffsetFetch !== false;
    }
    const supportsPagination = batchSize > 0 && !containsOffset && supportsOffsetFetch;

    if (!supportsPagination) {
      const request = pool.request();
      request.timeout = requestTimeout;
      attachRangeParameters(request);
      attachFilterParameters(request);
      const result = await request.query(workingQuery);
      const rows = result?.recordset || [];
      if (rows.length > 0) {
        yield rows;
      }
      return;
    }

    const hasOrderBy = /order\s+by/u.test(lowerQuery);
    const wrappedQuery = hasOrderBy
      ? workingQuery
      : `SELECT * FROM (${workingQuery}) AS base_query ORDER BY (SELECT NULL)`;
    const pagedQuery = `${wrappedQuery} OFFSET @__offset ROWS FETCH NEXT @__limit ROWS ONLY`;

    let offset = 0;
    while (true) {
      const request = pool.request();
      request.timeout = requestTimeout;
      attachRangeParameters(request);
      attachFilterParameters(request);
      request.input("__offset", sql.Int, offset);
      request.input("__limit", sql.Int, batchSize);
      const result = await request.query(pagedQuery);
      const rows = result?.recordset || [];
      if (!rows.length) {
        break;
      }
      yield rows;
      if (rows.length < batchSize) {
        break;
      }
      offset += rows.length;
    }
  }

  async function checkSqlServerHealth() {
    const config = getEcusConfig();
    const connectionConfig = buildConnectionConfig(config);
    if (!connectionConfig.server || !connectionConfig.database) {
      return {
        ok: false,
        state: "not_configured",
        message: "Chưa cấu hình máy chủ hoặc cơ sở dữ liệu SQL Server",
      };
    }
    try {
      const pool = await sqlPoolManager.getPool(connectionConfig);
      const request = pool.request();
      const timeout = connectionConfig.requestTimeout ?? 5000;
      request.timeout = timeout;
      await request.query("SELECT 1 AS ok");
      return {
        ok: true,
        state: "ready",
        server: connectionConfig.server,
        database: connectionConfig.database,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      const timeout = isSqlTimeoutError(err);
      if (timeout) {
        recordSqlTimeout({
          message: err?.message,
          context: { actor: "healthcheck", reason: "status-check" },
        });
      }
      return {
        ok: false,
        state: timeout ? "timeout" : "error",
        message: err?.message || "Không thể kết nối SQL Server",
        code: err?.code || null,
        number: err?.number || null,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  return {
    getConnectionSummary,
    hasConfiguredConnection,
    hasMstHistorySqlConfig,
    scheduleMstHistorySyncFromJson,
    maybeSyncMstHistoryFromSql,
    scheduleAccountSync,
    waitForAccountSyncIdle,
    maybeSyncAccountsFromSql,
    resetAccountSyncState,
    fetchDeclarations,
    checkSqlServerHealth,
  };
}
