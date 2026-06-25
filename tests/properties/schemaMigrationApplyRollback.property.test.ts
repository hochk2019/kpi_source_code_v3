/* @vitest-environment node */

/**
 * Property-Based Test: Schema Migration Apply-Rollback Round-Trip (Property 19)
 *
 * Feature: system-redesign-2026, Property 19: Schema Migration Apply-Rollback Round-Trip
 *
 * For any migration with valid up and down scripts, applying the migration and
 * then rolling it back SHALL return the database schema to its pre-migration state
 * (table structure, constraints, indexes unchanged).
 *
 * **Validates: Requirements 12.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import {
  createMigrationEngine,
  createSqliteMigrationAdapter,
  computeChecksum,
  type MigrationFile,
} from '../../server-v4/src/migration/migrationEngine.js';

/**
 * Helper: get all user-created tables in the SQLite database (excluding _migrations metadata).
 */
function getUserTables(db: InstanceType<typeof Database>): string[] {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_migrations' ORDER BY name",
    )
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

/**
 * Arbitrary for generating valid SQL-safe table names.
 * Names are lowercase alpha with 3-15 chars, prefixed with 'tbl_' to avoid reserved words.
 */
const arbTableName = fc
  .string({ minLength: 3, maxLength: 15, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')) })
  .map((s) => `tbl_${s}`);

/**
 * Arbitrary for generating a random CREATE TABLE migration (up = CREATE, down = DROP).
 */
const arbCreateTableMigration = arbTableName.map((tableName) => {
  const up = `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value TEXT NOT NULL)`;
  const down = `DROP TABLE IF EXISTS ${tableName}`;
  return { tableName, up, down };
});

describe('Property 19: Schema Migration Apply-Rollback Round-Trip', { timeout: 30000 }, () => {
  it('apply then rollback returns schema to pre-migration state for random CREATE TABLE migrations', async () => {
    await fc.assert(
      fc.asyncProperty(arbCreateTableMigration, async ({ tableName, up, down }) => {
        // Set up in-memory SQLite
        const db = new Database(':memory:');
        const adapter = createSqliteMigrationAdapter(db);

        // Capture pre-migration schema state
        await adapter.ensureMetadataTable();
        const tablesBefore = getUserTables(db);

        // Build migration file
        const migration: MigrationFile = {
          version: 1,
          name: `create_${tableName}`,
          up,
          down,
          checksum: computeChecksum(up),
        };

        const engine = createMigrationEngine(adapter, [migration]);

        // Apply the migration
        const applied = await engine.applyPending();
        expect(applied).toHaveLength(1);
        expect(applied[0]!.version).toBe(1);

        // Verify table exists after apply
        const tablesAfterApply = getUserTables(db);
        expect(tablesAfterApply).toContain(tableName);

        // Rollback the migration
        const rolledBack = await engine.rollbackLast();
        expect(rolledBack.version).toBe(1);
        expect(rolledBack.rolledBack).toBe(true);

        // Verify schema is restored to pre-migration state
        const tablesAfterRollback = getUserTables(db);
        expect(tablesAfterRollback).toEqual(tablesBefore);

        db.close();
      }),
      { numRuns: 100 },
    );
  });

  it('apply then rollback round-trip works for DROP TABLE migrations (reverse scenario)', async () => {
    await fc.assert(
      fc.asyncProperty(arbTableName, async (tableName) => {
        // Set up in-memory SQLite with a pre-existing table
        const db = new Database(':memory:');
        db.exec(
          `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, data TEXT)`,
        );

        const adapter = createSqliteMigrationAdapter(db);
        await adapter.ensureMetadataTable();

        // Capture pre-migration schema state (table exists)
        const tablesBefore = getUserTables(db);
        expect(tablesBefore).toContain(tableName);

        // Migration: DROP TABLE (up) and re-CREATE (down) to restore
        const up = `DROP TABLE ${tableName}`;
        const down = `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, data TEXT)`;

        const migration: MigrationFile = {
          version: 1,
          name: `drop_${tableName}`,
          up,
          down,
          checksum: computeChecksum(up),
        };

        const engine = createMigrationEngine(adapter, [migration]);

        // Apply: table should be gone
        const applied = await engine.applyPending();
        expect(applied).toHaveLength(1);

        const tablesAfterApply = getUserTables(db);
        expect(tablesAfterApply).not.toContain(tableName);

        // Rollback: table should be back
        const rolledBack = await engine.rollbackLast();
        expect(rolledBack.version).toBe(1);
        expect(rolledBack.rolledBack).toBe(true);

        const tablesAfterRollback = getUserTables(db);
        expect(tablesAfterRollback).toEqual(tablesBefore);

        db.close();
      }),
      { numRuns: 100 },
    );
  });

  it('multiple sequential migrations: rollback each in reverse restores original state', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-5 unique table names for multiple migrations
        fc
          .uniqueArray(arbTableName, { minLength: 2, maxLength: 5 })
          .filter((names) => new Set(names).size === names.length),
        async (tableNames) => {
          const db = new Database(':memory:');
          const adapter = createSqliteMigrationAdapter(db);
          await adapter.ensureMetadataTable();

          // Capture initial state (empty)
          const tablesInitial = getUserTables(db);

          // Build migration files for each table
          const migrations: MigrationFile[] = tableNames.map((name, idx) => {
            const up = `CREATE TABLE ${name} (id INTEGER PRIMARY KEY, value TEXT)`;
            const down = `DROP TABLE IF EXISTS ${name}`;
            return {
              version: idx + 1,
              name: `create_${name}`,
              up,
              down,
              checksum: computeChecksum(up),
            };
          });

          const engine = createMigrationEngine(adapter, migrations);

          // Apply all pending
          const applied = await engine.applyPending();
          expect(applied).toHaveLength(tableNames.length);

          // Verify all tables exist
          const tablesAfterAll = getUserTables(db);
          for (const name of tableNames) {
            expect(tablesAfterAll).toContain(name);
          }

          // Rollback each one in reverse order
          for (let i = tableNames.length - 1; i >= 0; i--) {
            const rolled = await engine.rollbackLast();
            expect(rolled.version).toBe(i + 1);
          }

          // Verify schema is restored to initial state
          const tablesAfterFullRollback = getUserTables(db);
          expect(tablesAfterFullRollback).toEqual(tablesInitial);

          db.close();
        },
      ),
      { numRuns: 100 },
    );
  });
});
