/**
 * Migration 008: KPI Adjustments schema.
 * Adjustments reference kpi_rule_sets via category (logical FK — rules are matched by category name in rules_jsonb).
 * Also references team_members and teams for staff/team assignment.
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE TABLE IF NOT EXISTS kpi_adjustments (
  id TEXT PRIMARY KEY,
  month_start DATE NOT NULL,
  category TEXT NOT NULL,
  mode TEXT NULL,
  license_code TEXT NULL,
  staff_member_id TEXT NULL REFERENCES team_members(id) ON DELETE SET NULL,
  team_id TEXT NULL REFERENCES teams(id) ON DELETE SET NULL,
  staff_name_snapshot TEXT NOT NULL DEFAULT '',
  team_name_snapshot TEXT NOT NULL DEFAULT '',
  tax_code TEXT NULL,
  company_name TEXT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_points NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_quantity NUMERIC(12,2) NULL,
  extra_unit_points NUMERIC(12,2) NULL,
  total_points NUMERIC(12,2) NOT NULL DEFAULT 0,
  "references" TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_by_account_id TEXT NULL,
  updated_by_account_id TEXT NULL,
  approved_at TIMESTAMPTZ NULL,
  approved_by_account_id TEXT NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejected_by_account_id TEXT NULL,
  history_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_kpi_adjustments_updated_at
  BEFORE UPDATE ON kpi_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_kpi_adjustments_month_status
  ON kpi_adjustments(month_start, status);

CREATE INDEX IF NOT EXISTS idx_kpi_adjustments_category
  ON kpi_adjustments(category);

CREATE INDEX IF NOT EXISTS idx_kpi_adjustments_staff_member_id
  ON kpi_adjustments(staff_member_id) WHERE staff_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_adjustments_team_id
  ON kpi_adjustments(team_id) WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_adjustments_tax_code
  ON kpi_adjustments(tax_code) WHERE tax_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_adjustments_status
  ON kpi_adjustments(status);
`;

const down = `
DROP TRIGGER IF EXISTS trg_kpi_adjustments_updated_at ON kpi_adjustments;
DROP TABLE IF EXISTS kpi_adjustments CASCADE;
`;

export const migration008: MigrationFile = {
  version: 8,
  name: 'kpi_adjustments_schema',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
