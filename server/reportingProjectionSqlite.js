export const REPORTING_PROJECTION_TABLE = 'reporting_projections';
export const REPORTING_SCHEDULE_ENTRY_TABLE = 'reporting_schedule_projection_entries';
export const REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE =
  'reporting_monthly_aggregate_projection_entries';
export const REPORTING_JOB_RUN_ENTRY_TABLE = 'reporting_job_run_entries';
import { ensureSqliteReportingProjectionTables } from './sqliteMigrations.js';

const PROJECTION_TYPE_BY_KEY = {
  kpi_report_schedule_v1: 'report_schedule',
  kpi_reporting_monthly_aggregates_v1: 'monthly_aggregate',
  kpi_reporting_monthly_aggregates_default_v1: 'default_monthly_aggregate',
  kpi_reporting_job_runs_v1: 'job_runs',
};

export function ensureReportingProjectionTable(database) {
  ensureSqliteReportingProjectionTables(database);
}

export function readReportingProjectionValue(database, key) {
  if (!database || typeof database.prepare !== 'function') {
    return null;
  }

  try {
    ensureReportingProjectionTable(database);
    const row = database
      .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
      .get(key);
    if (!row?.payload) {
      return null;
    }

    return safeParse(row.payload, null);
  } catch {
    return null;
  }
}

export function readReportingMonthlyAggregateProjectionEntries(database, key) {
  return readMaterializedProjectionEntries(
    database,
    REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE,
    'period DESC',
    key
  );
}

export function readReportingScheduleProjectionEntries(database, key) {
  return readMaterializedProjectionEntries(
    database,
    REPORTING_SCHEDULE_ENTRY_TABLE,
    'position ASC, schedule_id ASC',
    key
  );
}

export function readReportingJobRunProjectionEntries(database, key) {
  return readMaterializedProjectionEntries(
    database,
    REPORTING_JOB_RUN_ENTRY_TABLE,
    'finished_at DESC, run_id DESC',
    key
  );
}

export function writeReportingProjectionValue(database, key, value, options = {}) {
  if (!database || typeof database.prepare !== 'function') {
    return;
  }

  try {
    ensureReportingProjectionTable(database);
    const metadata = buildProjectionMetadata(key, value);
    database
      .prepare(
        'INSERT INTO reporting_projections ' +
          '(projection_key, projection_type, scope_key, range_from, range_to, query_key, entry_count, payload, updated_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(projection_key) DO UPDATE SET ' +
          'projection_type = excluded.projection_type, ' +
          'scope_key = excluded.scope_key, ' +
          'range_from = excluded.range_from, ' +
          'range_to = excluded.range_to, ' +
          'query_key = excluded.query_key, ' +
          'entry_count = excluded.entry_count, ' +
          'payload = excluded.payload, ' +
          'updated_at = excluded.updated_at'
      )
      .run(
        key,
        resolveProjectionType(key),
        metadata.scopeKey,
        metadata.rangeFrom,
        metadata.rangeTo,
        metadata.queryKey,
        metadata.entryCount,
        JSON.stringify(value ?? null),
        normalizeTimestamp(options.updatedAt)
      );
    syncMaterializedProjectionEntries(database, key, value);
  } catch {
    // Projection persistence should not break route responses.
  }
}

export function deleteReportingProjectionValue(database, key) {
  if (!database || typeof database.prepare !== 'function') {
    return;
  }

  try {
    ensureReportingProjectionTable(database);
    database.prepare('DELETE FROM reporting_projections WHERE projection_key = ?').run(key);
    clearMaterializedProjectionEntries(database, key);
  } catch {
    // Projection cleanup should not break route responses.
  }
}

function resolveProjectionType(key) {
  return PROJECTION_TYPE_BY_KEY[String(key || '').trim()] || 'reporting_projection';
}

function buildProjectionMetadata(key, value) {
  const normalizedKey = String(key || '').trim();
  const record = isRecord(value) ? value : null;
  const items = Array.isArray(value)
    ? value
    : Array.isArray(record?.items)
    ? record.items
    : [];

  return {
    scopeKey: resolveScopeKey(normalizedKey),
    rangeFrom: normalizeText(record?.range?.from),
    rangeTo: normalizeText(record?.range?.to),
    queryKey: normalizeText(record?.cache?.queryKey),
    entryCount: countProjectionEntries(value, items, record),
  };
}

function readMaterializedProjectionEntries(database, tableName, orderBy, key) {
  if (!database || typeof database.prepare !== 'function') {
    return [];
  }

  try {
    ensureReportingProjectionTable(database);
    const rows = database
      .prepare(`SELECT payload FROM ${tableName} WHERE projection_key = ? ORDER BY ${orderBy}`)
      .all(key);

    return Array.isArray(rows)
      ? rows
          .map((row) => safeParse(row?.payload, null))
          .filter((entry) => entry !== null && entry !== undefined)
      : [];
  } catch {
    return [];
  }
}

function resolveScopeKey(key) {
  if (key === 'kpi_report_schedule_v1') {
    return 'global';
  }
  if (key === 'kpi_reporting_monthly_aggregates_default_v1') {
    return 'default';
  }
  if (key === 'kpi_reporting_monthly_aggregates_v1') {
    return 'active';
  }
  return '';
}

function countProjectionEntries(value, items, record) {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (items.length) {
    return items.length;
  }
  return toPositiveInt(record?.total, 0);
}

