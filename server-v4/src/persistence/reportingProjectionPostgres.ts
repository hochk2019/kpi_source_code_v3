import { Pool } from 'pg';

import type {
  ReportingProjectionPayload,
  ReportingProjectionPersistence,
} from './reportingProjectionPersistence.js';

const REPORTING_PROJECTION_TABLE = 'reporting_projections';
const REPORTING_SCHEDULE_ENTRY_TABLE = 'reporting_schedule_projection_entries';
const REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE = 'reporting_monthly_aggregate_projection_entries';
const REPORTING_JOB_RUN_ENTRY_TABLE = 'reporting_job_run_entries';

const PROJECTION_TYPE_BY_KEY: Record<string, string> = {
  kpi_report_schedule_v1: 'report_schedule',
  kpi_reporting_monthly_aggregates_v1: 'monthly_aggregate',
  kpi_reporting_monthly_aggregates_default_v1: 'default_monthly_aggregate',
  kpi_reporting_job_runs_v1: 'job_runs',
};

type QueryResultRow = {
  payload?: unknown;
};

type PoolLike = Pick<Pool, 'query' | 'end'>;

export type ManagedReportingProjectionPersistence = ReportingProjectionPersistence & {
  dispose(): Promise<void>;
};

export function createPostgresReportingProjectionPersistence(
  postgresUrl: string,
  options: {
    pool?: PoolLike;
    managePool?: boolean;
  } = {},
): ManagedReportingProjectionPersistence {
  const pool = options.pool ?? new Pool({ connectionString: postgresUrl });
  const managePool = options.managePool ?? true;
  let initializationPromise: Promise<void> | null = null;

  const ensureInitialized = async (): Promise<void> => {
    if (!initializationPromise) {
      initializationPromise = initializeProjectionStorage(pool).catch((error) => {
        initializationPromise = null;
        throw error;
      });
    }

    await initializationPromise;
  };

  const readStoredValue = async (key: string): Promise<ReportingProjectionPayload> => {
    try {
      await ensureInitialized();
      const result = await pool.query<QueryResultRow>(
        `SELECT payload FROM ${REPORTING_PROJECTION_TABLE} WHERE projection_key = $1`,
        [key],
      );
      return normalizeProjectionPayload(result.rows[0]?.payload);
    } catch {
      return null;
    }
  };

  return {
    async readValue(key) {
      return readStoredValue(key);
    },

    async writeValue(key, value) {
      if (!isProjectionPayload(value)) {
        return;
      }

      try {
        await ensureInitialized();
        const metadata = buildProjectionMetadata(key, value);
        await pool.query(
          `INSERT INTO ${REPORTING_PROJECTION_TABLE} ` +
            '(projection_key, projection_type, scope_key, range_from, range_to, query_key, entry_count, payload, updated_at) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) ' +
            'ON CONFLICT (projection_key) DO UPDATE SET ' +
            'projection_type = EXCLUDED.projection_type, ' +
            'scope_key = EXCLUDED.scope_key, ' +
            'range_from = EXCLUDED.range_from, ' +
            'range_to = EXCLUDED.range_to, ' +
            'query_key = EXCLUDED.query_key, ' +
            'entry_count = EXCLUDED.entry_count, ' +
            'payload = EXCLUDED.payload, ' +
            'updated_at = EXCLUDED.updated_at',
          [
            key,
            resolveProjectionType(key),
            metadata.scopeKey,
            metadata.rangeFrom,
            metadata.rangeTo,
            metadata.queryKey,
            metadata.entryCount,
            JSON.stringify(value ?? null),
            metadata.updatedAt,
          ],
        );
        await syncMaterializedProjectionEntries(pool, key, value);
      } catch {
        // Projection persistence should not break runtime reads.
      }
    },

    async deleteValue(key) {
      try {
        await ensureInitialized();
        await pool.query(
          `DELETE FROM ${REPORTING_PROJECTION_TABLE} WHERE projection_key = $1`,
          [key],
        );
        await clearMaterializedProjectionEntries(pool, key);
      } catch {
        // Projection cleanup should not break route responses.
      }
    },

    async readScheduleEntries(snapshotKey) {
      try {
        await ensureInitialized();
        const materialized = await readMaterializedProjectionEntries(
          pool,
          REPORTING_SCHEDULE_ENTRY_TABLE,
          'position ASC, schedule_id ASC',
          snapshotKey,
        );
        if (materialized.length > 0) {
          return materialized;
        }
      } catch {
        // Fall back to the raw payload when relational rows are unavailable.
      }

      const stored = await readStoredValue(snapshotKey);
      return Array.isArray(stored) ? stored.filter(isRecord) : [];
    },

    async readMonthlyAggregateEntries(snapshotKey) {
      try {
        await ensureInitialized();
        const materialized = await readMaterializedProjectionEntries(
          pool,
          REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE,
          'period DESC',
          snapshotKey,
        );
        if (materialized.length > 0) {
          return materialized;
        }
      } catch {
        // Fall back to the raw payload when relational rows are unavailable.
      }

      const stored = await readStoredValue(snapshotKey);
      if (Array.isArray(stored)) {
        return stored.filter(isRecord);
      }

      const items = isRecord(stored) && Array.isArray(stored.items) ? stored.items : [];
      return items.filter(isRecord);
    },

    async readJobRunEntries(snapshotKey) {
      try {
        await ensureInitialized();
        const materialized = await readMaterializedProjectionEntries(
          pool,
          REPORTING_JOB_RUN_ENTRY_TABLE,
          'finished_at DESC, run_id DESC',
          snapshotKey,
        );
        if (materialized.length > 0) {
          return materialized;
        }
      } catch {
        // Fall back to the raw payload when relational rows are unavailable.
      }

      const stored = await readStoredValue(snapshotKey);
      return Array.isArray(stored) ? stored.filter(isRecord) : [];
    },

    async dispose() {
      if (managePool) {
        await pool.end();
      }
    },
  };
}

