/**
 * Property Test: Schema Migration Sequential Ordering (Property 18)
 *
 * Feature: system-redesign-2026, Property 18: Schema Migration Sequential Ordering
 *
 * For any set of pending migration files with distinct version numbers,
 * applyPending() SHALL apply them in strictly ascending version order,
 * and the metadata table SHALL reflect this ordering in applied_at timestamps.
 *
 * **Validates: Requirements 12.2**
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
 * Generate a simple CREATE TABLE / DROP TABLE migration pair
 * for a given version and table name.
 */
function makeMigration(version: number, tableName: string): MigrationFile {
  const up = `CREATE TABLE IF NOT EXISTS ${tableName} (id INTEGER PRIMARY KEY, value TEXT)`;
  const down = `DROP TABLE IF EXISTS ${tableName}`;
  return {
    version,
    name: `create_${tableName}`,
    up,
    down,
    checksum: computeChecksum(up),
  };
}

describe('Property 18: Schema Migration Sequential Ordering', () => {
  it('applyPending applies migrations in strictly ascending version order for any shuffled set', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-10 unique version numbers (positive integers)
        fc.set(fc.integer({ min: 1, max: 10000 }), { minLength: 2, maxLength: 10 }).map(
          (versions) => {
            // Shuffle the versions to simulate random file ordering
            const shuffled = [...versions].sort(() => Math.random() - 0.5);
            return shuffled.map((v, idx) => makeMigration(v, `tbl_${v}_${idx}`));
          },
        ),
        async (migrations: MigrationFile[]) => {
          const db = new Database(':memory:');
          const adapter = createSqliteMigrationAdapter(db);
          const engine = createMigrationEngine(adapter, migrations);

          // Apply all pending migrations
          const applied = await engine.applyPending();

          // Should have applied exactly as many migrations as provided
          expect(applied).toHaveLength(migrations.length);

          // Verify strictly ascending version order
          for (let i = 1; i < applied.length; i++) {
            expect(applied[i]!.version).toBeGreaterThan(applied[i - 1]!.version);
          }

          // Verify the versions in the returned metadata are sorted ascending
          const returnedVersions = applied.map((m) => m.version);
          const sortedVersions = [...returnedVersions].sort((a, b) => a - b);
          expect(returnedVersions).toEqual(sortedVersions);

          // Verify the _migrations table also reflects ascending order
          const rows = db
            .prepare('SELECT version, applied_at FROM _migrations ORDER BY version ASC')
            .all() as Array<{ version: number; applied_at: string }>;

          expect(rows).toHaveLength(migrations.length);

          // Versions in the table should be in ascending order
          for (let i = 1; i < rows.length; i++) {
            expect(rows[i]!.version).toBeGreaterThan(rows[i - 1]!.version);
          }

          // applied_at timestamps should be non-decreasing (ascending application order)
          for (let i = 1; i < rows.length; i++) {
            const prevTime = new Date(rows[i - 1]!.applied_at).getTime();
            const currTime = new Date(rows[i]!.applied_at).getTime();
            expect(currTime).toBeGreaterThanOrEqual(prevTime);
          }

          db.close();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('applyPending result versions match the sorted input versions regardless of input order', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-10 unique version numbers with guaranteed shuffling
        fc.set(fc.integer({ min: 1, max: 50000 }), { minLength: 2, maxLength: 10 }),
        fc.infiniteStream(fc.boolean()),
        async (versions: number[], shuffleStream) => {
          // Fisher-Yates shuffle using the boolean stream for determinism
          const shuffled = [...versions];
          const streamIter = shuffleStream[Symbol.iterator]();
          for (let i = shuffled.length - 1; i > 0; i--) {
            // Use stream booleans to decide swap index deterministically
            let j = 0;
            for (let b = 0; b < Math.ceil(Math.log2(i + 1)); b++) {
              const bit = streamIter.next().value ? 1 : 0;
              j = (j << 1) | bit;
            }
            j = j % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
          }

          const migrations = shuffled.map((v, idx) =>
            makeMigration(v, `seq_${v}_${idx}`),
          );

          const db = new Database(':memory:');
          const adapter = createSqliteMigrationAdapter(db);
          const engine = createMigrationEngine(adapter, migrations);

          const applied = await engine.applyPending();

          // The applied versions should exactly equal the sorted unique versions
          const appliedVersions = applied.map((m) => m.version);
          const expectedVersions = [...versions].sort((a, b) => a - b);
          expect(appliedVersions).toEqual(expectedVersions);

          db.close();
        },
      ),
      { numRuns: 100 },
    );
  });
});
