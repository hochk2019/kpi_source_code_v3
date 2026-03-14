import {
  DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY,
  MONTHLY_REPORTING_AGGREGATE_KEY,
  REPORT_SCHEDULE_STORAGE_KEY,
} from './reportingProjectionStore.js';

export function normalizeStorageValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function syncReportingProjectionSeeds(database, readValue, options = {}) {
  const {
    safeParse: parseJson = safeParse,
    writeProjectionValue = () => {},
    updatedAt = new Date().toISOString(),
    source = 'bootstrap-sync',
  } = options;

  if (!database || typeof readValue !== 'function') {
    return;
  }

  const projectionOptions = {
    updatedAt: normalizeText(updatedAt) || new Date().toISOString(),
    source: normalizeText(source) || 'bootstrap-sync',
  };

  const schedules = parseJson(readValue(REPORT_SCHEDULE_STORAGE_KEY), null);
  if (Array.isArray(schedules)) {
    writeProjectionValue(database, REPORT_SCHEDULE_STORAGE_KEY, schedules, projectionOptions);
  }

  const monthlyAggregate = parseJson(readValue(MONTHLY_REPORTING_AGGREGATE_KEY), null);
  if (isRecord(monthlyAggregate)) {
    writeProjectionValue(database, MONTHLY_REPORTING_AGGREGATE_KEY, monthlyAggregate, projectionOptions);
  }

  const defaultMonthlyAggregate = parseJson(readValue(DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY), null);
  if (isRecord(defaultMonthlyAggregate)) {
    writeProjectionValue(database, DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY, defaultMonthlyAggregate, projectionOptions);
  }
}

export function hydrateRuntimeStorageSnapshots(options = {}) {
  const {
    database,
    readValue,
    safeParse: parseJson = safeParse,
    normalizeDeclRows = defaultNormalizeDeclRows,
    writeDeclarationRowsSnapshot = () => {},
    writeMstAssignmentRowsSnapshot = () => {},
    writeTeamRosterSnapshot = () => {},
    writeRuleCollectionSnapshot = () => {},
    loadRulesSnapshot = () => null,
    persistRulesSnapshot = () => {},
    writeAdjustmentRowsSnapshot = () => {},
    writeProjectionValue = () => {},
    defaultRules = {},
    seeded = false,
    source = '',
    updatedAt = new Date().toISOString(),
    logger = console,
  } = options;

  if (!database || typeof readValue !== 'function') {
    return;
  }

  const snapshotOptions = {
    updatedAt,
  };
  const warn = resolveWarn(logger);
  const hydrateSource = normalizeText(source) || (seeded ? 'bootstrap-seed' : 'bootstrap-sync');

  try {
    const rawValue = readValue('decl_rows_v1');
    const normalizedRows = normalizeDeclRows(parseJson(rawValue, [])).normalizedRows;
    writeDeclarationRowsSnapshot(database, normalizedRows, snapshotOptions);
  } catch (err) {
    warn('Không thể đồng bộ bảng tờ khai typed khi khởi tạo', err);
  }

  try {
    const rawValue = readValue('mst_rows_v2');
    writeMstAssignmentRowsSnapshot(database, parseJson(rawValue, []), snapshotOptions);
  } catch (err) {
    warn('Không thể đồng bộ bảng MST typed khi khởi tạo', err);
  }

  try {
    const rawValue = readValue('team_roster_v1');
    writeTeamRosterSnapshot(database, parseJson(rawValue, { version: 1, teams: [] }), snapshotOptions);
  } catch (err) {
    warn('Không thể đồng bộ bảng tổ đội khi khởi tạo', err);
  }

  try {
    const rawRules = readValue('kpi_rules_v2');
    writeRuleCollectionSnapshot(database, parseJson(rawRules, defaultRules), snapshotOptions);

    if (typeof rawRules === 'string' && rawRules) {
      const currentSnapshot = loadRulesSnapshot();
      const existingRules = currentSnapshot?.rules || null;
      const parsedRules = parseJson(rawRules, null);

      if (parsedRules && JSON.stringify(existingRules) !== JSON.stringify(parsedRules)) {
        persistRulesSnapshot(rawRules, {
          actor: 'system',
          source: hydrateSource,
        });
      }
    }
  } catch (err) {
    warn('Không thể đồng bộ file quy tắc KPI khi khởi tạo', err);
  }

  try {
    const rawValue = readValue('kpi_adjustments_v1');
    writeAdjustmentRowsSnapshot(database, parseJson(rawValue, []), snapshotOptions);
  } catch (err) {
    warn('Không thể đồng bộ bảng điều chỉnh KPI typed khi khởi tạo', err);
  }

  try {
    syncReportingProjectionSeeds(database, readValue, {
      safeParse: parseJson,
      writeProjectionValue,
      updatedAt,
      source: hydrateSource,
    });
  } catch (err) {
    warn('Không thể đồng bộ projection reporting khi khởi tạo', err);
  }
}

