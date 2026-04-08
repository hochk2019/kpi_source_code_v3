import {
  ACTIVE_BUSINESS_SNAPSHOT_KEY,
  DECLARATION_SNAPSHOT_ROW_TABLE,
  DECLARATION_SNAPSHOT_SCHEMA_VERSION,
  readDeclarationRowsSnapshotState,
} from './businessSnapshotSqlite.js';
import { normalizeDeclSearchFilters } from '../../../domain/src/declSearch.js';

export function searchDeclarationSnapshot(
  database,
  rawFilters = {},
  {
    snapshotKey = ACTIVE_BUSINESS_SNAPSHOT_KEY,
    page = 1,
    pageSize = 50,
  } = {},
) {
  if (!database || typeof database.prepare !== 'function') {
    return null;
  }

  const snapshotState = readDeclarationRowsSnapshotState(database, snapshotKey);
  if (!snapshotState || Number(snapshotState.version ?? 0) < DECLARATION_SNAPSHOT_SCHEMA_VERSION) {
    return null;
  }

  const filters = normalizeDeclSearchFilters(rawFilters);
  const where = ['snapshot_key = ?'];
  const params = [snapshotKey];

  if (!filters.includeDeleted) {
    where.push("(deleted_at = '' OR deleted_at IS NULL)");
  }

  if (filters.query) {
    const needle = createContainsNeedle(filters.query.toLowerCase());
    where.push(
      '(' +
        [
          "so_tk LIKE ? ESCAPE '\\'",
          "so_tk_full LIKE ? ESCAPE '\\'",
          "mst LIKE ? ESCAPE '\\'",
          "company LIKE ? ESCAPE '\\'",
          "staff_name LIKE ? ESCAPE '\\'",
          "team_name LIKE ? ESCAPE '\\'",
          "agency_search LIKE ? ESCAPE '\\'",
        ].join(' OR ') +
        ')',
    );
    params.push(needle, needle, needle, needle, needle, needle, needle);
  }

  if (filters.mst) {
    where.push("mst LIKE ? ESCAPE '\\'");
    params.push(createContainsNeedle(filters.mst));
  }

  if (filters.company) {
    where.push("company LIKE ? ESCAPE '\\'");
    params.push(createContainsNeedle(filters.company.toLowerCase()));
  }

  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    where.push(`status IN (${filters.statuses.map(() => '?').join(', ')})`);
    params.push(...filters.statuses);
  }

  if (filters.range?.from) {
    where.push('registered_at >= ?');
    params.push(filters.range.from);
  }

  if (filters.range?.to) {
    where.push('registered_at <= ?');
    params.push(filters.range.to);
  }

  if (filters.noStaff) {
    where.push("(staff_name = '' OR staff_name IS NULL)");
  }

  if (filters.noTeam) {
    where.push("(team_name = '' OR team_name IS NULL)");
  }

  if (filters.coMode === 'has') {
    where.push('co_count > 0');
  } else if (filters.coMode === 'min') {
    where.push('co_count >= ?');
    params.push(Math.max(0, Number(filters.coMin) || 0));
  }

  if (filters.duplicate) {
    where.push(
      `duplicate_prefix <> '' AND duplicate_prefix IN (
        SELECT duplicate_prefix
        FROM ${DECLARATION_SNAPSHOT_ROW_TABLE}
        WHERE snapshot_key = ? AND duplicate_prefix <> ''
        GROUP BY duplicate_prefix
        HAVING COUNT(*) > 1
      )`,
    );
    params.push(snapshotKey);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const totalRow = database
    .prepare(
      `SELECT COUNT(*) AS total
       FROM ${DECLARATION_SNAPSHOT_ROW_TABLE}
       ${whereClause}`,
    )
    .get(...params);
  const total = Number(totalRow?.total ?? 0);
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 1));
  const maxPage = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), maxPage);
  const offset = (safePage - 1) * safePageSize;

  const rows = database
    .prepare(
      `SELECT payload
       FROM ${DECLARATION_SNAPSHOT_ROW_TABLE}
       ${whereClause}
       ORDER BY sort_order ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, safePageSize, offset)
    .map((row) => safeParse(row?.payload, null))
    .filter((row) => row && typeof row === 'object');

  return {
    total,
    page: safePage,
    pageSize: safePageSize,
    rows,
  };
}

function createContainsNeedle(value) {
  return `%${escapeLike(String(value ?? '').trim())}%`;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function safeParse(value, fallback) {
  if (typeof value !== 'string' || !value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
