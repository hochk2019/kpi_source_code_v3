/**
 * Migration 004: Teams schema — teams, team_members.
 * team_members FK → teams. teams references hq_agencies via snapshot pattern (no hard FK since agency_id is not stored directly).
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  snapshot_key TEXT NOT NULL,
  legacy_team_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_teams_snapshot_key_sort_order
  ON teams(snapshot_key, sort_order);

CREATE INDEX IF NOT EXISTS idx_teams_name
  ON teams(name);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  snapshot_key TEXT NOT NULL,
  legacy_member_id TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_team_members_team_id_sort_order
  ON team_members(team_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_team_members_snapshot_key_sort_order
  ON team_members(snapshot_key, sort_order);

CREATE INDEX IF NOT EXISTS idx_team_members_full_name
  ON team_members(full_name);
`;

const down = `
DROP TABLE IF EXISTS team_members CASCADE;
DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
DROP TABLE IF EXISTS teams CASCADE;
`;

export const migration004: MigrationFile = {
  version: 4,
  name: 'teams_schema',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
