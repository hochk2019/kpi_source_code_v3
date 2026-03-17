import { coLineCount } from '../packages/domain/src/co.js';
import {
  normalizeDateInput,
  normalizeDeclarationNumber,
  normalizeStatusKey,
} from '../packages/domain/src/declSearch.js';

export const BUSINESS_SNAPSHOT_STATE_TABLE = 'business_snapshot_state';
export const DECLARATION_SNAPSHOT_ROW_TABLE = 'declaration_snapshot_rows';
export const MST_ASSIGNMENT_SNAPSHOT_ROW_TABLE = 'mst_assignment_snapshot_rows';
export const ADJUSTMENT_SNAPSHOT_ROW_TABLE = 'adjustment_snapshot_rows';
export const ACTIVE_BUSINESS_SNAPSHOT_KEY = 'active';

export const DECLARATION_SNAPSHOT_DOMAIN_KEY = 'decl_rows_v1';
export const MST_ASSIGNMENT_SNAPSHOT_DOMAIN_KEY = 'mst_rows_v2';
export const RULE_COLLECTION_SNAPSHOT_DOMAIN_KEY = 'kpi_rules_v2';
export const ADJUSTMENT_SNAPSHOT_DOMAIN_KEY = 'kpi_adjustments_v1';
export const DECLARATION_SNAPSHOT_SCHEMA_VERSION = 2;

const DECLARATION_ROW_DEFINITION = {
  domainKey: DECLARATION_SNAPSHOT_DOMAIN_KEY,
  tableName: DECLARATION_SNAPSHOT_ROW_TABLE,
  version: DECLARATION_SNAPSHOT_SCHEMA_VERSION,
  columns: [
    'declaration_key',
    'so_tk',
    'so_tk_full',
    'branch',
    'mst',
    'registered_at',
    'company',
    'status',
    'staff_name',
    'team_name',
    'deleted_at',
    'co_count',
    'duplicate_prefix',
    'agency_search',
  ],
  projectRow(row) {
    const company = normalizeSearchText(
      row.cong_ty || row.company || row.ten_cong_ty || row.doanh_nghiep
    );
    const status = normalizeStatusKey(
      row.status || row.trang_thai || row.previewStatus || row.importStatus || row.state
    );
    const staffName = normalizeSearchText(row.nhan_vien || row.staff);
    const teamName = normalizeSearchText(row.team || row.to_doi || row.bo_phan);
    const duplicatePrefix = normalizeDeclarationNumber(row.so_tk_full ?? row.so_tk ?? '', 11);
    const agencySearch = normalizeSearchText(buildAgencySearchString(row));

    return [
      normalizeText(row.key || row.id || row.so_tk_full || row.so_tk),
      normalizeText(row.so_tk),
      normalizeText(row.so_tk_full),
      normalizeText(row.nhanh || row.branch),
      normalizeText(row.mst || row.ma_so_thue),
      normalizeDateInput(row.date || row.raw_date || row.registered_at),
      company,
      status,
      staffName,
      teamName,
      normalizeText(row.deleted_at),
      normalizeInteger(coLineCount(row)),
      duplicatePrefix,
      agencySearch,
    ];
  },
};

const MST_ASSIGNMENT_ROW_DEFINITION = {
  domainKey: MST_ASSIGNMENT_SNAPSHOT_DOMAIN_KEY,
  tableName: MST_ASSIGNMENT_SNAPSHOT_ROW_TABLE,
  columns: ['mst', 'company', 'person_import', 'person_export', 'team', 'effective_from', 'effective_to'],
  projectRow(row) {
    return [
      normalizeText(row.mst),
      normalizeText(row.company),
      normalizeText(row.person_import),
      normalizeText(row.person_export),
      normalizeText(row.team),
      normalizeText(row.effective_from),
      normalizeText(row.effective_to),
    ];
  },
};

const ADJUSTMENT_ROW_DEFINITION = {
  domainKey: ADJUSTMENT_SNAPSHOT_DOMAIN_KEY,
  tableName: ADJUSTMENT_SNAPSHOT_ROW_TABLE,
  columns: ['adjustment_id', 'month', 'category', 'staff_name', 'team_name', 'status', 'total_points'],
  projectRow(row) {
    return [
      normalizeText(row.id),
      normalizeText(row.month),
      normalizeText(row.category),
      normalizeText(row.staffName || row.staff_name || row.nhan_vien),
      normalizeText(row.teamName || row.team_name || row.team),
      normalizeText(row.status),
      normalizeNumber(row.totalPoints ?? row.total_points),
    ];
  },
};