function syncMaterializedProjectionEntries(database, key, value) {
  const normalizedKey = String(key || '').trim();
  clearMaterializedProjectionEntries(database, normalizedKey);

  if (normalizedKey === 'kpi_report_schedule_v1') {
    materializeScheduleProjectionEntries(database, normalizedKey, value);
    return;
  }

  if (
    normalizedKey === 'kpi_reporting_monthly_aggregates_v1' ||
    normalizedKey === 'kpi_reporting_monthly_aggregates_default_v1'
  ) {
    materializeMonthlyAggregateProjectionEntries(database, normalizedKey, value);
    return;
  }

  if (normalizedKey === 'kpi_reporting_job_runs_v1') {
    materializeJobRunProjectionEntries(database, normalizedKey, value);
  }
}

function clearMaterializedProjectionEntries(database, key) {
  database
    .prepare(`DELETE FROM ${REPORTING_SCHEDULE_ENTRY_TABLE} WHERE projection_key = ?`)
    .run(key);
  database
    .prepare(`DELETE FROM ${REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE} WHERE projection_key = ?`)
    .run(key);
  database
    .prepare(`DELETE FROM ${REPORTING_JOB_RUN_ENTRY_TABLE} WHERE projection_key = ?`)
    .run(key);
}

function materializeScheduleProjectionEntries(database, key, value) {
  const schedules = Array.isArray(value) ? value.filter(isRecord) : [];
  if (!schedules.length) {
    return;
  }

  const statement = database.prepare(
    `INSERT INTO ${REPORTING_SCHEDULE_ENTRY_TABLE} ` +
      '(projection_key, position, schedule_id, name, frequency, time, day_of_week, day_of_month, active, last_run, next_run, recipient_count, format_count, payload) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  schedules.forEach((entry, index) => {
    statement.run(
      key,
      index,
      normalizeText(entry.id) || `schedule-${index + 1}`,
      normalizeText(entry.name),
      normalizeText(entry.frequency),
      normalizeText(entry.time),
      toNonNegativeInt(entry.dayOfWeek, 0),
      toNonNegativeInt(entry.dayOfMonth, 0),
      toBooleanInt(entry.active),
      normalizeText(entry.lastRun),
      normalizeText(entry.nextRun),
      normalizeStringList(entry.recipients).length,
      normalizeStringList(entry.formats).length,
      JSON.stringify(entry)
    );
  });
}

function materializeMonthlyAggregateProjectionEntries(database, key, value) {
  const snapshot = isRecord(value) ? value : null;
  const items = Array.isArray(snapshot?.items) ? snapshot.items.filter(isRecord) : [];
  if (!items.length) {
    return;
  }

  const statement = database.prepare(
    `INSERT INTO ${REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE} ` +
      '(projection_key, period, label, range_from, range_to, decls, import_count, export_count, item_count, license_count, kpi, co_count, co_line_count, company_count, top_team_count, top_staff_count, payload) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  items.forEach((entry, index) => {
    const summary = isRecord(entry.summary) ? entry.summary : {};
    statement.run(
      key,
      normalizeText(entry.period) || `period-${index + 1}`,
      normalizeText(entry.label),
      normalizeText(entry?.range?.from),
      normalizeText(entry?.range?.to),
      toNonNegativeInt(summary.decls, 0),
      toNonNegativeInt(summary.import, 0),
      toNonNegativeInt(summary.export, 0),
      toNonNegativeInt(summary.items, 0),
      toNonNegativeInt(summary.licenses, 0),
      toFiniteNumber(summary.kpi, 0),
      toNonNegativeInt(summary.co, 0),
      toNonNegativeInt(summary.coLines, 0),
      toNonNegativeInt(summary.companyCount, 0),
      Array.isArray(entry.topTeams) ? entry.topTeams.length : 0,
      Array.isArray(entry.topStaff) ? entry.topStaff.length : 0,
      JSON.stringify(entry)
    );
  });
}

function materializeJobRunProjectionEntries(database, key, value) {
  const runs = Array.isArray(value) ? value.filter(isRecord) : [];
  if (!runs.length) {
    return;
  }

  const statement = database.prepare(
    `INSERT INTO ${REPORTING_JOB_RUN_ENTRY_TABLE} ` +
      '(projection_key, run_id, job_name, status, source, actor, snapshot_key, query_key, range_from, range_to, total, started_at, finished_at, duration_ms, error_message, payload) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  runs.forEach((entry, index) => {
    statement.run(
      key,
      normalizeText(entry.id) || `run-${index + 1}`,
      normalizeText(entry.job),
      normalizeText(entry.status),
      normalizeText(entry.source),
      normalizeText(entry.actor),
      normalizeText(entry.snapshotKey),
      normalizeText(entry.queryKey),
      normalizeText(entry?.range?.from),
      normalizeText(entry?.range?.to),
      toNonNegativeInt(entry.total, 0),
      normalizeText(entry.startedAt),
      normalizeText(entry.finishedAt),
      toNonNegativeInt(entry.durationMs, 0),
      normalizeText(entry.error),
      JSON.stringify(entry)
    );
  });
}

function normalizeTimestamp(input) {
  if (typeof input === 'string' && input.trim()) {
    return input.trim();
  }

  return new Date().toISOString();
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }

  return [];
}

function toBooleanInt(value) {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? 1 : 0;
  }

  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return 0;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized) ? 1 : 0;
}

function toNonNegativeInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.trunc(numeric);
}

function toPositiveInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return Math.trunc(numeric);
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return numeric;
}

function safeParse(input, fallback) {
  if (input === null || input === undefined) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(input);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
