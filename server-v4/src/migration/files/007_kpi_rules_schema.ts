/**
 * Migration 007: KPI Rule Sets schema.
 * Stores versioned rule sets. kpi_adjustments references rules via category mapping.
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE TABLE IF NOT EXISTS kpi_rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_no BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  rules_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_account_id UUID NULL,
  activated_at TIMESTAMPTZ NULL,
  activated_by_account_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_kpi_rule_sets_updated_at
  BEFORE UPDATE ON kpi_rule_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_kpi_rule_sets_is_active
  ON kpi_rule_sets(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_kpi_rule_sets_version_no
  ON kpi_rule_sets(version_no ASC);
`;

const down = `
DROP TRIGGER IF EXISTS trg_kpi_rule_sets_updated_at ON kpi_rule_sets;
DROP TABLE IF EXISTS kpi_rule_sets CASCADE;
`;

export const migration007: MigrationFile = {
  version: 7,
  name: 'kpi_rules_schema',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
