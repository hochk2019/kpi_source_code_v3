import { Pool } from 'pg';

import type {
  ReportingProjectionPayload,
  ReportingProjectionPersistence,
} from './reportingProjectionPersistence.js';

const REPORTING_PROJECTION_TABLE = 'reporting_projections';

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
      } catch {
        // Projection cleanup should not break route responses.
      }
    },

    async readMonthlyAggregateEntries(snapshotKey) {
      const stored = await readStoredValue(snapshotKey);
      if (Array.isArray(stored)) {
        return stored.filter(isRecord);
      }

      const items = isRecord(stored) && Array.isArray(stored.items) ? stored.items : [];
      return items.filter(isRecord);
    },

    async readJobRunEntries(snapshotKey) {
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

function safeParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
