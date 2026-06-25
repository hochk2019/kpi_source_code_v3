/**
 * Property Test: Failed Migration Transaction Atomicity (Property 20)
 *
 * Feature: system-redesign-2026, Property 20: Failed Migration Transaction Atomicity
 *
 * For any migration whose `up` script produces an error at any statement,
 * the Migration_Engine SHALL roll back the entire transaction, leaving the
 * database at the version prior to the failed migration with no partial DDL applied.
 *
 * **Validates: Requirements 12.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import {
  createMigrationEngine,
  createSqliteMigrationAdapter,
  computeChecksum,
} from '../../server-v4/src/migration/migrationEngine.ts';

// ─── Arbitrary Generators ──────────────────────────────────────────────────

/**
 * Generate a simple alphabetic identifier suffix (3-8 chars).
 */
const arbIdentifier = fc
  .integer({ min: 0, max: 99999 })
  .map((n) => `t${n}`);

/**
 * Strategies that produce SQL errors in SQLite:
 * - 'insert_nonexistent': INSERT into a non-existent table (after a valid CREATE)
 * - 'syntax_error': Malformed SQL syntax
 * - 'select_nonexistent': SELECT from a non-existent table (after a valid CREATE)
 *
 * All strategies first create a valid table (to verify rollback removes it),
 * then include a statement guaranteed to fail.
 */
const arbFailStrategy = fc.constantFrom(
  'insert_nonexistent',
  'syntax_error',
  'select_nonexistent',
);

/**
 * Generate a set of valid "good" migrations followed by one that fails.
 *
 * Structure:
 * - 0 to 3 valid CREATE TABLE migrations (pre-existing DB state)
 * - 1 migration with SQL that will error mid-execution
 */