export function ensureBusinessSnapshotTables(database) {
  if (!database || typeof database.exec !== 'function') {
    return;
  }

  database.exec(
    'CREATE TABLE IF NOT EXISTS business_snapshot_state (\n' +
      '  domain_key TEXT NOT NULL,\n' +
      '  snapshot_key TEXT NOT NULL,\n' +
      '  version INTEGER NOT NULL DEFAULT 1,\n' +
      '  row_count INTEGER NOT NULL DEFAULT 0,\n' +
      '  payload TEXT,\n' +
      '  updated_at TEXT NOT NULL,\n' +
      '  PRIMARY KEY(domain_key, snapshot_key)\n' +
      ')'
  );
  database.exec(
    'CREATE TABLE IF NOT EXISTS declaration_snapshot_rows (\n' +
      '  snapshot_key TEXT NOT NULL,\n' +
      '  sort_order INTEGER NOT NULL,\n' +
      '  declaration_key TEXT NOT NULL DEFAULT \'\',\n' +
      '  so_tk TEXT NOT NULL DEFAULT \'\',\n' +
        '  so_tk_full TEXT NOT NULL DEFAULT \'\',\n' +
        '  branch TEXT NOT NULL DEFAULT \'\',\n' +
        '  mst TEXT NOT NULL DEFAULT \'\',\n' +
        '  registered_at TEXT NOT NULL DEFAULT \'\',\n' +
        '  company TEXT NOT NULL DEFAULT \'\',\n' +
        '  status TEXT NOT NULL DEFAULT \'\',\n' +
        '  staff_name TEXT NOT NULL DEFAULT \'\',\n' +
        '  team_name TEXT NOT NULL DEFAULT \'\',\n' +
        '  deleted_at TEXT NOT NULL DEFAULT \'\',\n' +
        '  co_count INTEGER NOT NULL DEFAULT 0,\n' +
        '  duplicate_prefix TEXT NOT NULL DEFAULT \'\',\n' +
        '  agency_search TEXT NOT NULL DEFAULT \'\',\n' +
        '  payload TEXT NOT NULL,\n' +
        '  PRIMARY KEY(snapshot_key, sort_order)\n' +
        ')'
  );
  ensureTableColumn(database, DECLARATION_SNAPSHOT_ROW_TABLE, 'company', "TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(database, DECLARATION_SNAPSHOT_ROW_TABLE, 'status', "TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(database, DECLARATION_SNAPSHOT_ROW_TABLE, 'staff_name', "TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(database, DECLARATION_SNAPSHOT_ROW_TABLE, 'team_name', "TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(database, DECLARATION_SNAPSHOT_ROW_TABLE, 'deleted_at', "TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(database, DECLARATION_SNAPSHOT_ROW_TABLE, 'co_count', 'INTEGER NOT NULL DEFAULT 0');
  ensureTableColumn(database, DECLARATION_SNAPSHOT_ROW_TABLE, 'duplicate_prefix', "TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(database, DECLARATION_SNAPSHOT_ROW_TABLE, 'agency_search', "TEXT NOT NULL DEFAULT ''");
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_declaration_snapshot_rows_snapshot_key_sort_order ON declaration_snapshot_rows(snapshot_key, sort_order)'
  );
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_declaration_snapshot_rows_snapshot_key_status ON declaration_snapshot_rows(snapshot_key, status)'
  );
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_declaration_snapshot_rows_snapshot_key_mst ON declaration_snapshot_rows(snapshot_key, mst)'
  );
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_declaration_snapshot_rows_snapshot_key_registered_at ON declaration_snapshot_rows(snapshot_key, registered_at)'
  );
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_declaration_snapshot_rows_snapshot_key_duplicate_prefix ON declaration_snapshot_rows(snapshot_key, duplicate_prefix)'
  );
  database.exec(
    'CREATE TABLE IF NOT EXISTS mst_assignment_snapshot_rows (\n' +
      '  snapshot_key TEXT NOT NULL,\n' +
      '  sort_order INTEGER NOT NULL,\n' +
      '  mst TEXT NOT NULL DEFAULT \'\',\n' +
      '  company TEXT NOT NULL DEFAULT \'\',\n' +
      '  person_import TEXT NOT NULL DEFAULT \'\',\n' +
      '  person_export TEXT NOT NULL DEFAULT \'\',\n' +
      '  team TEXT NOT NULL DEFAULT \'\',\n' +
      '  effective_from TEXT NOT NULL DEFAULT \'\',\n' +
      '  effective_to TEXT NOT NULL DEFAULT \'\',\n' +
      '  payload TEXT NOT NULL,\n' +
      '  PRIMARY KEY(snapshot_key, sort_order)\n' +
      ')'
  );
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_mst_assignment_snapshot_rows_snapshot_key_sort_order ON mst_assignment_snapshot_rows(snapshot_key, sort_order)'
  );
  database.exec(
    'CREATE TABLE IF NOT EXISTS adjustment_snapshot_rows (\n' +
      '  snapshot_key TEXT NOT NULL,\n' +
      '  sort_order INTEGER NOT NULL,\n' +
      '  adjustment_id TEXT NOT NULL DEFAULT \'\',\n' +
      '  month TEXT NOT NULL DEFAULT \'\',\n' +
      '  category TEXT NOT NULL DEFAULT \'\',\n' +
      '  staff_name TEXT NOT NULL DEFAULT \'\',\n' +
      '  team_name TEXT NOT NULL DEFAULT \'\',\n' +
      '  status TEXT NOT NULL DEFAULT \'\',\n' +
      '  total_points REAL NOT NULL DEFAULT 0,\n' +
      '  payload TEXT NOT NULL,\n' +
      '  PRIMARY KEY(snapshot_key, sort_order)\n' +
      ')'
  );
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_adjustment_snapshot_rows_snapshot_key_sort_order ON adjustment_snapshot_rows(snapshot_key, sort_order)'
  );
}

