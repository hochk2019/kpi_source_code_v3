import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';

import {
  createDataMigrator,
} from '../../server-v4/src/migration/dataMigrator.ts';

/**
 * Property 16: Migration Rollback Atomicity
 *
 * On verification failure at table N, PostgreSQL is left in pre-migration state
 * (no partial data from tables 1..N-1 persisted).
 *
 * Feature: system-redesign-2026, Property 16: Migration Rollback Atomicity
 * Validates: Requirements 11.3
 */

// ─── Mock PostgreSQL Pool with Verification Sabotage ───────────────────────

/**
 * Creates a mock PG pool that sabotages verification for a specific table.
 * When verifyTable reads from the sabotaged table, it returns data with a
 * different row count to trigger a verification failure (row count mismatch).
 */
function createMockPgPool(failOnTable) {
  const tables = new Map();
  /**
   * Track whether a table has been fully committed (INSERT phase done).
   * The verification read happens AFTER the INSERT transaction is committed.
   */
  const committedTables = new Set();
  /** Track current transaction state to detect when commit happens */
  let inTransaction = false;
  let currentTransactionTable = null;

  function parseCreateTable(sql) {
    const match = sql.match(/CREATE TABLE IF NOT EXISTS "([^"]+)"/);
    if (match) {
      const name = match[1];
      if (!tables.has(name)) {
        tables.set(name, []);
      }
    }
  }

  function parseDropTable(sql) {
    const match = sql.match(/DROP TABLE IF EXISTS "([^"]+)"/);
    if (match) {
      tables.delete(match[1]);
    }
  }

  function parseInsert(sql, values) {
    const match = sql.match(/INSERT INTO "([^"]+)"\s*\(([^)]+)\)\s*VALUES/);
    if (match) {
      const tableName = match[1];
      const cols = match[2].split(',').map((c) => c.trim().replace(/"/g, ''));
      const row = {};
      cols.forEach((col, i) => {
        row[col] = values[i];
      });
      if (!tables.has(tableName)) {
        tables.set(tableName, []);
      }
      tables.get(tableName).push(row);
      if (inTransaction) {
        currentTransactionTable = tableName;
      }
    }
  }

  function parseUpsert(sql, values) {
    const match = sql.match(/INSERT INTO "([^"]+)"/);
    if (match) {
      const tableName = match[1];
      if (!tables.has(tableName)) {
        tables.set(tableName, []);
      }
      const existing = tables.get(tableName);
      if (sql.includes('ON CONFLICT')) {
        const filtered = existing.filter((r) => r.id !== 1);
        filtered.push({ id: 1, last_completed_table: values[0], updated_at: new Date().toISOString() });
        tables.set(tableName, filtered);
      } else {
        parseInsert(sql, values);
      }
    }
  }

  function parseSelect(sql) {
    const match = sql.match(/SELECT .+ FROM "([^"]+)"/);
    if (match) {
      const tableName = match[1];

      // If this is the sabotage target and it has been committed,
      // return corrupted data (extra row) to cause row count mismatch
      if (tableName === failOnTable && committedTables.has(tableName)) {
        const realRows = tables.get(tableName) || [];
        // Add an extra row to cause row count mismatch with source
        return [...realRows, { _extra_corrupt: true }];
      }

      return tables.get(tableName) || [];
    }
    return [];
  }

  function parseDelete(sql) {
    const match = sql.match(/DELETE FROM "([^"]+)"/);
    if (match) {
      tables.set(match[1], []);
    }
  }

  const mockClient = {
    query: async (sql, values) => {
      const trimmed = sql.trim().toUpperCase();

      if (trimmed.startsWith('BEGIN')) {
        inTransaction = true;
        currentTransactionTable = null;
        return { rows: [] };
      }
      if (trimmed.startsWith('COMMIT')) {
        if (currentTransactionTable) {
          committedTables.add(currentTransactionTable);
        }
        inTransaction = false;
        currentTransactionTable = null;
        return { rows: [] };
      }
      if (trimmed.startsWith('ROLLBACK')) {
        inTransaction = false;
        currentTransactionTable = null;
        return { rows: [] };
      }
      if (trimmed.startsWith('CREATE TABLE')) {
        parseCreateTable(sql);
        return { rows: [] };
      }
      if (trimmed.startsWith('DROP TABLE')) {
        parseDropTable(sql);
        return { rows: [] };
      }
      if (trimmed.startsWith('INSERT')) {
        if (sql.includes('ON CONFLICT')) {
          parseUpsert(sql, values);
        } else {
          parseInsert(sql, values);
        }
        return { rows: [] };
      }
      if (trimmed.startsWith('SELECT')) {
        return { rows: parseSelect(sql) };
      }
      if (trimmed.startsWith('DELETE')) {
        parseDelete(sql);
        return { rows: [] };
      }
      return { rows: [] };
    },
    release: () => {},
  };

  const pool = {
    query: async (sql, values) => mockClient.query(sql, values),
    connect: async () => mockClient,
    _tables: tables,
    _committedTables: committedTables,
  };

  return pool;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function seedSqliteTable(db, tableName, columns, rows) {
  const colDefs = columns.map((c) => `"${c.name}" ${c.type}`).join(', ');
  db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs})`);

  if (rows.length > 0) {
    const colNames = columns.map((c) => `"${c.name}"`).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`);

    for (const row of rows) {
      const values = columns.map((c) => row[c.name] ?? null);
      stmt.run(...values);
    }
  }
}

