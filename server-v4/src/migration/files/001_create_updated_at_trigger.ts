/**
 * Migration 001: Create the shared updated_at trigger function.
 * All entity tables will reference this function for auto-updating the updated_at column.
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

const down = `
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
`;

export const migration001: MigrationFile = {
  version: 1,
  name: 'create_updated_at_trigger',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