export function readDeclarationRowsSnapshot(
  database,
  snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY
) {
  return readJsonRowSnapshot(database, DECLARATION_ROW_DEFINITION, snapshotKey);
}

export function readDeclarationRowsSnapshotState(
  database,
  snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY
) {
  if (!database || typeof database.prepare !== 'function') {
    return null;
  }

  try {
    return readStateRow(database, DECLARATION_SNAPSHOT_DOMAIN_KEY, snapshotKey) || null;
  } catch {
    return null;
  }
}

export function writeDeclarationRowsSnapshot(
  database,
  rows,
  options = {}
) {
  writeJsonRowSnapshot(database, DECLARATION_ROW_DEFINITION, rows, options);
}

export function deleteDeclarationRowsSnapshot(
  database,
  snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY
) {
  deleteJsonRowSnapshot(database, DECLARATION_ROW_DEFINITION, snapshotKey);
}

export function readMstAssignmentRowsSnapshot(
  database,
  snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY
) {
  return readJsonRowSnapshot(database, MST_ASSIGNMENT_ROW_DEFINITION, snapshotKey);
}

export function writeMstAssignmentRowsSnapshot(
  database,
  rows,
  options = {}
) {
  writeJsonRowSnapshot(database, MST_ASSIGNMENT_ROW_DEFINITION, rows, options);
}

export function deleteMstAssignmentRowsSnapshot(
  database,
  snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY
) {
  deleteJsonRowSnapshot(database, MST_ASSIGNMENT_ROW_DEFINITION, snapshotKey);
}