// ─── Arbitrary Generators ──────────────────────────────────────────────────

/**
 * Generate a valid table name prefix.
 */
const arbTablePrefix = fc.constantFrom(
  'tbl', 'data', 'records', 'items', 'entries', 'docs', 'store', 'logs', 'events',
);

/**
 * Generate a table name with guaranteed uniqueness via suffix.
 */
function makeTableName(prefix, index) {
  return `${prefix}_${index}`;
}

/**
 * Generate a column definition (name + type).
 */
const arbColumnType = fc.constantFrom('TEXT', 'INTEGER');

const arbColumn = fc
  .tuple(
    fc.constantFrom('col_a', 'col_b', 'col_c', 'col_d', 'col_e'),
    arbColumnType,
  )
  .map(([name, type]) => ({ name, type }));

/**
 * Generate 2-4 unique columns for a table.
 */
const arbColumns = fc
  .array(arbColumn, { minLength: 2, maxLength: 4 })
  .map((cols) => {
    const seen = new Set();
    const unique = [];
    for (const col of cols) {
      if (!seen.has(col.name)) {
        seen.add(col.name);
        unique.push(col);
      }
    }
    while (unique.length < 2) {
      const name = `col_x${unique.length}`;
      unique.push({ name, type: 'TEXT' });
    }
    return unique;
  });

/**
 * Generate a row value appropriate for a given column type.
 */
function arbValueForType(type) {
  if (type === 'INTEGER') {
    return fc.integer({ min: -10000, max: 10000 });
  }
  return fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('\0'));
}

/**
 * Generate rows matching a given column schema.
 */
function arbRows(columns, minRows = 1, maxRows = 10) {
  const arbRow = fc.record(
    Object.fromEntries(columns.map((col) => [col.name, arbValueForType(col.type)])),
  );
  return fc.array(arbRow, { minLength: minRows, maxLength: maxRows });
}

/**
 * Generate a multi-table scenario: 2-4 tables, each with columns and rows.
 * Also picks which table index will fail verification.
 */
const arbMultiTableScenario = fc
  .integer({ min: 2, max: 4 })
  .chain((tableCount) =>
    fc.tuple(
      fc.constant(tableCount),
      fc.array(arbTablePrefix, { minLength: tableCount, maxLength: tableCount }),
      fc.array(arbColumns, { minLength: tableCount, maxLength: tableCount }),
      fc.array(fc.integer({ min: 1, max: 8 }), { minLength: tableCount, maxLength: tableCount }),
      // Which table index (0-based) will fail verification
      fc.integer({ min: 0, max: tableCount - 1 }),
    ),
  );

// ─── Property Test ─────────────────────────────────────────────────────────

describe('Property 16: Migration Rollback Atomicity', () => {
  it('on verification failure at table N, PostgreSQL has no partial migration data', () => {
    fc.assert(
      fc.asyncProperty(
        arbMultiTableScenario,
        async ([tableCount, prefixes, columnSets, rowCounts, failIndex]) => {
          const db = new Database(':memory:');
          try {
            // Build unique table names
            const tableNames = [];
            const usedNames = new Set();
            for (let i = 0; i < tableCount; i++) {
              let name = makeTableName(prefixes[i], i);
              while (usedNames.has(name)) {
                name = `${name}_x`;
              }
              usedNames.add(name);
              tableNames.push(name);
            }

            // Tables are sorted alphabetically by listSqliteTables
            tableNames.sort();

            const failTableName = tableNames[failIndex];

            // Seed SQLite with tables
            const tableData = [];
            for (let i = 0; i < tableCount; i++) {
              const columns = columnSets[i];
              const rows = fc.sample(arbRows(columns, rowCounts[i], rowCounts[i]), 1)[0];
              seedSqliteTable(db, tableNames[i], columns, rows);
              tableData.push({ name: tableNames[i], columns, rows });
            }

            // Create mock PG pool that will sabotage verification on failTableName
            const pgPool = createMockPgPool(failTableName);

            const migrator = createDataMigrator({
              sqliteDb: db,
              pgPool,
              isOffline: () => true,
            });

            const report = await migrator.migrate();

            // Migration MUST fail due to verification error on failTableName
            expect(report.overallStatus).toBe('failed');
            expect(report.failedTable).toBe(failTableName);

            // CRITICAL PROPERTY: After rollback, no migrated user data tables
            // should remain in PostgreSQL. Only internal tables
            // (_data_migration_checkpoint) may exist.
            const internalTables = new Set(['_data_migration_checkpoint']);
            for (const tableName of tableNames) {
              const pgRows = pgPool._tables.get(tableName);
              // Table should either not exist or be empty (dropped during rollback)
              const exists = pgPool._tables.has(tableName);
              if (exists) {
                expect(pgRows).toEqual([]);
              }
            }

            // Verify no partial data leaked: no user table should have rows
            for (const [tblName, rows] of pgPool._tables.entries()) {
              if (!internalTables.has(tblName)) {
                expect(rows).toEqual([]);
              }
            }
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