async function initializeProjectionStorage(pool: PoolLike): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${REPORTING_PROJECTION_TABLE} (` +
      'projection_key TEXT PRIMARY KEY, ' +
      'projection_type TEXT NOT NULL, ' +
      "scope_key TEXT NOT NULL DEFAULT '', " +
      "range_from TEXT NOT NULL DEFAULT '', " +
      "range_to TEXT NOT NULL DEFAULT '', " +
      "query_key TEXT NOT NULL DEFAULT '', " +
      'entry_count INTEGER NOT NULL DEFAULT 0, ' +
      'payload JSONB NOT NULL, ' +
      'updated_at TEXT NOT NULL' +
      ')',
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_reporting_projections_type ON ${REPORTING_PROJECTION_TABLE}(projection_type)`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${REPORTING_SCHEDULE_ENTRY_TABLE} (` +
      'projection_key TEXT NOT NULL, ' +
      'position INTEGER NOT NULL DEFAULT 0, ' +
      'schedule_id TEXT NOT NULL, ' +
      "name TEXT NOT NULL DEFAULT '', " +
      "frequency TEXT NOT NULL DEFAULT '', " +
      "time TEXT NOT NULL DEFAULT '', " +
      'day_of_week INTEGER NOT NULL DEFAULT 0, ' +
      'day_of_month INTEGER NOT NULL DEFAULT 0, ' +
      'active INTEGER NOT NULL DEFAULT 0, ' +
      "last_run TEXT NOT NULL DEFAULT '', " +
      "next_run TEXT NOT NULL DEFAULT '', " +
      'recipient_count INTEGER NOT NULL DEFAULT 0, ' +
      'format_count INTEGER NOT NULL DEFAULT 0, ' +
      'payload JSONB NOT NULL, ' +
      'PRIMARY KEY (projection_key, schedule_id)' +
      ')',
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_reporting_schedule_projection_entries_projection_key ` +
      `ON ${REPORTING_SCHEDULE_ENTRY_TABLE}(projection_key)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_reporting_schedule_projection_entries_projection_position ` +
      `ON ${REPORTING_SCHEDULE_ENTRY_TABLE}(projection_key, position)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_reporting_schedule_projection_entries_active ` +
      `ON ${REPORTING_SCHEDULE_ENTRY_TABLE}(active)`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE} (` +
      'projection_key TEXT NOT NULL, ' +
      'period TEXT NOT NULL, ' +
      "label TEXT NOT NULL DEFAULT '', " +
      "range_from TEXT NOT NULL DEFAULT '', " +
      "range_to TEXT NOT NULL DEFAULT '', " +
      'decls INTEGER NOT NULL DEFAULT 0, ' +
      'import_count INTEGER NOT NULL DEFAULT 0, ' +
      'export_count INTEGER NOT NULL DEFAULT 0, ' +
      'item_count INTEGER NOT NULL DEFAULT 0, ' +
      'license_count INTEGER NOT NULL DEFAULT 0, ' +
      'kpi DOUBLE PRECISION NOT NULL DEFAULT 0, ' +
      'co_count INTEGER NOT NULL DEFAULT 0, ' +
      'co_line_count INTEGER NOT NULL DEFAULT 0, ' +
      'company_count INTEGER NOT NULL DEFAULT 0, ' +
      'top_team_count INTEGER NOT NULL DEFAULT 0, ' +
      'top_staff_count INTEGER NOT NULL DEFAULT 0, ' +
      'payload JSONB NOT NULL, ' +
      'PRIMARY KEY (projection_key, period)' +
      ')',
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_reporting_monthly_aggregate_projection_entries_projection_key ` +
      `ON ${REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE}(projection_key)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_reporting_monthly_aggregate_projection_entries_range ` +
      `ON ${REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE}(range_from, range_to)`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${REPORTING_JOB_RUN_ENTRY_TABLE} (` +
      'projection_key TEXT NOT NULL, ' +
      'run_id TEXT NOT NULL, ' +
      "job_name TEXT NOT NULL DEFAULT '', " +
      "status TEXT NOT NULL DEFAULT '', " +
      "source TEXT NOT NULL DEFAULT '', " +
      "actor TEXT NOT NULL DEFAULT '', " +
      "snapshot_key TEXT NOT NULL DEFAULT '', " +
      "query_key TEXT NOT NULL DEFAULT '', " +
      "range_from TEXT NOT NULL DEFAULT '', " +
      "range_to TEXT NOT NULL DEFAULT '', " +
      'total INTEGER NOT NULL DEFAULT 0, ' +
      "started_at TEXT NOT NULL DEFAULT '', " +
      "finished_at TEXT NOT NULL DEFAULT '', " +
      'duration_ms INTEGER NOT NULL DEFAULT 0, ' +
      "error_message TEXT NOT NULL DEFAULT '', " +
      'payload JSONB NOT NULL, ' +
      'PRIMARY KEY (projection_key, run_id)' +
      ')',
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_reporting_job_run_entries_projection_key ` +
      `ON ${REPORTING_JOB_RUN_ENTRY_TABLE}(projection_key)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_reporting_job_run_entries_finished_at ` +
      `ON ${REPORTING_JOB_RUN_ENTRY_TABLE}(finished_at DESC)`,
  );
}

function resolveProjectionType(key: string): string {
  return PROJECTION_TYPE_BY_KEY[String(key || '').trim()] || 'reporting_projection';
}

function buildProjectionMetadata(
  key: string,
  value: Exclude<ReportingProjectionPayload, null>,
): {
  scopeKey: string;
  rangeFrom: string;
  rangeTo: string;
  queryKey: string;
  entryCount: number;
  updatedAt: string;
} {
  const normalizedKey = String(key || '').trim();
  const record = isRecord(value) ? value : null;
  const range = getRecord(record?.range);
  const cache = getRecord(record?.cache);
  const items = Array.isArray(value)
    ? value
    : Array.isArray(record?.items)
      ? record.items
      : [];

  return {
    scopeKey: resolveScopeKey(normalizedKey),
    rangeFrom: normalizeText(range.from),
    rangeTo: normalizeText(range.to),
    queryKey: normalizeText(cache.queryKey),
    entryCount: countProjectionEntries(value, items, record),
    updatedAt: normalizeText(record?.generatedAt) || new Date().toISOString(),
  };
}

async function readMaterializedProjectionEntries(
  pool: PoolLike,
  tableName: string,
  orderBy: string,
  key: string,
): Promise<Record<string, unknown>[]> {
  try {
    const result = await pool.query<QueryResultRow>(
      `SELECT payload FROM ${tableName} WHERE projection_key = $1 ORDER BY ${orderBy}`,
      [key],
    );

    return Array.isArray(result.rows)
      ? result.rows
          .map((row) => normalizeProjectionPayload(row?.payload))
          .filter(isRecord)
      : [];
  } catch {
    return [];
  }
}

async function syncMaterializedProjectionEntries(
  pool: PoolLike,
  key: string,
  value: Exclude<ReportingProjectionPayload, null>,
): Promise<void> {
  const normalizedKey = normalizeText(key);

  try {
    await clearMaterializedProjectionEntries(pool, normalizedKey);

    if (normalizedKey === 'kpi_report_schedule_v1') {
      await materializeScheduleProjectionEntries(pool, normalizedKey, value);
      return;
    }

    if (
      normalizedKey === 'kpi_reporting_monthly_aggregates_v1' ||
      normalizedKey === 'kpi_reporting_monthly_aggregates_default_v1'
    ) {
      await materializeMonthlyAggregateProjectionEntries(pool, normalizedKey, value);
      return;
    }

    if (normalizedKey === 'kpi_reporting_job_runs_v1') {
      await materializeJobRunProjectionEntries(pool, normalizedKey, value);
    }
  } catch {
    await clearMaterializedProjectionEntries(pool, normalizedKey);
  }
}

async function clearMaterializedProjectionEntries(pool: PoolLike, key: string): Promise<void> {
  await pool.query(`DELETE FROM ${REPORTING_SCHEDULE_ENTRY_TABLE} WHERE projection_key = $1`, [key]);
  await pool.query(`DELETE FROM ${REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE} WHERE projection_key = $1`, [key]);
  await pool.query(`DELETE FROM ${REPORTING_JOB_RUN_ENTRY_TABLE} WHERE projection_key = $1`, [key]);
}

async function materializeScheduleProjectionEntries(
  pool: PoolLike,
  key: string,
  value: Exclude<ReportingProjectionPayload, null>,
): Promise<void> {
  const schedules = Array.isArray(value) ? value.filter(isRecord) : [];
  if (!schedules.length) {
    return;
  }

  for (const [index, entry] of schedules.entries()) {
    await pool.query(
      `INSERT INTO ${REPORTING_SCHEDULE_ENTRY_TABLE} ` +
        '(projection_key, position, schedule_id, name, frequency, time, day_of_week, day_of_month, active, last_run, next_run, recipient_count, format_count, payload) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)',
      [
        key,
        index,
        normalizeText(entry.id) || `schedule-${index + 1}`,
        normalizeText(entry.name),
        normalizeText(entry.frequency),
        normalizeText(entry.time),
        toNonNegativeInt(entry.dayOfWeek, 0),
        toNonNegativeInt(entry.dayOfMonth, 0),
        entry.active ? 1 : 0,
        normalizeText(entry.lastRun),
        normalizeText(entry.nextRun),
        normalizeStringList(entry.recipients).length,
        normalizeStringList(entry.formats).length,
        JSON.stringify(entry),
      ],
    );
  }
}

async function materializeMonthlyAggregateProjectionEntries(
  pool: PoolLike,
  key: string,
  value: Exclude<ReportingProjectionPayload, null>,
): Promise<void> {
  const snapshot = isRecord(value) ? value : null;
  const items = Array.isArray(snapshot?.items) ? snapshot.items.filter(isRecord) : [];
  if (!items.length) {
    return;
  }

  for (const [index, entry] of items.entries()) {
    const summary = getRecord(entry.summary);
    const range = getRecord(entry.range);
    await pool.query(
      `INSERT INTO ${REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE} ` +
        '(projection_key, period, label, range_from, range_to, decls, import_count, export_count, item_count, license_count, kpi, co_count, co_line_count, company_count, top_team_count, top_staff_count, payload) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)',
      [
        key,
        normalizeText(entry.period) || `period-${index + 1}`,
        normalizeText(entry.label),
        normalizeText(range.from),
        normalizeText(range.to),
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
        JSON.stringify(entry),
      ],
    );
  }
}

async function materializeJobRunProjectionEntries(
  pool: PoolLike,
  key: string,
  value: Exclude<ReportingProjectionPayload, null>,
): Promise<void> {
  const runs = Array.isArray(value) ? value.filter(isRecord) : [];
  if (!runs.length) {
    return;
  }

  for (const [index, entry] of runs.entries()) {
    const range = getRecord(entry.range);
    await pool.query(
      `INSERT INTO ${REPORTING_JOB_RUN_ENTRY_TABLE} ` +
        '(projection_key, run_id, job_name, status, source, actor, snapshot_key, query_key, range_from, range_to, total, started_at, finished_at, duration_ms, error_message, payload) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)',
      [
        key,
        normalizeText(entry.id) || `run-${index + 1}`,
        normalizeText(entry.job),
        normalizeText(entry.status),
        normalizeText(entry.source),
        normalizeText(entry.actor),
        normalizeText(entry.snapshotKey),
        normalizeText(entry.queryKey),
        normalizeText(range.from),
        normalizeText(range.to),
        toPositiveInt(entry.total, 0),
        normalizeText(entry.startedAt),
        normalizeText(entry.finishedAt),
        toPositiveInt(entry.durationMs, 0),
        normalizeText(entry.error),
        JSON.stringify(entry),
      ],
    );
  }
}

function resolveScopeKey(key: string): string {
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

function countProjectionEntries(
  value: Exclude<ReportingProjectionPayload, null>,
  items: unknown[],
  record: Record<string, unknown> | null,
): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (items.length) {
    return items.length;
  }
  return toPositiveInt(record?.total, 0);
}

function normalizeProjectionPayload(value: unknown): ReportingProjectionPayload {
  const normalized = typeof value === 'string' ? safeParse(value, null) : value;

  if (Array.isArray(normalized)) {
    return normalized.filter(isRecord);
  }

  return isRecord(normalized) ? normalized : null;
}

function isProjectionPayload(value: unknown): value is Exclude<ReportingProjectionPayload, null> {
  return isRecord(value) || (Array.isArray(value) && value.every(isRecord));
}

function normalizeText(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function toPositiveInt(input: unknown, fallback: number): number {
  const normalized = Number(input);
  return Number.isFinite(normalized) && normalized > 0 ? Math.trunc(normalized) : fallback;
}

function toNonNegativeInt(input: unknown, fallback: number): number {
  const normalized = Number(input);
  return Number.isFinite(normalized) && normalized >= 0 ? Math.trunc(normalized) : fallback;
}

function toFiniteNumber(input: unknown, fallback: number): number {
  const normalized = Number(input);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function safeParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

function normalizeStringList(input: unknown): string[] {
  return Array.isArray(input)
    ? input
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0)
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
