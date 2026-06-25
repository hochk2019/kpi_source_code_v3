/**
 * Migration 005: Declarations schema — declarations, declaration_license_codes.
 * declaration_license_codes FK → declarations.
 * Declarations link to import_jobs via import workflows (soft reference).
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE TABLE IF NOT EXISTS declarations (
  id TEXT PRIMARY KEY,
  declaration_no TEXT NOT NULL DEFAULT '',
  declaration_no_raw TEXT NOT NULL DEFAULT '',
  branch_code TEXT NOT NULL DEFAULT '',
  declared_at DATE NULL,
  tax_code TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  customs_type_code TEXT NOT NULL DEFAULT '',
  item_count INTEGER NOT NULL DEFAULT 0,
  license_count INTEGER NOT NULL DEFAULT 0,
  staff_name_snapshot TEXT NOT NULL DEFAULT '',
  team_name_snapshot TEXT NOT NULL DEFAULT '',
  agency_text TEXT NOT NULL DEFAULT '',
  is_export BOOLEAN NOT NULL DEFAULT FALSE,
  co_line_count INTEGER NOT NULL DEFAULT 0,
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by TEXT NULL,
  deleted_at TIMESTAMPTZ NULL,
  import_job_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_declarations_updated_at
  BEFORE UPDATE ON declarations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_declarations_declaration_no_branch_code
  ON declarations(declaration_no, branch_code);

CREATE INDEX IF NOT EXISTS idx_declarations_declared_at
  ON declarations(declared_at DESC);

CREATE INDEX IF NOT EXISTS idx_declarations_tax_code
  ON declarations(tax_code);

CREATE INDEX IF NOT EXISTS idx_declarations_deleted_at
  ON declarations(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_declarations_import_job_id
  ON declarations(import_job_id) WHERE import_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_declarations_branch_code
  ON declarations(branch_code);

CREATE TABLE IF NOT EXISTS declaration_license_codes (
  id BIGSERIAL PRIMARY KEY,
  declaration_id TEXT NOT NULL REFERENCES declarations(id) ON DELETE CASCADE,
  code TEXT NOT NULL DEFAULT '',
  is_excluded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_declaration_license_codes_declaration_id
  ON declaration_license_codes(declaration_id);

CREATE INDEX IF NOT EXISTS idx_declaration_license_codes_code
  ON declaration_license_codes(code);
`;

const down = `
DROP TABLE IF EXISTS declaration_license_codes CASCADE;
DROP TRIGGER IF EXISTS trg_declarations_updated_at ON declarations;
DROP TABLE IF EXISTS declarations CASCADE;
`;

export const migration005: MigrationFile = {
  version: 5,
  name: 'declarations_schema',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
