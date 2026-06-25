import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

import {
  createMigrationEngine,
  createSqliteMigrationAdapter,
  computeChecksum,
} from '../../server-v4/src/migration/migrationEngine.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMigration(version, name, upSql, downSql) {
  return {
    version,
    name,
    up: upSql,
    down: downSql,
    checksum: computeChecksum(upSql),
  };
}

function createInMemoryDb() {
  return new Database(':memory:');
}

// ---------------------------------------------------------------------------
// Unit tests for computeChecksum
// ---------------------------------------------------------------------------

describe('computeChecksum', () => {
  it('returns a 16-char hex string', () => {
    const result = computeChecksum('CREATE TABLE foo (id INT)');
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic', () => {
    const sql = 'SELECT 1';
    expect(computeChecksum(sql)).toBe(computeChecksum(sql));
  });

  it('trims whitespace before hashing', () => {
    expect(computeChecksum('  SELECT 1  ')).toBe(computeChecksum('SELECT 1'));
  });

  it('produces different checksums for different SQL', () => {
    expect(computeChecksum('SELECT 1')).not.toBe(computeChecksum('SELECT 2'));
  });
});

// ---------------------------------------------------------------------------
// SQLite MigrationEngine integration tests
// ---------------------------------------------------------------------------

describe('MigrationEngine (SQLite adapter)', () => {
  let db;
  let adapter;

  beforeEach(() => {
    db = createInMemoryDb();
    adapter = createSqliteMigrationAdapter(db);
  });

  describe('validate()', () => {
    it('passes for valid migrations', async () => {
      const migrations = [
        makeMigration(1, 'create_users', 'CREATE TABLE users (id INTEGER PRIMARY KEY)', 'DROP TABLE users'),
        makeMigration(2, 'create_posts', 'CREATE TABLE posts (id INTEGER PRIMARY KEY)', 'DROP TABLE posts'),
      ];
      const engine = createMigrationEngine(adapter, migrations);
      const result = await engine.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects duplicate version numbers', async () => {
      const migrations = [
        makeMigration(1, 'first', 'CREATE TABLE a (id INT)', 'DROP TABLE a'),
        makeMigration(1, 'duplicate', 'CREATE TABLE b (id INT)', 'DROP TABLE b'),
      ];
      const engine = createMigrationEngine(adapter, migrations);
      const result = await engine.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Duplicate migration version: 1');
    });

    it('rejects mismatched checksums', async () => {
      const migrations = [
        {
          version: 1,
          name: 'bad_checksum',
          up: 'CREATE TABLE x (id INT)',
          down: 'DROP TABLE x',
          checksum: 'deadbeefdeadbeef', // wrong checksum
        },
      ];
      const engine = createMigrationEngine(adapter, migrations);
      const result = await engine.validate();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Checksum mismatch');
    });
  });

  describe('applyPending()', () => {
    it('applies migrations in ascending version order', async () => {
      const migrations = [
        makeMigration(3, 'third', 'CREATE TABLE c (id INTEGER PRIMARY KEY)', 'DROP TABLE c'),
        makeMigration(1, 'first', 'CREATE TABLE a (id INTEGER PRIMARY KEY)', 'DROP TABLE a'),
        makeMigration(2, 'second', 'CREATE TABLE b (id INTEGER PRIMARY KEY)', 'DROP TABLE b'),
      ];
      const engine = createMigrationEngine(adapter, migrations);
      const applied = await engine.applyPending();

      expect(applied.map((m) => m.version)).toEqual([1, 2, 3]);
      expect(applied[0].name).toBe('first');
      expect(applied[1].name).toBe('second');
      expect(applied[2].name).toBe('third');

      // Verify tables exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('a','b','c')")
        .all();
      expect(tables.length).toBe(3);
    });

    it('skips already-applied migrations', async () => {
      const migrations = [
        makeMigration(1, 'first', 'CREATE TABLE a (id INTEGER PRIMARY KEY)', 'DROP TABLE a'),
        makeMigration(2, 'second', 'CREATE TABLE b (id INTEGER PRIMARY KEY)', 'DROP TABLE b'),
      ];
      const engine = createMigrationEngine(adapter, migrations);

      await engine.applyPending();
      const secondRun = await engine.applyPending();
      expect(secondRun).toEqual([]);
    });

    it('throws on validation failure (duplicate versions)', async () => {
      const migrations = [
        makeMigration(1, 'a', 'CREATE TABLE x (id INT)', 'DROP TABLE x'),
        makeMigration(1, 'b', 'CREATE TABLE y (id INT)', 'DROP TABLE y'),
      ];
      const engine = createMigrationEngine(adapter, migrations);

      await expect(engine.applyPending()).rejects.toThrow('Migration validation failed');
    });

    it('rolls back failed migration and leaves DB unchanged', async () => {
      const migrations = [
        makeMigration(1, 'good', 'CREATE TABLE good_table (id INTEGER PRIMARY KEY)', 'DROP TABLE good_table'),
        makeMigration(2, 'bad', 'INVALID SQL STATEMENT', 'SELECT 1'),
      ];
      const engine = createMigrationEngine(adapter, migrations);

      await expect(engine.applyPending()).rejects.toThrow();

      // First migration should have applied
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'good_table'")
        .all();
      expect(tables.length).toBe(1);

      // Metadata should only show version 1
      const applied = await engine.getApplied();
      expect(applied.length).toBe(1);
      expect(applied[0].version).toBe(1);
    });

    it('applies multi-statement migrations', async () => {
      const upSql = `
        CREATE TABLE multi_a (id INTEGER PRIMARY KEY);
        CREATE TABLE multi_b (id INTEGER PRIMARY KEY)
      `;
      const downSql = `
        DROP TABLE multi_a;
        DROP TABLE multi_b
      `;
      const migrations = [makeMigration(1, 'multi', upSql, downSql)];
      const engine = createMigrationEngine(adapter, migrations);

      await engine.applyPending();

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'multi_%'")
        .all();
      expect(tables.length).toBe(2);
    });
  });

  describe('rollbackLast()', () => {
    it('rolls back the most recent migration', async () => {
      const migrations = [
        makeMigration(1, 'first', 'CREATE TABLE a (id INTEGER PRIMARY KEY)', 'DROP TABLE a'),
        makeMigration(2, 'second', 'CREATE TABLE b (id INTEGER PRIMARY KEY)', 'DROP TABLE b'),
      ];
      const engine = createMigrationEngine(adapter, migrations);
      await engine.applyPending();

      const result = await engine.rollbackLast();
      expect(result.version).toBe(2);
      expect(result.rolledBack).toBe(true);

      // Table b should be dropped
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'b'")
        .all();
      expect(tables.length).toBe(0);

      // Table a should still exist
      const tablesA = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'a'")
        .all();
      expect(tablesA.length).toBe(1);
    });

    it('throws when no migrations to rollback', async () => {
      const engine = createMigrationEngine(adapter, []);
      await expect(engine.rollbackLast()).rejects.toThrow('No migrations to rollback');
    });

    it('supports successive rollbacks', async () => {
      const migrations = [
        makeMigration(1, 'first', 'CREATE TABLE a (id INTEGER PRIMARY KEY)', 'DROP TABLE a'),
        makeMigration(2, 'second', 'CREATE TABLE b (id INTEGER PRIMARY KEY)', 'DROP TABLE b'),
      ];
      const engine = createMigrationEngine(adapter, migrations);
      await engine.applyPending();

      await engine.rollbackLast(); // rollback version 2
      await engine.rollbackLast(); // rollback version 1

      const applied = await engine.getApplied();
      expect(applied.length).toBe(0);
    });
  });

  describe('getApplied()', () => {
    it('returns only non-rolled-back migrations', async () => {
      const migrations = [
        makeMigration(1, 'first', 'CREATE TABLE a (id INTEGER PRIMARY KEY)', 'DROP TABLE a'),
        makeMigration(2, 'second', 'CREATE TABLE b (id INTEGER PRIMARY KEY)', 'DROP TABLE b'),
      ];
      const engine = createMigrationEngine(adapter, migrations);
      await engine.applyPending();
      await engine.rollbackLast();

      const applied = await engine.getApplied();
      expect(applied.length).toBe(1);
      expect(applied[0].version).toBe(1);
    });
  });

  describe('getPending()', () => {
    it('returns migrations not yet applied, sorted by version', async () => {
      const migrations = [
        makeMigration(3, 'third', 'CREATE TABLE c (id INTEGER PRIMARY KEY)', 'DROP TABLE c'),
        makeMigration(1, 'first', 'CREATE TABLE a (id INTEGER PRIMARY KEY)', 'DROP TABLE a'),
        makeMigration(2, 'second', 'CREATE TABLE b (id INTEGER PRIMARY KEY)', 'DROP TABLE b'),
      ];
      const engine = createMigrationEngine(adapter, migrations);

      // Apply just the first
      await adapter.ensureMetadataTable();
      const singleAdapter = createSqliteMigrationAdapter(db);
      const singleEngine = createMigrationEngine(singleAdapter, [migrations[1]]); // version 1
      await singleEngine.applyPending();

      // Now check pending with full set
      const pending = await engine.getPending();
      expect(pending.map((m) => m.version)).toEqual([2, 3]);
    });
  });
});

