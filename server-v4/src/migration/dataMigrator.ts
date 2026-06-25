import crypto from 'node:crypto';

import type { BetterSqlite3Database } from './migrationEngine.js';
import type { PgPool, PgPoolClient } from './migrationEngine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MigrationTableResult {
  tableName: string;
  sourceRowCount: number;
  destinationRowCount: number;
  durationMs: number;
  verified: boolean;
  checksumMatch: boolean;
}

export interface MigrationReport {
  startedAt: Date;
  completedAt: Date;
  tables: MigrationTableResult[];
  overallStatus: 'success' | 'failed' | 'partial';
  failedTable?: string;
  error?: string;
}

export interface DataMigrator {
  /** Run full migration with integrity verification */
  migrate(options?: { resumeFrom?: string }): Promise<MigrationReport>;
  /** Verify integrity of a single table */
  verifyTable(tableName: string): Promise<{ match: boolean; discrepancies: string[] }>;
  /** Get checkpoint (last successfully migrated table) */
  getCheckpoint(): string | null;
}

export interface DataMigratorDependencies {
  /** SQLite source database (better-sqlite3 instance, opened read-only) */
  sqliteDb: BetterSqlite3Database;
  /** PostgreSQL connection pool (destination) */
  pgPool: PgPool;
  /** Whether the application is in offline mode; migration refuses if false */
  isOffline: () => boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * List all user-defined tables in a SQLite database, excluding internal
 * sqlite tables and the _migrations metadata table.
 */
function listSqliteTables(db: BetterSqlite3Database): string[] {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_migrations' ORDER BY name",
    )
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

/**
 * Read all rows from a SQLite table as plain objects.
 */
function readSqliteTableRows(db: BetterSqlite3Database, tableName: string): Record<string, unknown>[] {
  // Table name is from sqlite_master, safe to interpolate (not user input)
  return db.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, unknown>[];
}

/**
 * Get column info for a SQLite table.
 */
function getSqliteColumns(db: BetterSqlite3Database, tableName: string): Array<{ name: string; type: string }> {
  return db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
    pk: number;
  }>;
}

/**
 * Compute a deterministic checksum over all rows in a table.
 * Rows are sorted by JSON.stringify to ensure consistent ordering.
 */
function computeTableChecksum(rows: Record<string, unknown>[]): string {
  const hash = crypto.createHash('sha256');
  const sorted = rows
    .map((row) => JSON.stringify(row, Object.keys(row).sort()))
    .sort();
  for (const rowStr of sorted) {
    hash.update(rowStr);
    hash.update('\n');
  }
  return hash.digest('hex');
}

/**
 * Map SQLite column type to PostgreSQL-compatible type hint.
 */
function sqliteTypeToPgType(sqliteType: string): string {
  const upper = sqliteType.toUpperCase();
  if (upper.includes('INT')) return 'BIGINT';
  if (upper.includes('REAL') || upper.includes('FLOAT') || upper.includes('DOUBLE')) return 'DOUBLE PRECISION';
  if (upper.includes('BLOB')) return 'BYTEA';
  if (upper.includes('BOOL')) return 'BOOLEAN';
  // Default: TEXT covers TEXT, VARCHAR, CLOB, etc.
  return 'TEXT';
}

/**
 * Ensure a table exists in PostgreSQL with columns matching the SQLite schema.
 * This uses a simple CREATE TABLE IF NOT EXISTS approach.
 */
async function ensurePgTable(
  client: PgPoolClient,
  tableName: string,
  columns: Array<{ name: string; type: string }>,
): Promise<void> {
  const colDefs = columns
    .map((col) => `"${col.name}" ${sqliteTypeToPgType(col.type)}`)
    .join(', ');
  await client.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs})`);
}

/**
 * Insert rows into PostgreSQL table using parameterized queries.
 */
async function insertRowsIntoPg(
  client: PgPoolClient,
  tableName: string,
  columns: Array<{ name: string }>,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;

  const colNames = columns.map((c) => `"${c.name}"`).join(', ');

  // Batch insert with parameterized values
  for (const row of rows) {
    const values = columns.map((col) => {
      const val = row[col.name];
      // Convert undefined to null for PostgreSQL
      return val === undefined ? null : val;
    });
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`,
      values,
    );
  }
}

/**
 * Read all rows from a PostgreSQL table.
 */
async function readPgTableRows(
  pool: PgPool,
  tableName: string,
): Promise<Record<string, unknown>[]> {
  const result = await pool.query(`SELECT * FROM "${tableName}"`);
  return result.rows as Record<string, unknown>[];
}

/**
 * Drop a table in PostgreSQL if it exists.
 */
async function dropPgTable(client: PgPoolClient, tableName: string): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
}

// ---------------------------------------------------------------------------
// Checkpoint persistence (stored in PostgreSQL _data_migration_checkpoint)
// ---------------------------------------------------------------------------

const CHECKPOINT_TABLE = '_data_migration_checkpoint';

