import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MigrationFile {
  version: number;
  name: string;
  up: string;
  down: string;
  checksum: string;
}

export interface MigrationMetadata {
  version: number;
  name: string;
  appliedAt: Date;
  checksum: string;
  rolledBack: boolean;
}

export interface MigrationEngine {
  /** Apply all pending migrations in version order */
  applyPending(): Promise<MigrationMetadata[]>;
  /** Rollback the most recent migration */
  rollbackLast(): Promise<MigrationMetadata>;
  /** Get list of applied migrations */
  getApplied(): Promise<MigrationMetadata[]>;
  /** Get list of pending migrations */
  getPending(): Promise<MigrationFile[]>;
  /** Validate migration files (no duplicates, checksums OK) */
  validate(): Promise<{ valid: boolean; errors: string[] }>;
}

/**
 * Abstraction over a database connection so the engine works identically
 * against both SQLite (better-sqlite3, synchronous) and PostgreSQL (pg, async).
 */
export interface MigrationDatabaseAdapter {
  /** Ensure the _migrations metadata table exists */
  ensureMetadataTable(): Promise<void>;
  /** Run a SQL statement inside a transaction; rollback on error */
  runInTransaction(statements: string[]): Promise<void>;
  /** Get all rows from _migrations ordered by version ASC */
  getAppliedMigrations(): Promise<MigrationMetadata[]>;
  /** Insert a row into _migrations */
  recordApplied(meta: MigrationMetadata): Promise<void>;
  /** Mark a row as rolled back */
  markRolledBack(version: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function computeChecksum(sql: string): string {
  return crypto.createHash('sha256').update(sql.trim()).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Core Engine Implementation
// ---------------------------------------------------------------------------

export function createMigrationEngine(
  adapter: MigrationDatabaseAdapter,
  migrations: MigrationFile[],
): MigrationEngine {
  return {
    async applyPending(): Promise<MigrationMetadata[]> {
      await adapter.ensureMetadataTable();
      const validation = await this.validate();
      if (!validation.valid) {
        throw new Error(
          `Migration validation failed: ${validation.errors.join('; ')}`,
        );
      }

      const pending = await this.getPending();
      const applied: MigrationMetadata[] = [];

      for (const migration of pending) {
        const statements = splitStatements(migration.up);
        await adapter.runInTransaction(statements);

        const meta: MigrationMetadata = {
          version: migration.version,
          name: migration.name,
          appliedAt: new Date(),
          checksum: migration.checksum,
          rolledBack: false,
        };
        await adapter.recordApplied(meta);
        applied.push(meta);
      }

      return applied;
    },

    async rollbackLast(): Promise<MigrationMetadata> {
      await adapter.ensureMetadataTable();
      const appliedList = await adapter.getAppliedMigrations();
      const active = appliedList.filter((m) => !m.rolledBack);

      if (active.length === 0) {
        throw new Error('No migrations to rollback.');
      }

      const last = active[active.length - 1]!;
      const migrationFile = migrations.find((m) => m.version === last.version);

      if (!migrationFile) {
        throw new Error(
          `Migration file for version ${last.version} not found. Cannot rollback.`,
        );
      }

      const statements = splitStatements(migrationFile.down);
      await adapter.runInTransaction(statements);
      await adapter.markRolledBack(last.version);

      return { ...last, rolledBack: true };
    },

    async getApplied(): Promise<MigrationMetadata[]> {
      await adapter.ensureMetadataTable();
      const all = await adapter.getAppliedMigrations();
      return all.filter((m) => !m.rolledBack);
    },

    async getPending(): Promise<MigrationFile[]> {
      const applied = await adapter.getAppliedMigrations();
      const activeVersions = new Set(
        applied.filter((m) => !m.rolledBack).map((m) => m.version),
      );

      return [...migrations]
        .filter((m) => !activeVersions.has(m.version))
        .sort((a, b) => a.version - b.version);
    },

    async validate(): Promise<{ valid: boolean; errors: string[] }> {
      const errors: string[] = [];

      // Check for duplicate version numbers
      const versionCounts = new Map<number, number>();
      for (const m of migrations) {
        versionCounts.set(m.version, (versionCounts.get(m.version) ?? 0) + 1);
      }
      for (const [version, count] of versionCounts) {
        if (count > 1) {
          errors.push(
            `Duplicate migration version: ${version} (appears ${count} times)`,
          );
        }
      }

      // Verify checksums match content
      for (const m of migrations) {
        const expected = computeChecksum(m.up);
        if (m.checksum !== expected) {
          errors.push(
            `Checksum mismatch for version ${m.version} ("${m.name}"): expected ${expected}, got ${m.checksum}`,
          );
        }
      }

      return { valid: errors.length === 0, errors };
    },
  };
}

// ---------------------------------------------------------------------------
// SQLite Adapter (better-sqlite3)
// ---------------------------------------------------------------------------

/**
 * Type representing the subset of better-sqlite3 Database we need.
 * This avoids importing the module at the type level (it's native).
 */
export interface BetterSqlite3Database {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): unknown;
  };
  transaction<T>(fn: () => T): () => T;
}

export function createSqliteMigrationAdapter(
  db: BetterSqlite3Database,
): MigrationDatabaseAdapter {
  return {
    async ensureMetadataTable(): Promise<void> {
      db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
          version      INTEGER PRIMARY KEY,
          name         TEXT NOT NULL,
          applied_at   TEXT NOT NULL,
          checksum     TEXT NOT NULL,
          rolled_back  INTEGER NOT NULL DEFAULT 0
        )
      `);
    },

    async runInTransaction(statements: string[]): Promise<void> {
      const run = db.transaction(() => {
        for (const stmt of statements) {
          const trimmed = stmt.trim();
          if (trimmed) {
            db.exec(trimmed);
          }
        }
      });
      run();
    },

    async getAppliedMigrations(): Promise<MigrationMetadata[]> {
      const rows = db
        .prepare('SELECT version, name, applied_at, checksum, rolled_back FROM _migrations ORDER BY version ASC')
        .all() as Array<{
          version: number;
          name: string;
          applied_at: string;
          checksum: string;
          rolled_back: number;
        }>;

      return rows.map((row) => ({
        version: row.version,
        name: row.name,
        appliedAt: new Date(row.applied_at),
        checksum: row.checksum,
        rolledBack: row.rolled_back === 1,
      }));
    },

    async recordApplied(meta: MigrationMetadata): Promise<void> {
      db.prepare(
        'INSERT INTO _migrations (version, name, applied_at, checksum, rolled_back) VALUES (?, ?, ?, ?, ?)',
      ).run(
        meta.version,
        meta.name,
        meta.appliedAt.toISOString(),
        meta.checksum,
        meta.rolledBack ? 1 : 0,
      );
    },

    async markRolledBack(version: number): Promise<void> {
      db.prepare('UPDATE _migrations SET rolled_back = 1 WHERE version = ?').run(version);
    },
  };
}

// ---------------------------------------------------------------------------
// PostgreSQL Adapter (pg)
// ---------------------------------------------------------------------------

/**
 * Subset of pg.Pool we need.
 */
export interface PgPool {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  connect(): Promise<PgPoolClient>;
}

export interface PgPoolClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  release(): void;
}

export function createPostgresMigrationAdapter(pool: PgPool): MigrationDatabaseAdapter {
  return {
    async ensureMetadataTable(): Promise<void> {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          version      INTEGER PRIMARY KEY,
          name         TEXT NOT NULL,
          applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          checksum     TEXT NOT NULL,
          rolled_back  BOOLEAN NOT NULL DEFAULT FALSE
        )
      `);
    },

