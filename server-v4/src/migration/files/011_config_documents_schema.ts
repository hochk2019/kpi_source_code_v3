/**
 * Migration 011: Config Documents schema.
 * Shared key-value config store used by declarations, kpi-adjustments, and other modules.
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE TABLE IF NOT EXISTS config_documents (
  config_key TEXT PRIMARY KEY,
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_account_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_config_documents_updated_at
  BEFORE UPDATE ON config_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
`;

const down = `
DROP TRIGGER IF EXISTS trg_config_documents_updated_at ON config_documents;
DROP TABLE IF EXISTS config_documents CASCADE;
`;

export const migration011: MigrationFile = {
  version: 11,
  name: 'config_documents_schema',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