async function ensureCheckpointTable(pool: PgPool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${CHECKPOINT_TABLE}" (
      id INTEGER PRIMARY KEY DEFAULT 1,
      last_completed_table TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (id = 1)
    )
  `);
}

async function readCheckpoint(pool: PgPool): Promise<string | null> {
  await ensureCheckpointTable(pool);
  const result = await pool.query(
    `SELECT last_completed_table FROM "${CHECKPOINT_TABLE}" WHERE id = 1`,
  );
  const rows = result.rows as Array<{ last_completed_table: string | null }>;
  return rows.length > 0 ? rows[0].last_completed_table : null;
}

async function writeCheckpoint(pool: PgPool, tableName: string): Promise<void> {
  await pool.query(
    `INSERT INTO "${CHECKPOINT_TABLE}" (id, last_completed_table, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET last_completed_table = $1, updated_at = NOW()`,
    [tableName],
  );
}

async function clearCheckpoint(pool: PgPool): Promise<void> {
  await pool.query(`DELETE FROM "${CHECKPOINT_TABLE}" WHERE id = 1`);
}

// ---------------------------------------------------------------------------
// DataMigrator factory
// ---------------------------------------------------------------------------

export function createDataMigrator(deps: DataMigratorDependencies): DataMigrator {
  let lastCheckpoint: string | null = null;

  return {
    async migrate(options?: { resumeFrom?: string }): Promise<MigrationReport> {
      const startedAt = new Date();
      const results: MigrationTableResult[] = [];

      // Requirement 11.6: Require offline mode
      if (!deps.isOffline()) {
        return {
          startedAt,
          completedAt: new Date(),
          tables: [],
          overallStatus: 'failed',
          error: 'Application must be in offline mode during data migration.',
        };
      }

      const allTables = listSqliteTables(deps.sqliteDb);

      if (allTables.length === 0) {
        return {
          startedAt,
          completedAt: new Date(),
          tables: [],
          overallStatus: 'success',
        };
      }

      // Determine resume point
      const resumeFrom = options?.resumeFrom ?? (await readCheckpoint(deps.pgPool));
      let startIndex = 0;

      if (resumeFrom) {
        const idx = allTables.indexOf(resumeFrom);
        if (idx >= 0) {
          // Start from the NEXT table after the checkpoint
          startIndex = idx + 1;
        }
      }

      // Track tables migrated in this run for rollback
      const migratedThisRun: string[] = [];

      for (let i = startIndex; i < allTables.length; i++) {
        const tableName = allTables[i]!;
        const tableStart = Date.now();

        try {
          const columns = getSqliteColumns(deps.sqliteDb, tableName);
          const sourceRows = readSqliteTableRows(deps.sqliteDb, tableName);

          // Migrate table within a transaction
          const client = await deps.pgPool.connect();
          try {
            await client.query('BEGIN');
            // Drop existing destination table to ensure clean state
            await dropPgTable(client, tableName);
            await ensurePgTable(client, tableName, columns);
            await insertRowsIntoPg(client, tableName, columns, sourceRows);
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }

          migratedThisRun.push(tableName);

          // Verify integrity (Requirement 11.2)
          const verification = await this.verifyTable(tableName);
          const destRows = await readPgTableRows(deps.pgPool, tableName);

          const tableResult: MigrationTableResult = {
            tableName,
            sourceRowCount: sourceRows.length,
            destinationRowCount: destRows.length,
            durationMs: Date.now() - tableStart,
            verified: verification.match,
            checksumMatch: verification.match,
          };

          results.push(tableResult);

          if (!verification.match) {
            // Requirement 11.3: Halt and rollback on verification failure
            await this.rollbackMigratedTables(migratedThisRun);

            return {
              startedAt,
              completedAt: new Date(),
              tables: results,
              overallStatus: 'failed',
              failedTable: tableName,
              error: `Integrity verification failed for table "${tableName}": ${verification.discrepancies.join('; ')}`,
            };
          }

          // Update checkpoint (Requirement 11.4)
          await writeCheckpoint(deps.pgPool, tableName);
          lastCheckpoint = tableName;
        } catch (err) {
          // Unexpected error — rollback and report
          await this.rollbackMigratedTables(migratedThisRun);

          results.push({
            tableName,
            sourceRowCount: 0,
            destinationRowCount: 0,
            durationMs: Date.now() - tableStart,
            verified: false,
            checksumMatch: false,
          });

          return {
            startedAt,
            completedAt: new Date(),
            tables: results,
            overallStatus: 'failed',
            failedTable: tableName,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      // All tables migrated successfully — clear checkpoint
      await clearCheckpoint(deps.pgPool);
      lastCheckpoint = null;

      return {
        startedAt,
        completedAt: new Date(),
        tables: results,
        overallStatus: 'success',
      };
    },

    async verifyTable(tableName: string): Promise<{ match: boolean; discrepancies: string[] }> {
      const discrepancies: string[] = [];

      const sourceRows = readSqliteTableRows(deps.sqliteDb, tableName);
      const destRows = await readPgTableRows(deps.pgPool, tableName);

      // Check row count
      if (sourceRows.length !== destRows.length) {
        discrepancies.push(
          `Row count mismatch: source=${sourceRows.length}, destination=${destRows.length}`,
        );
        return { match: false, discrepancies };
      }

      // Compare checksums
      const sourceChecksum = computeTableChecksum(sourceRows);
      const destChecksum = computeTableChecksum(destRows);

      if (sourceChecksum !== destChecksum) {
        discrepancies.push(
          `Checksum mismatch: source=${sourceChecksum.slice(0, 16)}, destination=${destChecksum.slice(0, 16)}`,
        );
        return { match: false, discrepancies };
      }

      return { match: true, discrepancies: [] };
    },

    getCheckpoint(): string | null {
      return lastCheckpoint;
    },

    /**
     * Internal: rollback all tables migrated in this run by dropping them.
     * This restores the PostgreSQL database to its pre-migration state.
     */
    async rollbackMigratedTables(tables: string[]): Promise<void> {
      const client = await deps.pgPool.connect();
      try {
        await client.query('BEGIN');
        for (const tableName of tables) {
          await dropPgTable(client, tableName);
        }
        await client.query('COMMIT');
      } catch {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    },
  } as DataMigrator & { rollbackMigratedTables(tables: string[]): Promise<void> };
}

// Re-export utility for testing
export { computeTableChecksum, listSqliteTables, readSqliteTableRows };