export function createRuntimeStorageLifecycle(options = {}) {
  const {
    defaultStorage = {},
    safeParse: parseJson = safeParse,
    normalizeDeclRows = defaultNormalizeDeclRows,
    scheduleMstHistorySyncFromJson = () => {},
    writeTeamRosterSnapshot = () => {},
    deleteTeamRosterSnapshot = () => {},
    writeDeclarationRowsSnapshot = () => {},
    deleteDeclarationRowsSnapshot = () => {},
    writeMstAssignmentRowsSnapshot = () => {},
    deleteMstAssignmentRowsSnapshot = () => {},
    writeRuleCollectionSnapshot = () => {},
    persistRulesSnapshot = () => {},
    loadRulesSnapshot = () => null,
    writeAdjustmentRowsSnapshot = () => {},
    deleteAdjustmentRowsSnapshot = () => {},
    writeProjectionValue = () => {},
    refreshReportingAggregate = () => {},
    getRulesSeed = (rules) => rules,
    defaultRules = {},
    aiChatHistoryPrefix = '',
    listAccountsForClient = () => [],
    logger = console,
  } = options;
  const getDatabase =
    typeof options.getDatabase === 'function' ? options.getDatabase : () => options.database ?? null;

  function readStorage() {
    const database = getDatabase();
    const rows = database.prepare('SELECT key, value FROM kv_store').all();
    const store = { ...defaultStorage };

    for (const row of rows) {
      store[row.key] = row.value;
    }

    return store;
  }

  function getValue(key) {
    const database = getDatabase();
    const row = database.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
    if (!row || row.value === undefined || row.value === null) {
      return defaultStorage[key] ?? null;
    }

    return row.value;
  }

  function getJSONValue(key, fallback) {
    return parseJson(getValue(key), fallback);
  }

  function upsertValue(key, value, runtimeOptions = {}) {
    const database = getDatabase();
    const { skipMstHistorySync = false, actor = 'system', source = 'storage' } = runtimeOptions || {};
    const normalized = normalizeStorageValue(value);

    if (normalized === null) {
      deleteValue(key, {
        actor,
        source: source || 'storage-delete',
        skipMstHistorySync,
      });
      return;
    }

    database
      .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, normalized);

    const updatedAt = new Date().toISOString();

    if (key === 'mst_history_v1' && !skipMstHistorySync) {
      scheduleMstHistorySyncFromJson(normalized);
    }

    if (key === 'team_roster_v1') {
      writeTeamRosterSnapshot(database, parseJson(normalized, { version: 1, teams: [] }), { updatedAt });
    }

    if (key === 'decl_rows_v1') {
      writeDeclarationRowsSnapshot(database, normalizeDeclRows(parseJson(normalized, [])).normalizedRows, {
        updatedAt,
      });
    }

    if (key === 'mst_rows_v2') {
      writeMstAssignmentRowsSnapshot(database, parseJson(normalized, []), { updatedAt });
    }

    if (key === 'kpi_rules_v2') {
      writeRuleCollectionSnapshot(database, parseJson(normalized, defaultRules), { updatedAt });
      persistRulesSnapshot(normalized, { actor, source });
    }

    if (key === 'kpi_adjustments_v1') {
      writeAdjustmentRowsSnapshot(database, parseJson(normalized, []), { updatedAt });
    }

    refreshReportingAggregate(key, { actor, source });
  }

  function deleteValue(key, runtimeOptions = {}) {
    const database = getDatabase();
    const { actor = 'system', source = 'storage-delete', skipMstHistorySync = false } = runtimeOptions || {};

    database.prepare('DELETE FROM kv_store WHERE key = ?').run(key);

    if (key === 'mst_history_v1' && !skipMstHistorySync) {
      scheduleMstHistorySyncFromJson('[]');
    }

    if (key === 'team_roster_v1') {
      deleteTeamRosterSnapshot(database);
    }

    if (key === 'decl_rows_v1') {
      deleteDeclarationRowsSnapshot(database);
    }

    if (key === 'mst_rows_v2') {
      deleteMstAssignmentRowsSnapshot(database);
    }

    if (key === 'kpi_rules_v2') {
      const updatedAt = new Date().toISOString();
      const rulesSeed = getRulesSeed(defaultRules);
      persistRulesSnapshot(JSON.stringify(rulesSeed), { actor, source });
      writeRuleCollectionSnapshot(database, rulesSeed, { updatedAt });
    }

    if (key === 'kpi_adjustments_v1') {
      deleteAdjustmentRowsSnapshot(database);
    }

    refreshReportingAggregate(key, { actor, source });
  }

  function setJSONValue(key, value, runtimeOptions = {}) {
    upsertValue(key, value === undefined ? null : JSON.stringify(value), runtimeOptions);
  }

  function buildBootstrapSnapshot() {
    const store = readStorage();

    if (aiChatHistoryPrefix) {
      for (const key of Object.keys(store)) {
        if (key.startsWith(aiChatHistoryPrefix)) {
          delete store[key];
        }
      }
    }

    try {
      store.kpi_users_v1 = JSON.stringify(listAccountsForClient());
    } catch {
      store.kpi_users_v1 = '[]';
    }

    return store;
  }

  function hydrateSqliteSnapshots(hydrateOptions = {}) {
    hydrateRuntimeStorageSnapshots({
      database: getDatabase(),
      readValue: getValue,
      safeParse: parseJson,
      normalizeDeclRows,
      writeDeclarationRowsSnapshot,
      writeMstAssignmentRowsSnapshot,
      writeTeamRosterSnapshot,
      writeRuleCollectionSnapshot,
      loadRulesSnapshot,
      persistRulesSnapshot,
      writeAdjustmentRowsSnapshot,
      writeProjectionValue,
      defaultRules,
      logger,
      ...hydrateOptions,
    });
  }

  return {
    buildBootstrapSnapshot,
    deleteValue,
    getJSONValue,
    getValue,
    hydrateSqliteSnapshots,
    readStorage,
    setJSONValue,
    upsertValue,
  };
}

function defaultNormalizeDeclRows(rows) {
  return {
    normalizedRows: Array.isArray(rows) ? rows : [],
  };
}

function safeParse(json, fallback) {
  if (json === null || json === undefined) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveWarn(logger) {
  if (logger && typeof logger.warn === 'function') {
    return logger.warn.bind(logger);
  }

  return () => {};
}
