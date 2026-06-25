/**
 * Migration 006: Import Jobs schema.
 * Declarations reference import_jobs via import_job_id (added FK constraint).
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued',
  actor TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT 'manual',
  range_from TEXT NOT NULL DEFAULT '',
  range_to TEXT NOT NULL DEFAULT '',
  include_tax_codes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  exclude_tax_codes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  result_jsonb JSONB NULL,
  error_jsonb JSONB NULL,
  owner_username TEXT NOT NULL DEFAULT '',
  commit_payload_jsonb JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_import_jobs_status_updated_at
  ON import_jobs(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_jobs_owner_username
  ON import_jobs(owner_username);

ALTER TABLE declarations
  ADD CONSTRAINT fk_declarations_import_job_id
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE SET NULL;
`;

const down = `
ALTER TABLE declarations DROP CONSTRAINT IF EXISTS fk_declarations_import_job_id;
DROP TRIGGER IF EXISTS trg_import_jobs_updated_at ON import_jobs;
DROP TABLE IF EXISTS import_jobs CASCADE;
`;

export const migration006: MigrationFile = {
  version: 6,
  name: 'import_jobs_schema',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
