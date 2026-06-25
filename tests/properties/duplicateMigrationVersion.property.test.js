/**
 * Property Test: Duplicate Migration Version Rejection (Property 21)
 *
 * Feature: system-redesign-2026, Property 21: Duplicate Migration Version Rejection
 *
 * If two or more migration files share a version number, validate() SHALL return
 * { valid: false } with an error message identifying the duplicate version.
 *
 * **Validates: Requirements 12.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createMigrationEngine,
  computeChecksum,
} from '../../server-v4/src/migration/migrationEngine.ts';

/**
 * Create a no-op adapter stub — validate() only inspects the migrations array
 * and doesn't call any adapter methods, so these are never reached.
 */
function createStubAdapter() {
  return {
    async ensureMetadataTable() {},
    async runInTransaction() {},
    async getAppliedMigrations() {
      return [];
    },
    async recordApplied() {},
    async markRolledBack() {},
  };
}

/**
 * Helper: build a valid MigrationFile with correct checksum.
 */
function makeMigration(version, name) {
  const up = `CREATE TABLE t_${name}_v${version} (id INT);`;
  const down = `DROP TABLE t_${name}_v${version};`;
  return {
    version,
    name,
    up,
    down,
    checksum: computeChecksum(up),
  };
}

describe('Property 21: Duplicate Migration Version Rejection', () => {
  it('validate() returns valid=false with duplicate version error when migrations share a version number', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a list of 2-20 migration entries where at least 2 share the same version
        fc.integer({ min: 1, max: 9999 }).chain((duplicateVersion) =>
          fc.tuple(
            fc.constant(duplicateVersion),
            // Number of duplicates for the chosen version (2-5)
            fc.integer({ min: 2, max: 5 }),
            // Additional unique versions (0-10)
            fc.array(
              fc.integer({ min: 1, max: 9999 }).filter((v) => v !== duplicateVersion),
              { minLength: 0, maxLength: 10 }
            ),
          )
        ),
        async ([duplicateVersion, dupCount, otherVersions]) => {
          // Build migration files: multiple entries with the duplicate version
          const migrations = [];

          // Add the duplicate entries
          for (let i = 0; i < dupCount; i++) {
            migrations.push(
              makeMigration(duplicateVersion, `dup_${i}`)
            );
          }

          // Add unique-version entries (deduplicate the otherVersions array)
          const uniqueOthers = [...new Set(otherVersions)];
          for (const v of uniqueOthers) {
            migrations.push(makeMigration(v, `unique_${v}`));
          }

          // Shuffle to ensure order doesn't matter
          for (let i = migrations.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [migrations[i], migrations[j]] = [migrations[j], migrations[i]];
          }

          const engine = createMigrationEngine(createStubAdapter(), migrations);
          const result = await engine.validate();

          // Must be invalid
          expect(result.valid).toBe(false);

          // Errors array must mention the duplicate version
          expect(result.errors.length).toBeGreaterThan(0);

          const hasDuplicateError = result.errors.some(
            (err) =>
              err.includes('Duplicate') &&
              err.includes(String(duplicateVersion))
          );
          expect(hasDuplicateError).toBe(true);
        }
      ),
      { numRuns: 100 },
    );
  });

  it('validate() returns valid=true when all migration versions are distinct', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1-20 distinct version numbers
        fc.uniqueArray(fc.integer({ min: 1, max: 9999 }), { minLength: 1, maxLength: 20 }),
        async (versions) => {
          const migrations = versions.map((v, i) =>
            makeMigration(v, `migration_${i}`)
          );

          const engine = createMigrationEngine(createStubAdapter(), migrations);
          const result = await engine.validate();

          // Should be valid (no duplicate versions, checksums are correct)
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 },
    );
  });

  it('validate() detects multiple different duplicate versions simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-5 distinct versions to duplicate
        fc.uniqueArray(fc.integer({ min: 1, max: 9999 }), { minLength: 2, maxLength: 5 }),
        async (duplicateVersions) => {
          const migrations = [];

          // Each version appears exactly 2 times
          for (const v of duplicateVersions) {
            migrations.push(makeMigration(v, `first_${v}`));
            migrations.push(makeMigration(v, `second_${v}`));
          }

          const engine = createMigrationEngine(createStubAdapter(), migrations);
          const result = await engine.validate();

          expect(result.valid).toBe(false);

          // Each duplicate version should appear in the errors
          for (const v of duplicateVersions) {
            const mentioned = result.errors.some(
              (err) => err.includes(String(v))
            );
            expect(mentioned).toBe(true);
          }
        }
      ),
      { numRuns: 100 },
    );
  });
});
