import type Database from 'better-sqlite3';

import { coLineCount } from '../../../../packages/domain/src/co.js';
import {
  normalizeDateInput,
  normalizeDeclarationNumber,
  normalizeStatusKey,
} from '../../../../packages/domain/src/declSearch.js';
import {
  ACTIVE_BUSINESS_SNAPSHOT_KEY,
  BUSINESS_SNAPSHOT_STATE_TABLE,
  DECLARATION_SNAPSHOT_DOMAIN_KEY,
  DECLARATION_SNAPSHOT_ROW_TABLE,
} from '../../../../server/businessSnapshotSqlite.js';
import { ensureSqliteBusinessSnapshotTables } from '../../../../server/sqliteMigrations.js';
import { cloneDeclarationRecord, createDeclarationRowKey } from './declarationsStore.js';

export const SQLITE_DECLARATION_LIVE_ROW_TABLE = 'declaration_live_rows';
const DECLARATION_SNAPSHOT_SCHEMA_VERSION = 2;

const READ_LIVE_DECLARATION_ROWS_SQL =
  `SELECT payload FROM ${SQLITE_DECLARATION_LIVE_ROW_TABLE} ORDER BY sort_order ASC`;
const COUNT_LIVE_DECLARATION_ROWS_SQL =
  `SELECT COUNT(*) AS total FROM ${SQLITE_DECLARATION_LIVE_ROW_TABLE}`;
const DELETE_LIVE_DECLARATION_ROWS_SQL = `DELETE FROM ${SQLITE_DECLARATION_LIVE_ROW_TABLE}`;
const DELETE_DECLARATION_PROJECTION_ROWS_SQL =
  `DELETE FROM ${DECLARATION_SNAPSHOT_ROW_TABLE} WHERE snapshot_key = ?`;
const UPSERT_LIVE_DECLARATION_ROW_SQL =
  `INSERT INTO ${SQLITE_DECLARATION_LIVE_ROW_TABLE} (
     declaration_key,
     sort_order,
     so_tk,
     so_tk_full,
     branch,
     mst,
     registered_at,
     company,
     status,
     staff_name,
     team_name,
     deleted_at,
     co_count,
     duplicate_prefix,
     agency_search,
     payload,
     updated_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(declaration_key) DO UPDATE SET
     sort_order = excluded.sort_order,
     so_tk = excluded.so_tk,
     so_tk_full = excluded.so_tk_full,
     branch = excluded.branch,
     mst = excluded.mst,
     registered_at = excluded.registered_at,
     company = excluded.company,
     status = excluded.status,
     staff_name = excluded.staff_name,
     team_name = excluded.team_name,
     deleted_at = excluded.deleted_at,
     co_count = excluded.co_count,
     duplicate_prefix = excluded.duplicate_prefix,
     agency_search = excluded.agency_search,
     payload = excluded.payload,
     updated_at = excluded.updated_at`;
const UPDATE_DECLARATION_PROJECTION_ROW_SQL =
  `UPDATE ${DECLARATION_SNAPSHOT_ROW_TABLE}
   SET sort_order = ?,
       so_tk = ?,
        so_tk_full = ?,
        branch = ?,
        mst = ?,
       registered_at = ?,
       company = ?,
       status = ?,
       staff_name = ?,
       team_name = ?,
       deleted_at = ?,
       co_count = ?,
       duplicate_prefix = ?,
       agency_search = ?,
       payload = ?
   WHERE snapshot_key = ? AND declaration_key = ?`;