    async runInTransaction(statements: string[]): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const stmt of statements) {
          const trimmed = stmt.trim();
          if (trimmed) {
            await client.query(trimmed);
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async getAppliedMigrations(): Promise<MigrationMetadata[]> {
      const result = await pool.query(
        'SELECT version, name, applied_at, checksum, rolled_back FROM _migrations ORDER BY version ASC',
      );

      return (result.rows as Array<{
        version: number;
        name: string;
        applied_at: string | Date;
        checksum: string;
        rolled_back: boolean;
      }>).map((row) => ({
        version: row.version,
        name: row.name,
        appliedAt: new Date(row.applied_at),
        checksum: row.checksum,
        rolledBack: row.rolled_back,
      }));
    },

    async recordApplied(meta: MigrationMetadata): Promise<void> {
      await pool.query(
        'INSERT INTO _migrations (version, name, applied_at, checksum, rolled_back) VALUES ($1, $2, $3, $4, $5)',
        [meta.version, meta.name, meta.appliedAt.toISOString(), meta.checksum, meta.rolledBack],
      );
    },

    async markRolledBack(version: number): Promise<void> {
      await pool.query('UPDATE _migrations SET rolled_back = TRUE WHERE version = $1', [version]);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split a multi-statement SQL string by semicolons, respecting that
 * semicolons inside strings or $$ blocks should not split.
 * Simple heuristic: split on `;` at line boundaries.
 */
function splitStatements(sql: string): string[] {
  // Split on semicolons that end a line (with optional whitespace after)
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
