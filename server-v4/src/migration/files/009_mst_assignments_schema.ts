/**
 * Migration 009: MST Assignments schema.
 * FK to team_members (import_member_id, export_member_id) and teams (team_id).
 * Uses daterange for temporal validity.
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE TABLE IF NOT EXISTS mst_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tax_code TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  import_member_id TEXT NULL REFERENCES team_members(id) ON DELETE SET NULL,
  export_member_id TEXT NULL REFERENCES team_members(id) ON DELETE SET NULL,
  team_id TEXT NULL REFERENCES teams(id) ON DELETE SET NULL,
  valid_during DATERANGE NOT NULL DEFAULT daterange(CURRENT_DATE, NULL),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mst_assignments_updated_at
  BEFORE UPDATE ON mst_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_mst_assignments_tax_code
  ON mst_assignments(tax_code);

CREATE INDEX IF NOT EXISTS idx_mst_assignments_import_member_id
  ON mst_assignments(import_member_id) WHERE import_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mst_assignments_export_member_id
  ON mst_assignments(export_member_id) WHERE export_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mst_assignments_team_id
  ON mst_assignments(team_id) WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mst_assignments_status
  ON mst_assignments(status);

CREATE INDEX IF NOT EXISTS idx_mst_assignments_valid_during
  ON mst_assignments USING gist(valid_during);

CREATE TABLE IF NOT EXISTS mst_assignment_events (
  id BIGSERIAL PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES mst_assignments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_username TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mst_assignment_events_assignment_id
  ON mst_assignment_events(assignment_id, occurred_at DESC);
`;

const down = `
DROP TABLE IF EXISTS mst_assignment_events CASCADE;
DROP TRIGGER IF EXISTS trg_mst_assignments_updated_at ON mst_assignments;
DROP TABLE IF EXISTS mst_assignments CASCADE;
`;

export const migration009: MigrationFile = {
  version: 9,
  name: 'mst_assignments_schema',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
