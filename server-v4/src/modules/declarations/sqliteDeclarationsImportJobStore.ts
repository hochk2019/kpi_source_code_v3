import Database from 'better-sqlite3';
import { ensureSqliteKvStore } from '@kpi/backend-shared/persistence';

import type { DeclarationsImportJobStatus } from './declarationsImportJobService.js';
import type { DeclarationsImportJobStore, StoredImportJob } from './declarationsImportJobStore.js';
import type { DeclarationsImportCommitResponse } from './declarationsImportService.js';

const IMPORT_JOBS_STORAGE_KEY = 'import_jobs_v1';
const READ_KV_VALUE_SQL = 'SELECT value FROM kv_store WHERE key = ?';
const UPSERT_KV_VALUE_SQL =
  'INSERT INTO kv_store (key, value) VALUES (?, ?) ' +
  'ON CONFLICT(key) DO UPDATE SET value = excluded.value';

export class SqliteDeclarationsImportJobStore implements DeclarationsImportJobStore {
  constructor(private readonly dbFile: string) {}

  async writeJob(job: StoredImportJob): Promise<void> {
    this.withDatabase((database) => {
      ensureSqliteKvStore(database);
      const jobs = readJobsArray(database);
      const existingIndex = jobs.findIndex((j) => j.id === job.id);
      if (existingIndex >= 0) {
        jobs[existingIndex] = job;
      } else {
        jobs.unshift(job);
      }
      while (jobs.length > 50) {
        jobs.pop();
      }
      database.prepare(UPSERT_KV_VALUE_SQL).run(IMPORT_JOBS_STORAGE_KEY, JSON.stringify(jobs));
    });
  }

  async readJob(id: string): Promise<StoredImportJob | null> {
    return this.withDatabase((database) => {
      ensureSqliteKvStore(database);
      const jobs = readJobsArray(database);
      return jobs.find((j) => j.id === id) ?? null;
    });
  }

  async listJobs(limit = 50): Promise<StoredImportJob[]> {
    return this.withDatabase((database) => {
      ensureSqliteKvStore(database);
      const jobs = readJobsArray(database);
      return jobs.slice(0, limit);
    });
  }

  async deleteJob(id: string): Promise<void> {
    this.withDatabase((database) => {
      ensureSqliteKvStore(database);
      const jobs = readJobsArray(database).filter((j) => j.id !== id);
      database.prepare(UPSERT_KV_VALUE_SQL).run(IMPORT_JOBS_STORAGE_KEY, JSON.stringify(jobs));
    });
  }

  private withDatabase<T>(work: (database: Database) => T): T {
    const database = new Database(this.dbFile);
    try {
      return work(database);
    } finally {
      database.close();
    }
  }
}

function readJobsArray(database: Database): StoredImportJob[] {
  const row = database.prepare(READ_KV_VALUE_SQL).get(IMPORT_JOBS_STORAGE_KEY) as
    | { value?: string | null }
    | undefined;
  if (!row?.value) {
    return [];
  }

  try {
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(normalizeStoredJob).filter((j): j is StoredImportJob => j !== null);
  } catch {
    return [];
  }
}

function normalizeStoredJob(value: unknown): StoredImportJob | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id : '';
  if (!id) {
    return null;
  }

  return {
    id,
    status: normalizeStatus(obj.status),
    actor: typeof obj.actor === 'string' ? obj.actor : '',
    reason: typeof obj.reason === 'string' ? obj.reason : 'manual',
    from: typeof obj.from === 'string' ? obj.from : '',
    to: typeof obj.to === 'string' ? obj.to : '',
    includeTaxCodes: normalizeStringArray(obj.includeTaxCodes),
    excludeTaxCodes: normalizeStringArray(obj.excludeTaxCodes),
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : '',
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : '',
    startedAt: typeof obj.startedAt === 'string' ? obj.startedAt : null,
    finishedAt: typeof obj.finishedAt === 'string' ? obj.finishedAt : null,
    result: normalizeRecord(obj.result) as DeclarationsImportCommitResponse | null,
    error: normalizeError(obj.error),
    ownerUsername: typeof obj.ownerUsername === 'string' ? obj.ownerUsername : '',
    commitPayload: normalizeRecord(obj.commitPayload),
  };
}

function normalizeStatus(value: unknown): DeclarationsImportJobStatus {
  if (value === 'running' || value === 'completed' || value === 'failed') {
    return value;
  }
  return 'queued';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function normalizeError(value: unknown): { message: string } | null {
  const record = normalizeRecord(value);
  if (record && typeof record.message === 'string') {
    return { message: record.message };
  }
  return null;
}
