import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';

import {
  createDataMigrator,
} from '../../server-v4/src/migration/dataMigrator.ts';

/**
 * Property 15: Migration Data Integrity Round-Trip
 *
 * After successful migration, PostgreSQL contains exactly the same rows as SQLite source.
 *
 * Feature: system-redesign-2026, Property 15: Migration Data Integrity Round-Trip
 * Validates: Requirements 11.1, 11.2
 */

// ─── Mock PostgreSQL Pool ──────────────────────────────────────────────────

function createMockPgPool() {
  /** In-memory storage for the mock PG */
  const tables = new Map();

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

      if (trimmed.startsWith('BEGIN') || trimmed.startsWith('COMMIT') || trimmed.startsWith('ROLLBACK')) {
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
 * Generate a valid SQL identifier (column/table name).
 * Starts with a letter, followed by letters/digits/underscores.
 */
const arbIdentifier = fc
  .tuple(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'),
    fc.array(fc.constantFrom('a', 'b', 'c', 'd', '1', '2', '3', '_'), { minLength: 1, maxLength: 8 }),
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a column definition (name + type).
 * Types are constrained to TEXT and INTEGER — the two types that survive
 * SQLite → mock PG round-trip cleanly.
 */
const arbColumnType = fc.constantFrom('TEXT', 'INTEGER');

const arbColumn = fc.tuple(arbIdentifier, arbColumnType).map(([name, type]) => ({ name, type }));

/**
 * Generate 2-5 unique columns for a table.
 */
const arbColumns = fc
  .array(arbColumn, { minLength: 2, maxLength: 5 })
  .map((cols) => {
    // Ensure unique column names
    const seen = new Set();
    const unique = [];
    for (const col of cols) {
      if (!seen.has(col.name)) {
        seen.add(col.name);
        unique.push(col);
      }
    }
    // Pad to minimum 2 if dedup reduced below minimum
    while (unique.length < 2) {
      const name = `col_${unique.length}`;
      if (!seen.has(name)) {
        seen.add(name);
        unique.push({ name, type: 'TEXT' });
      }
    }
    return unique;
  });

/**
 * Generate a row value appropriate for a given column type.
 */
function arbValueForType(type) {
  if (type === 'INTEGER') {
    return fc.integer({ min: -100000, max: 100000 });
  }
  // TEXT
  return fc.string({ minLength: 0, maxLength: 50 }).filter((s) => !s.includes('\0'));
}

/**
 * Generate rows matching a given column schema.
 */
function arbRows(columns, minRows = 1, maxRows = 20) {
  const arbRow = fc.record(
    Object.fromEntries(columns.map((col) => [col.name, arbValueForType(col.type)])),
  );
  return fc.array(arbRow, { minLength: minRows, maxLength: maxRows });
}

/**
 * Generate a valid table name that doesn't conflict with SQLite internals
 * or the _migrations metadata table.
 */
const arbTableName = fc
  .tuple(
    fc.constantFrom('tbl', 'data', 'records', 'items', 'entries', 'docs', 'store'),
    fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 1, maxLength: 3 }),
  )
  .map(([prefix, suffix]) => `${prefix}_${suffix.join('')}`);

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 15: Migration Data Integrity Round-Trip', () => {
  it('after successful migration, PostgreSQL contains exactly the same rows as SQLite source', () => {
    fc.assert(
      fc.asyncProperty(
        arbTableName,
        arbColumns,
        fc.integer({ min: 1, max: 20 }),
        async (tableName, columns, rowCount) => {
          // Generate rows based on the chosen columns
          const rows = fc.sample(arbRows(columns, rowCount, rowCount), 1)[0];

          // Setup in-memory SQLite
          const db = new Database(':memory:');
          try {
            seedSqliteTable(db, tableName, columns, rows);

            // Setup mock PG pool
            const pgPool = createMockPgPool();

            // Create migrator and run migration
            const migrator = createDataMigrator({
              sqliteDb: db,
              pgPool,
              isOffline: () => true,
            });

            const report = await migrator.migrate();

            // Migration must succeed
            expect(report.overallStatus).toBe('success');
            expect(report.tables).toHaveLength(1);
            expect(report.tables[0].tableName).toBe(tableName);
            expect(report.tables[0].verified).toBe(true);

            // Verify row count matches
            expect(report.tables[0].sourceRowCount).toBe(rows.length);
            expect(report.tables[0].destinationRowCount).toBe(rows.length);

            // Verify mock PG received exactly the same rows
            const pgRows = pgPool._tables.get(tableName) || [];
            expect(pgRows).toHaveLength(rows.length);

            // Compare row contents: sort both sets for deterministic comparison
            const sortKey = (r) => JSON.stringify(r, columns.map((c) => c.name).sort());
            const sortedSource = [...rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
            const sortedDest = [...pgRows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

            for (let i = 0; i < sortedSource.length; i++) {
              for (const col of columns) {
                const srcVal = sortedSource[i][col.name];
                const dstVal = sortedDest[i][col.name];
                // Values should be equal (null-safe)
                expect(dstVal).toEqual(srcVal === undefined ? null : srcVal);
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

  it('migration preserves data integrity across multiple tables', () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 4 }),
        async (tableCount) => {
          const db = new Database(':memory:');
          try {
            // Generate unique table names and schemas
            const tableNames = fc.sample(arbTableName, tableCount + 5);
            const uniqueNames = [...new Set(tableNames)].slice(0, tableCount);
            if (uniqueNames.length < 2) return; // Skip if dedup left too few

            const tableSchemas = [];
            for (const name of uniqueNames) {
              const columns = fc.sample(arbColumns, 1)[0];
              const rowCount = fc.sample(fc.integer({ min: 1, max: 10 }), 1)[0];
              const rows = fc.sample(arbRows(columns, rowCount, rowCount), 1)[0];
              seedSqliteTable(db, name, columns, rows);
              tableSchemas.push({ name, columns, rows });
            }

            const pgPool = createMockPgPool();
            const migrator = createDataMigrator({
              sqliteDb: db,
              pgPool,
              isOffline: () => true,
            });

            const report = await migrator.migrate();

            expect(report.overallStatus).toBe('success');
            expect(report.tables).toHaveLength(uniqueNames.length);

            // Verify every table has correct row count in PG
            for (const schema of tableSchemas) {
              const pgRows = pgPool._tables.get(schema.name) || [];
              expect(pgRows).toHaveLength(schema.rows.length);
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
