import type { Pool } from 'pg';

import type { DeclarationsImportJobStatus } from './declarationsImportJobService.js';
import type { DeclarationsImportJobStore, StoredImportJob } from './declarationsImportJobStore.js';
import type { DeclarationsImportCommitResponse } from './declarationsImportService.js';

type PoolLike = Pick<Pool, 'query'>;

type CanonicalImportJobRow = {
  id?: unknown;
  status?: unknown;
  actor?: unknown;
  reason?: unknown;
  range_from?: unknown;
  range_to?: unknown;
  include_tax_codes?: unknown;
  exclude_tax_codes?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  started_at?: unknown;
  finished_at?: unknown;
  result_jsonb?: unknown;
  error_jsonb?: unknown;
  owner_username?: unknown;
  commit_payload_jsonb?: unknown;
};

const CREATE_IMPORT_JOBS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS import_jobs (' +
  '  id TEXT PRIMARY KEY,' +
  '  status TEXT NOT NULL DEFAULT \'queued\',' +
  '  actor TEXT NOT NULL DEFAULT \'\',' +
  '  reason TEXT NOT NULL DEFAULT \'manual\',' +
  '  range_from TEXT NOT NULL DEFAULT \'\',' +
  '  range_to TEXT NOT NULL DEFAULT \'\',' +
  '  include_tax_codes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],' +
  '  exclude_tax_codes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],' +
  '  created_at TIMESTAMPTZ NOT NULL,' +
  '  updated_at TIMESTAMPTZ NOT NULL,' +
  '  started_at TIMESTAMPTZ NULL,' +
  '  finished_at TIMESTAMPTZ NULL,' +
  '  result_jsonb JSONB NULL,' +
  '  error_jsonb JSONB NULL,' +
  '  owner_username TEXT NOT NULL DEFAULT \'\',' +
  '  commit_payload_jsonb JSONB NULL' +
  ')';

const CREATE_IMPORT_JOBS_STATUS_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_import_jobs_status_updated_at ' +
  'ON import_jobs(status, updated_at DESC)';

const UPSERT_IMPORT_JOB_SQL =
  'INSERT INTO import_jobs (' +
  '  id, status, actor, reason, range_from, range_to,' +
  '  include_tax_codes, exclude_tax_codes,' +
  '  created_at, updated_at, started_at, finished_at,' +
  '  result_jsonb, error_jsonb, owner_username, commit_payload_jsonb' +
  ') VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)' +
  ' ON CONFLICT (id) DO UPDATE SET' +
  '  status = EXCLUDED.status,' +
  '  actor = EXCLUDED.actor,' +
  '  reason = EXCLUDED.reason,' +
  '  range_from = EXCLUDED.range_from,' +
  '  range_to = EXCLUDED.range_to,' +
  '  include_tax_codes = EXCLUDED.include_tax_codes,' +
  '  exclude_tax_codes = EXCLUDED.exclude_tax_codes,' +
  '  created_at = EXCLUDED.created_at,' +
  '  updated_at = EXCLUDED.updated_at,' +
  '  started_at = EXCLUDED.started_at,' +
  '  finished_at = EXCLUDED.finished_at,' +
  '  result_jsonb = EXCLUDED.result_jsonb,' +
  '  error_jsonb = EXCLUDED.error_jsonb,' +
  '  owner_username = EXCLUDED.owner_username,' +
  '  commit_payload_jsonb = EXCLUDED.commit_payload_jsonb';

const READ_IMPORT_JOB_SQL =
  'SELECT id, status, actor, reason, range_from, range_to,' +
  '  include_tax_codes, exclude_tax_codes,' +
  '  created_at, updated_at, started_at, finished_at,' +
  '  result_jsonb, error_jsonb, owner_username, commit_payload_jsonb' +
  ' FROM import_jobs WHERE id = $1';

const LIST_IMPORT_JOBS_SQL =
  'SELECT id, status, actor, reason, range_from, range_to,' +
  '  include_tax_codes, exclude_tax_codes,' +
  '  created_at, updated_at, started_at, finished_at,' +
  '  result_jsonb, error_jsonb, owner_username, commit_payload_jsonb' +
  ' FROM import_jobs ORDER BY updated_at DESC LIMIT $1';

const DELETE_IMPORT_JOB_SQL = 'DELETE FROM import_jobs WHERE id = $1';

export class PostgresDeclarationsImportJobStore implements DeclarationsImportJobStore {
  private initializationPromise: Promise<void> | null = null;

  constructor(private readonly pool: PoolLike) {}

  async writeJob(job: StoredImportJob): Promise<void> {
    await this.ensureInitialized();
    await this.pool.query(UPSERT_IMPORT_JOB_SQL, [
      job.id,
      job.status,
      job.actor,
      job.reason,
      job.from,
      job.to,
      job.includeTaxCodes,
      job.excludeTaxCodes,
      job.createdAt,
      job.updatedAt,
      job.startedAt ?? null,
      job.finishedAt ?? null,
      job.result ? JSON.stringify(job.result) : null,
      job.error ? JSON.stringify(job.error) : null,
      job.ownerUsername,
      job.commitPayload ? JSON.stringify(job.commitPayload) : null,
    ]);
  }

  async readJob(id: string): Promise<StoredImportJob | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<CanonicalImportJobRow>(READ_IMPORT_JOB_SQL, [id]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return normalizeImportJobRow(row);
  }

  async listJobs(limit = 50): Promise<StoredImportJob[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<CanonicalImportJobRow>(LIST_IMPORT_JOBS_SQL, [limit]);
    return result.rows.map(normalizeImportJobRow);
  }

  async deleteJob(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.pool.query(DELETE_IMPORT_JOB_SQL, [id]);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = initializeImportJobStorage(this.pool).catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    }
    await this.initializationPromise;
  }
}

async function initializeImportJobStorage(pool: PoolLike): Promise<void> {
  await pool.query(CREATE_IMPORT_JOBS_TABLE_SQL);
  await pool.query(CREATE_IMPORT_JOBS_STATUS_INDEX_SQL);
}

function normalizeImportJobRow(row: CanonicalImportJobRow): StoredImportJob {
  const status = normalizeStatus(row.status);
  const includeTaxCodes = Array.isArray(row.include_tax_codes)
    ? row.include_tax_codes.filter((item): item is string => typeof item === 'string')
    : [];
  const excludeTaxCodes = Array.isArray(row.exclude_tax_codes)
    ? row.exclude_tax_codes.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    id: String(row.id ?? ''),
    status,
    actor: String(row.actor ?? ''),
    reason: String(row.reason ?? 'manual'),
    from: String(row.range_from ?? ''),
    to: String(row.range_to ?? ''),
    includeTaxCodes,
    excludeTaxCodes,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    result: parseJsonField(row.result_jsonb) as DeclarationsImportCommitResponse | null,
    error: parseErrorField(row.error_jsonb),
    ownerUsername: String(row.owner_username ?? ''),
    commitPayload: parseJsonField(row.commit_payload_jsonb),
  };
}

function normalizeStatus(value: unknown): DeclarationsImportJobStatus {
  if (value === 'running' || value === 'completed' || value === 'failed') {
    return value;
  }
  return 'queued';
}

function parseJsonField(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

function parseErrorField(value: unknown): { message: string } | null {
  const parsed = parseJsonField(value);
  if (parsed && typeof parsed.message === 'string') {
    return { message: parsed.message };
  }
  return null;
}