// ---------------------------------------------------------------------------
// PostgreSQL adapter mock tests
// ---------------------------------------------------------------------------

describe('PostgreSQL MigrationAdapter (mocked pg)', () => {
  // We test the adapter via the createPostgresMigrationAdapter by mocking
  // the pg pool interface. This verifies the SQL generation and flow.

  it('is tested via the engine interface with mock pool', async () => {
    const { createPostgresMigrationAdapter } = await import(
      '../../server-v4/src/migration/migrationEngine.ts'
    );

    const rows = [];
    const executedQueries = [];

    const mockClient = {
      query: async (text, values) => {
        executedQueries.push({ text, values });
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
          return { rows: [] };
        }
        return { rows: [] };
      },
      release: () => {},
    };

    const mockPool = {
      query: async (text, values) => {
        executedQueries.push({ text, values });
        if (text.includes('SELECT')) {
          return { rows };
        }
        return { rows: [] };
      },
      connect: async () => mockClient,
    };

    const adapter = createPostgresMigrationAdapter(mockPool);
    await adapter.ensureMetadataTable();

    // Should have issued CREATE TABLE IF NOT EXISTS
    const createTableQuery = executedQueries.find((q) =>
      q.text.includes('CREATE TABLE IF NOT EXISTS _migrations'),
    );
    expect(createTableQuery).toBeDefined();

    // Test runInTransaction
    executedQueries.length = 0;
    await adapter.runInTransaction(['CREATE TABLE test (id INT)', 'INSERT INTO test VALUES (1)']);
    expect(executedQueries[0].text).toBe('BEGIN');
    expect(executedQueries[1].text).toBe('CREATE TABLE test (id INT)');
    expect(executedQueries[2].text).toBe('INSERT INTO test VALUES (1)');
    expect(executedQueries[3].text).toBe('COMMIT');

    // Test rollback on error
    const failClient = {
      query: async (text) => {
        if (text === 'INSERT FAIL') throw new Error('syntax error');
        return { rows: [] };
      },
      release: () => {},
    };

    const failPool = {
      ...mockPool,
      connect: async () => failClient,
    };
    const failAdapter = createPostgresMigrationAdapter(failPool);

    await expect(failAdapter.runInTransaction(['INSERT FAIL'])).rejects.toThrow('syntax error');
  });
});
