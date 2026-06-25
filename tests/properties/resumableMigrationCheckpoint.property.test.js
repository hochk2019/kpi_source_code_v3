import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';

import { createDataMigrator } from '../../server-v4/src/migration/dataMigrator.ts';

/**
 * Property 17: Resumable Migration Checkpoint
 *
 * After interruption at table K, resumeFrom skips 1..K and result equals
 * uninterrupted migration.
 *
 * Feature: system-redesign-2026, Property 17: Resumable Migration Checkpoint
 * Validates: Requirements 11.4
 */

// ─── Mock PostgreSQL Pool ──────────────────────────────────────────────────

function createMockPgPool() {
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

/**
 * Collect data-bearing user tables from a mock PG pool (excluding internal tables).
 */
function getUserTablesFromPg(pgPool) {
  const result = {};
  for (const [name, rows] of pgPool._tables.entries()) {
    if (name.startsWith('_')) continue;
    result[name] = rows;
  }
  return result;
}

// ─── Arbitrary Generators ──────────────────────────────────────────────────

const arbColumnType = fc.constantFrom('TEXT', 'INTEGER');

const arbColumnName = fc
  .tuple(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'),
    fc.array(fc.constantFrom('a', 'b', 'c', '1', '2', '_'), { minLength: 1, maxLength: 4 }),
  )
  .map(([first, rest]) => first + rest.join(''));

const arbColumn = fc
  .tuple(arbColumnName, arbColumnType)
  .map(([name, type]) => ({ name, type }));

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
      const name = `col_${unique.length}`;
      if (!seen.has(name)) {
        seen.add(name);
        unique.push({ name, type: 'TEXT' });
      }
    }
    return unique;
  });

function arbValueForType(type) {
  if (type === 'INTEGER') {
    return fc.integer({ min: -10000, max: 10000 });
  }
  return fc.string({ minLength: 0, maxLength: 20 }).filter((s) => !s.includes('\0'));
}

function arbRowsForColumns(columns, minRows = 1, maxRows = 8) {
  const arbRow = fc.record(
    Object.fromEntries(columns.map((col) => [col.name, arbValueForType(col.type)])),
  );
  return fc.array(arbRow, { minLength: minRows, maxLength: maxRows });
}

/**
 * Generate a table schema with columns and rows.
 */
function arbTableSchema(tableName) {
  return arbColumns.chain((columns) =>
    arbRowsForColumns(columns, 1, 8).map((rows) => ({
      name: tableName,
      columns,
      rows,
    })),
  );
}

/**
 * Generate a complete test scenario:
 * - 2-5 tables with distinct sorted names
 * - A checkpoint index K (0 to tableCount-2)
 * - Schema and data for each table
 */
const arbMigrationScenario = fc
  .integer({ min: 2, max: 5 })
  .chain((tableCount) => {
    // Generate deterministic, unique sorted table names
    // Use a fixed naming scheme to ensure uniqueness
    const tableNames = [];
    for (let i = 0; i < tableCount; i++) {
      tableNames.push(`tbl_${String(i).padStart(2, '0')}`);
    }
    tableNames.sort();

    // Generate checkpoint index (0 to tableCount-2, last table can't be checkpoint)
    return fc
      .integer({ min: 0, max: tableCount - 2 })
      .chain((checkpointIndex) => {
        // Generate schemas for all tables
        const schemaArbs = tableNames.map((name) => arbTableSchema(name));
        return fc.tuple(...schemaArbs).map((schemas) => ({
          tableNames,
          checkpointIndex,
          checkpointTable: tableNames[checkpointIndex],
          schemas,
        }));
      });
  });

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 17: Resumable Migration Checkpoint', () => {
  it('after interruption at table K, resumeFrom skips 1..K and result equals uninterrupted migration', () => {
    fc.assert(
      fc.asyncProperty(
        arbMigrationScenario,
        async ({ tableNames, checkpointIndex, checkpointTable, schemas }) => {
          // ─── Run 1: Full uninterrupted migration ──────────────────────
          const dbFull = new Database(':memory:');
          try {
            for (const schema of schemas) {
              seedSqliteTable(dbFull, schema.name, schema.columns, schema.rows);
            }

            const pgPoolFull = createMockPgPool();
            const migratorFull = createDataMigrator({
              sqliteDb: dbFull,
              pgPool: pgPoolFull,
              isOffline: () => true,
            });

            const fullReport = await migratorFull.migrate();
            expect(fullReport.overallStatus).toBe('success');

            // Collect final state from full migration
            const fullPgData = getUserTablesFromPg(pgPoolFull);

            // ─── Run 2: Resumed migration from checkpoint K ───────────────
            const dbResumed = new Database(':memory:');
            try {
              for (const schema of schemas) {
                seedSqliteTable(dbResumed, schema.name, schema.columns, schema.rows);
              }

              const pgPoolResumed = createMockPgPool();

              // Pre-seed PG with tables 0..K (simulating they were already
              // migrated before interruption)
              for (let i = 0; i <= checkpointIndex; i++) {
                const schema = schemas[i];
                pgPoolResumed._tables.set(
                  schema.name,
                  schema.rows.map((row) => {
                    const normalized = {};
                    for (const col of schema.columns) {
                      normalized[col.name] = row[col.name] === undefined ? null : row[col.name];
                    }
                    return normalized;
                  }),
                );
              }

              const migratorResumed = createDataMigrator({
                sqliteDb: dbResumed,
                pgPool: pgPoolResumed,
                isOffline: () => true,
              });

              const resumedReport = await migratorResumed.migrate({ resumeFrom: checkpointTable });

              // Resumed migration should succeed
              expect(resumedReport.overallStatus).toBe('success');

              // Only tables AFTER checkpoint should be in the report
              const expectedResumedCount = tableNames.length - checkpointIndex - 1;
              expect(resumedReport.tables).toHaveLength(expectedResumedCount);

              // Verify resumed report only contains tables after checkpoint
              for (const tableResult of resumedReport.tables) {
                const idx = tableNames.indexOf(tableResult.tableName);
                expect(idx).toBeGreaterThan(checkpointIndex);
              }

              // Collect final state from resumed migration
              const resumedPgData = getUserTablesFromPg(pgPoolResumed);

              // ─── Compare: both runs produce same final PG state ─────────
              const fullTableNamesSorted = Object.keys(fullPgData).sort();
              const resumedTableNamesSorted = Object.keys(resumedPgData).sort();
              expect(resumedTableNamesSorted).toEqual(fullTableNamesSorted);

              for (const tableName of fullTableNamesSorted) {
                const fullRows = fullPgData[tableName] || [];
                const resumedRows = resumedPgData[tableName] || [];

                // Same row count
                expect(resumedRows.length).toBe(fullRows.length);

                // Sort rows for deterministic comparison
                const sortKey = (r) => JSON.stringify(r, Object.keys(r).sort());
                const sortedFull = [...fullRows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
                const sortedResumed = [...resumedRows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

                expect(sortedResumed).toEqual(sortedFull);
              }
            } finally {
              dbResumed.close();
            }
          } finally {
            dbFull.close();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
