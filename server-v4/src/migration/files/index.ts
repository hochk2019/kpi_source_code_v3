/**
 * Migration file registry.
 * Each migration conforms to the MigrationFile interface (version, name, up, down, checksum).
 * Import all migration definitions and export them as a sorted array.
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

import { migration001 } from './001_create_updated_at_trigger.js';
import { migration002 } from './002_hq_agencies_schema.js';
import { migration003 } from './003_auth_schema.js';
import { migration004 } from './004_teams_schema.js';
import { migration005 } from './005_declarations_schema.js';
import { migration006 } from './006_import_jobs_schema.js';
import { migration007 } from './007_kpi_rules_schema.js';
import { migration008 } from './008_kpi_adjustments_schema.js';
import { migration009 } from './009_mst_assignments_schema.js';
import { migration010 } from './010_declaration_events_schema.js';
import { migration011 } from './011_config_documents_schema.js';

export const allMigrations: MigrationFile[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
].sort((a, b) => a.version - b.version);

/**
 * Helper to define a migration with auto-computed checksum.
 */
export function defineMigration(version: number, name: string, up: string, down: string): MigrationFile {
  return { version, name, up, down, checksum: computeChecksum(up) };
}