const INSERT_DECLARATION_PROJECTION_ROW_SQL =
  `INSERT INTO ${DECLARATION_SNAPSHOT_ROW_TABLE} (
     snapshot_key,
     sort_order,
     declaration_key,
     so_tk,
     so_tk_full,
     branch,
     mst,
     registered_at,
     company,
     status,
     staff_name,
     team_name,
     deleted_at,
     co_count,
     duplicate_prefix,
     agency_search,
     payload
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const UPSERT_DECLARATION_STATE_SQL =
  `INSERT INTO ${BUSINESS_SNAPSHOT_STATE_TABLE}
     (domain_key, snapshot_key, version, row_count, payload, updated_at)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(domain_key, snapshot_key) DO UPDATE SET
     version = excluded.version,
     row_count = excluded.row_count,
     payload = excluded.payload,
     updated_at = excluded.updated_at`;

type CanonicalRowEntry = {
  row: Record<string, unknown>;
  sortOrder: number;
};

type StatementRunResult = {
  changes?: number;
};

export function hasCanonicalSqliteDeclarationRows(database: Database): boolean {
  ensureSqliteBusinessSnapshotTables(database);
  const row = database.prepare(COUNT_LIVE_DECLARATION_ROWS_SQL).get() as { total?: unknown } | undefined;
  return Number(row?.total ?? 0) > 0;
}

export function readCanonicalSqliteDeclarationRows(database: Database): Record<string, unknown>[] {
  ensureSqliteBusinessSnapshotTables(database);
  const rows = database.prepare(READ_LIVE_DECLARATION_ROWS_SQL).all() as Array<{ payload?: unknown }>;
  return rows
    .map((row) => safeParseObject(row?.payload))
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => cloneDeclarationRecord(row));
}

export function replaceCanonicalSqliteDeclarationRows(
  database: Database,
  rows: readonly Record<string, unknown>[],
): void {
  ensureSqliteBusinessSnapshotTables(database);
  const normalizedEntries = normalizeCanonicalEntries(rows);
  const replaceRows =
    typeof database.transaction === 'function'
      ? database.transaction(() => {
          database.prepare(DELETE_LIVE_DECLARATION_ROWS_SQL).run();
          database.prepare(DELETE_DECLARATION_PROJECTION_ROWS_SQL).run(ACTIVE_BUSINESS_SNAPSHOT_KEY);
          upsertCanonicalEntries(database, normalizedEntries);
        })
      : () => {
          database.prepare(DELETE_LIVE_DECLARATION_ROWS_SQL).run();
          database.prepare(DELETE_DECLARATION_PROJECTION_ROWS_SQL).run(ACTIVE_BUSINESS_SNAPSHOT_KEY);
          upsertCanonicalEntries(database, normalizedEntries);
        };
  replaceRows();
}

export function upsertCanonicalSqliteDeclarationRows(
  database: Database,
  rows: readonly CanonicalRowEntry[],
): void {
  ensureSqliteBusinessSnapshotTables(database);
  const normalizedEntries = normalizeCanonicalEntries(rows);
  const upsertRows =
    typeof database.transaction === 'function'
      ? database.transaction(() => {
          upsertCanonicalEntries(database, normalizedEntries);
        })
      : () => {
          upsertCanonicalEntries(database, normalizedEntries);
        };
  upsertRows();
}

function upsertCanonicalEntries(database: Database, entries: readonly CanonicalRowEntry[]): void {
  const upsertLiveStatement = database.prepare(UPSERT_LIVE_DECLARATION_ROW_SQL);
  const updateProjectionStatement = database.prepare(UPDATE_DECLARATION_PROJECTION_ROW_SQL);
  const insertProjectionStatement = database.prepare(INSERT_DECLARATION_PROJECTION_ROW_SQL);
  let latestTimestamp = new Date().toISOString();

  for (const entry of entries) {
    const projection = buildProjection(entry.row);
    upsertLiveStatement.run(
      projection.declarationKey,
      entry.sortOrder,
      projection.soTk,
      projection.soTkFull,
      projection.branch,
      projection.mst,
      projection.registeredAt,
      projection.company,
      projection.status,
      projection.staffName,
      projection.teamName,
      projection.deletedAt,
      projection.coCount,
      projection.duplicatePrefix,
      projection.agencySearch,
      projection.payload,
      projection.updatedAt,
    );

    const updateResult = updateProjectionStatement.run(
      entry.sortOrder,
      projection.soTk,
      projection.soTkFull,
      projection.branch,
      projection.mst,
      projection.registeredAt,
      projection.company,
      projection.status,
      projection.staffName,
      projection.teamName,
      projection.deletedAt,
      projection.coCount,
      projection.duplicatePrefix,
      projection.agencySearch,
      projection.payload,
      ACTIVE_BUSINESS_SNAPSHOT_KEY,
      projection.declarationKey,
    ) as StatementRunResult;

    if (Number(updateResult.changes ?? 0) === 0) {
      insertProjectionStatement.run(
        ACTIVE_BUSINESS_SNAPSHOT_KEY,
        entry.sortOrder,
        projection.declarationKey,
        projection.soTk,
        projection.soTkFull,
        projection.branch,
        projection.mst,
        projection.registeredAt,
        projection.company,
        projection.status,
        projection.staffName,
        projection.teamName,
        projection.deletedAt,
        projection.coCount,
        projection.duplicatePrefix,
        projection.agencySearch,
        projection.payload,
      );
    }

    if (projection.updatedAt > latestTimestamp) {
      latestTimestamp = projection.updatedAt;
    }
  }

  const totalRow = database.prepare(COUNT_LIVE_DECLARATION_ROWS_SQL).get() as { total?: unknown } | undefined;
  database.prepare(UPSERT_DECLARATION_STATE_SQL).run(
    DECLARATION_SNAPSHOT_DOMAIN_KEY,
    ACTIVE_BUSINESS_SNAPSHOT_KEY,
    DECLARATION_SNAPSHOT_SCHEMA_VERSION,
    Number(totalRow?.total ?? 0),
    null,
    latestTimestamp,
  );
}

function normalizeCanonicalEntries(
  rows: readonly Record<string, unknown>[] | readonly CanonicalRowEntry[],
): CanonicalRowEntry[] {
  return rows
    .map((entry, index) => {
      if ('row' in entry && entry.row && typeof entry.row === 'object' && !Array.isArray(entry.row)) {
        return {
          row: cloneDeclarationRecord(entry.row as Record<string, unknown>),
          sortOrder: normalizeSortOrder(entry.sortOrder, index),
        };
      }
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        return {
          row: cloneDeclarationRecord(entry as Record<string, unknown>),
          sortOrder: index,
        };
      }
      return null;
    })
    .filter((entry): entry is CanonicalRowEntry => entry !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function buildProjection(row: Record<string, unknown>) {
  const declarationKey =
    createDeclarationRowKey(row.so_tk, row.nhanh ?? row.branch ?? row.branch_code) ||
    normalizeText(row.key ?? row.id ?? row.so_tk_full ?? row.declaration_no_raw ?? row.so_tk ?? row.declaration_no);
  const company = normalizeSearchText(
    row.cong_ty ?? row.company ?? row.company_name ?? row.ten_cong_ty ?? row.doanh_nghiep,
  );
  const status = normalizeStatusKey(
    row.status ?? row.trang_thai ?? row.previewStatus ?? row.importStatus ?? row.state,
  );
  const staffName = normalizeSearchText(row.nhan_vien ?? row.staff ?? row.staff_name_snapshot);
  const teamName = normalizeSearchText(row.team ?? row.to_doi ?? row.bo_phan ?? row.team_name_snapshot);
  const duplicatePrefix = normalizeDeclarationNumber(
    row.so_tk_full ?? row.declaration_no_raw ?? row.so_tk ?? row.declaration_no ?? '',
    11,
  );
  const payloadRow = cloneDeclarationRecord(row);

  return {
    declarationKey,
    soTk: normalizeText(row.so_tk ?? row.declaration_no),
    soTkFull: normalizeText(row.so_tk_full ?? row.declaration_no_raw ?? row.so_tk ?? row.declaration_no),
    branch: normalizeText(row.nhanh ?? row.branch ?? row.branch_code),
    mst: normalizeText(row.mst ?? row.tax_code ?? row.ma_so_thue),
    registeredAt: normalizeDateInput(row.date ?? row.declared_at ?? row.raw_date ?? row.registered_at),
    company,
    status,
    staffName,
    teamName,
    deletedAt: normalizeText(row.deleted_at),
    coCount: normalizeInteger(coLineCount(payloadRow)),
    duplicatePrefix,
    agencySearch: normalizeSearchText(buildAgencySearchString(payloadRow)),
    payload: JSON.stringify(payloadRow),
    updatedAt: normalizeTimestamp(payloadRow.updatedAt ?? payloadRow.updated_at),
  };
}

function buildAgencySearchString(row: Record<string, unknown>): string {
  const values = [
    row.agency,
    row.agency_text,
    row.dai_ly,
    row.agencyName,
    row.agency_code,
    row.agencyCode,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);
  return values.join(' ');
}

function safeParseObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value).replace(/\s+/gu, ' ').trim().toLowerCase();
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : `${value ?? ''}`.trim();
}

function normalizeInteger(value: unknown): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? Math.trunc(normalized) : 0;
}

function normalizeTimestamp(value: unknown): string {
  const normalized = normalizeText(value);
  return normalized || new Date().toISOString();
}

function normalizeSortOrder(value: unknown, fallback: number): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? Math.trunc(normalized) : fallback;
}