export function readRuleCollectionSnapshot(
  database,
  snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY
) {
  if (!database || typeof database.prepare !== 'function') {
    return null;
  }

  try {
    const state = readStateRow(database, RULE_COLLECTION_SNAPSHOT_DOMAIN_KEY, snapshotKey);
    if (!state || typeof state.payload !== 'string' || !state.payload) {
      return null;
    }

    const payload = safeParse(state.payload, null);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

export function writeRuleCollectionSnapshot(
  database,
  collection,
  { snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY, updatedAt } = {}
) {
  if (!database || typeof database.prepare !== 'function') {
    return;
  }

  ensureBusinessSnapshotTables(database);

  const normalized = normalizeRuleCollection(collection);
  const timestamp = normalizeTimestamp(updatedAt);
  const replaceSnapshot =
    typeof database.transaction === 'function'
      ? database.transaction(() => {
          upsertStateRow(database, RULE_COLLECTION_SNAPSHOT_DOMAIN_KEY, snapshotKey, {
            version: resolveSnapshotVersion(normalized, 2),
            rowCount: Array.isArray(normalized.sets) ? normalized.sets.length : 0,
            payload: JSON.stringify(normalized),
            updatedAt: timestamp,
          });
        })
      : () =>
          upsertStateRow(database, RULE_COLLECTION_SNAPSHOT_DOMAIN_KEY, snapshotKey, {
            version: resolveSnapshotVersion(normalized, 2),
            rowCount: Array.isArray(normalized.sets) ? normalized.sets.length : 0,
            payload: JSON.stringify(normalized),
            updatedAt: timestamp,
          });

  replaceSnapshot();
}

export function deleteRuleCollectionSnapshot(
  database,
  snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY
) {
  if (!database || typeof database.prepare !== 'function') {
    return;
  }

  ensureBusinessSnapshotTables(database);
  database
    .prepare(
      `DELETE FROM ${BUSINESS_SNAPSHOT_STATE_TABLE} WHERE domain_key = ? AND snapshot_key = ?`
    )
    .run(RULE_COLLECTION_SNAPSHOT_DOMAIN_KEY, snapshotKey);
}

export function readAdjustmentRowsSnapshot(
  database,
  snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY
) {
  return readJsonRowSnapshot(database, ADJUSTMENT_ROW_DEFINITION, snapshotKey);
}

export function writeAdjustmentRowsSnapshot(
  database,
  rows,
  options = {}
) {
  writeJsonRowSnapshot(database, ADJUSTMENT_ROW_DEFINITION, rows, options);
}

export function deleteAdjustmentRowsSnapshot(
  database,
  snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY
) {
  deleteJsonRowSnapshot(database, ADJUSTMENT_ROW_DEFINITION, snapshotKey);
}

function readJsonRowSnapshot(database, definition, snapshotKey) {
  if (!database || typeof database.prepare !== 'function') {
    return null;
  }

  try {
    const state = readStateRow(database, definition.domainKey, snapshotKey);
    if (!state) {
      return null;
    }

    const rows = database
      .prepare(
        `SELECT payload FROM ${definition.tableName} WHERE snapshot_key = ? ORDER BY sort_order ASC`
      )
      .all(snapshotKey);

    return rows
      .map((row) => safeParse(row?.payload, null))
      .filter((row) => row && typeof row === 'object');
  } catch {
    return null;
  }
}

function writeJsonRowSnapshot(database, definition, rows, { snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY, updatedAt } = {}) {
  if (!database || typeof database.prepare !== 'function') {
    return;
  }

  ensureBusinessSnapshotTables(database);

  const normalizedRows = normalizeSnapshotRows(rows);
  const timestamp = normalizeTimestamp(updatedAt);
  const replaceSnapshot =
    typeof database.transaction === 'function'
      ? database.transaction(() => {
          replaceJsonRows(database, definition, snapshotKey, normalizedRows, timestamp);
        })
      : () => replaceJsonRows(database, definition, snapshotKey, normalizedRows, timestamp);

  replaceSnapshot();
}

function deleteJsonRowSnapshot(database, definition, snapshotKey) {
  if (!database || typeof database.prepare !== 'function') {
    return;
  }

  ensureBusinessSnapshotTables(database);
  database.prepare(`DELETE FROM ${definition.tableName} WHERE snapshot_key = ?`).run(snapshotKey);
  database
    .prepare(
      `DELETE FROM ${BUSINESS_SNAPSHOT_STATE_TABLE} WHERE domain_key = ? AND snapshot_key = ?`
    )
    .run(definition.domainKey, snapshotKey);
}

function replaceJsonRows(database, definition, snapshotKey, rows, updatedAt) {
  deleteJsonRowSnapshot(database, definition, snapshotKey);

  const insertStatement = database.prepare(
    `INSERT INTO ${definition.tableName}
      (snapshot_key, sort_order, ${definition.columns.join(', ')}, payload)
      VALUES (?, ?, ${definition.columns.map(() => '?').join(', ')}, ?)`
  );

  rows.forEach((row, index) => {
    insertStatement.run(
      snapshotKey,
      index,
      ...definition.projectRow(row, index),
      JSON.stringify(row)
    );
  });

  upsertStateRow(database, definition.domainKey, snapshotKey, {
    version: resolveSnapshotVersion(definition.version, 1),
    rowCount: rows.length,
    payload: null,
    updatedAt,
  });
}

function readStateRow(database, domainKey, snapshotKey) {
  return database
    .prepare(
      `SELECT version, row_count, payload, updated_at
       FROM ${BUSINESS_SNAPSHOT_STATE_TABLE}
       WHERE domain_key = ? AND snapshot_key = ?`
    )
    .get(domainKey, snapshotKey);
}

function upsertStateRow(database, domainKey, snapshotKey, { version, rowCount, payload, updatedAt }) {
  database
    .prepare(
      `INSERT INTO ${BUSINESS_SNAPSHOT_STATE_TABLE}
        (domain_key, snapshot_key, version, row_count, payload, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(domain_key, snapshot_key) DO UPDATE SET
          version = excluded.version,
          row_count = excluded.row_count,
          payload = excluded.payload,
          updated_at = excluded.updated_at`
    )
    .run(
      domainKey,
      snapshotKey,
      resolveSnapshotVersion(version, 1),
      normalizeInteger(rowCount),
      payload,
      normalizeTimestamp(updatedAt)
    );
}

function normalizeSnapshotRows(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((row) => cloneJson(row))
    .filter((row) => row && typeof row === 'object');
}

function normalizeRuleCollection(input) {
  const normalized = cloneJson(input);
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    return { version: 2, activeId: '', sets: [] };
  }

  const version = resolveSnapshotVersion(normalized, 2);
  const activeId = normalizeText(normalized.activeId || normalized.active || normalized.id);
  const sets = Array.isArray(normalized.sets)
    ? normalized.sets
        .map((entry) => cloneJson(entry))
        .filter((entry) => entry && typeof entry === 'object')
    : [];

  if (!Array.isArray(normalized.sets) && looksLikeRuleSet(normalized)) {
    sets.push(normalized);
  }

  return {
    ...normalized,
    version,
    activeId,
    sets,
  };
}

function looksLikeRuleSet(input) {
  return Boolean(input && typeof input === 'object' && ('groups' in input || 'license' in input || 'bonuses' in input));
}

function cloneJson(value) {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function safeParse(input, fallback) {
  if (typeof input !== 'string' || !input) {
    return fallback;
  }

  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

function resolveSnapshotVersion(input, fallback) {
  return normalizeInteger(input, fallback);
}

function normalizeInteger(input, fallback = 0) {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.trunc(value);
}

function normalizeNumber(input) {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

function normalizeSearchText(input) {
  return normalizeText(input).replace(/\s+/gu, ' ').trim().toLowerCase();
}

function normalizeText(input) {
  if (typeof input === 'string') {
    return input.trim();
  }
  if (input === null || input === undefined) {
    return '';
  }

  return String(input).trim();
}

function normalizeTimestamp(input) {
  if (typeof input === 'string' && input.trim()) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function buildAgencySearchString(row) {
  if (!row || typeof row !== 'object') {
    return '';
  }

  const parts = [];
  if (row.agency) {
    parts.push(row.agency);
  }
  if (row.dai_ly) {
    parts.push(row.dai_ly);
  }
  if (Array.isArray(row.agents)) {
    for (const agent of row.agents) {
      if (agent) {
        parts.push(agent);
      }
    }
  }

  return parts.join(' ');
}

function ensureTableColumn(database, tableName, columnName, columnDefinition) {
  if (hasTableColumn(database, tableName, columnName)) {
    return;
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}

function hasTableColumn(database, tableName, columnName) {
  if (!database || typeof database.prepare !== 'function') {
    return false;
  }

  try {
    const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some((column) => normalizeText(column?.name) === columnName);
  } catch {
    return false;
  }
}