const arbMigrationScenario = fc
  .record({
    goodCount: fc.integer({ min: 0, max: 3 }),
    failId: arbIdentifier,
    failStrategy: arbFailStrategy,
  })
  .map(({ goodCount, failId, failStrategy }) => {
    // Build good migrations with unique table names
    const goodMigrations = [];
    const goodTableNames = [];
    for (let i = 0; i < goodCount; i++) {
      const tableName = `good_${i}`;
      const upSql = `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value TEXT NOT NULL)`;
      goodMigrations.push({
        version: i + 1,
        name: `create_${tableName}`,
        up: upSql,
        down: `DROP TABLE IF EXISTS ${tableName}`,
        checksum: computeChecksum(upSql),
      });
      goodTableNames.push(tableName);
    }

    // Build the failing migration — always creates a table then fails
    const failTableName = `fail_${failId}`;
    const baseVersion = goodCount + 1;
    let failUpSql;

    switch (failStrategy) {
      case 'insert_nonexistent':
        // Valid CREATE followed by INSERT into non-existent table
        failUpSql = `CREATE TABLE ${failTableName} (id INTEGER PRIMARY KEY, name TEXT);\nINSERT INTO __nonexistent_xyz__ (col) VALUES ('boom')`;
        break;
      case 'syntax_error':
        // Valid CREATE followed by syntactically broken SQL
        failUpSql = `CREATE TABLE ${failTableName} (id INTEGER PRIMARY KEY, name TEXT);\nSELECT FROM WHERE INVALID GIBBERISH @#$`;
        break;
      case 'select_nonexistent':
        // Valid CREATE followed by CREATE TABLE that references non-existent table in CHECK
        failUpSql = `CREATE TABLE ${failTableName} (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE __ref_${failId}__ (id INTEGER PRIMARY KEY, fk INTEGER REFERENCES __nonexist__(id));\nINSERT INTO __nonexist__ VALUES (1)`;
        break;
      default:
        failUpSql = `CREATE TABLE ${failTableName} (id INTEGER PRIMARY KEY);\nINSERT INTO __nonexist__ (x) VALUES (1)`;
    }

    const failMigration = {
      version: baseVersion,
      name: `failing_migration_${failId}`,
      up: failUpSql,
      down: `DROP TABLE IF EXISTS ${failTableName}`,
      checksum: computeChecksum(failUpSql),
    };

    return {
      goodMigrations,
      failMigration,
      allMigrations: [...goodMigrations, failMigration],
      goodTableNames,
      failTableName,
    };
  });

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 20: Failed Migration Transaction Atomicity', () => {
  it('if up script errors, entire transaction rolls back, DB stays at previous version', async () => {
    await fc.assert(
      fc.asyncProperty(arbMigrationScenario, async (scenario) => {
        const db = new Database(':memory:');
        const adapter = createSqliteMigrationAdapter(db);

        // Initialize the metadata table first
        await adapter.ensureMetadataTable();

        // Apply good migrations to establish baseline state
        if (scenario.goodMigrations.length > 0) {
          const goodEngine = createMigrationEngine(adapter, scenario.goodMigrations);
          await goodEngine.applyPending();
        }

        // Record DB state before attempting the failing migration
        const appliedBefore = db
          .prepare('SELECT version FROM _migrations WHERE rolled_back = 0 ORDER BY version ASC')
          .all()
          .map((r) => r.version);

        const tablesBefore = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '\\_%' ESCAPE '\\'")
          .all()
          .map((r) => r.name)
          .sort();

        // Attempt to apply all migrations including the failing one
        const fullEngine = createMigrationEngine(adapter, scenario.allMigrations);

        let error = null;
        try {
          await fullEngine.applyPending();
        } catch (e) {
          error = e;
        }

        // The failing migration MUST produce an error
        expect(error).not.toBeNull();

        // The failing table must NOT exist in the database
        const failTableExists = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
          .get(scenario.failTableName);
        expect(failTableExists).toBeUndefined();

        // No metadata record for the failed migration
        const failRecord = db
          .prepare('SELECT * FROM _migrations WHERE version = ?')
          .get(scenario.failMigration.version);
        expect(failRecord).toBeUndefined();

        // Applied migrations list unchanged
        const appliedAfter = db
          .prepare('SELECT version FROM _migrations WHERE rolled_back = 0 ORDER BY version ASC')
          .all()
          .map((r) => r.version);
        expect(appliedAfter).toEqual(appliedBefore);

        // User tables unchanged
        const tablesAfter = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '\\_%' ESCAPE '\\'")
          .all()
          .map((r) => r.name)
          .sort();
        expect(tablesAfter).toEqual(tablesBefore);

        db.close();
      }),
      { numRuns: 100 },
    );
  });

  it('previously applied migrations remain intact when a later migration fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbMigrationScenario.filter((s) => s.goodMigrations.length > 0),
        async (scenario) => {
          const db = new Database(':memory:');
          const adapter = createSqliteMigrationAdapter(db);
          await adapter.ensureMetadataTable();

          // Apply good migrations first
          const goodEngine = createMigrationEngine(adapter, scenario.goodMigrations);
          await goodEngine.applyPending();

          // Verify good tables exist
          for (const tableName of scenario.goodTableNames) {
            const exists = db
              .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
              .get(tableName);
            expect(exists).toBeDefined();
          }

          // Attempt full set including failing migration
          const fullEngine = createMigrationEngine(adapter, scenario.allMigrations);
          try {
            await fullEngine.applyPending();
          } catch {
            // Expected to fail
          }

          // Good tables should still exist
          for (const tableName of scenario.goodTableNames) {
            const exists = db
              .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
              .get(tableName);
            expect(exists).toBeDefined();
            expect(exists.name).toBe(tableName);
          }

          // Good migration metadata should remain recorded
          for (const migration of scenario.goodMigrations) {
            const record = db
              .prepare('SELECT * FROM _migrations WHERE version = ? AND rolled_back = 0')
              .get(migration.version);
            expect(record).toBeDefined();
            expect(record.name).toBe(migration.name);
          }

          db.close();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('database version stays at last successfully applied migration after failure', async () => {
    await fc.assert(
      fc.asyncProperty(arbMigrationScenario, async (scenario) => {
        const db = new Database(':memory:');
        const adapter = createSqliteMigrationAdapter(db);
        await adapter.ensureMetadataTable();

        // Apply good migrations
        if (scenario.goodMigrations.length > 0) {
          const goodEngine = createMigrationEngine(adapter, scenario.goodMigrations);
          await goodEngine.applyPending();
        }

        // Attempt full set including failing migration
        const fullEngine = createMigrationEngine(adapter, scenario.allMigrations);
        try {
          await fullEngine.applyPending();
        } catch {
          // Expected
        }

        // The highest applied version should be the last good migration (or none)
        const maxVersionRow = db
          .prepare('SELECT MAX(version) as max_version FROM _migrations WHERE rolled_back = 0')
          .get();

        if (scenario.goodMigrations.length === 0) {
          expect(maxVersionRow.max_version).toBeNull();
        } else {
          const expectedMaxVersion =
            scenario.goodMigrations[scenario.goodMigrations.length - 1].version;
          expect(maxVersionRow.max_version).toBe(expectedMaxVersion);
        }

        db.close();
      }),
      { numRuns: 100 },
    );
  });
});
