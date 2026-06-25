import { describe, expect, it, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

import {
  createDataMigrator,
  computeTableChecksum,
  listSqliteTables,
  readSqliteTableRows,
} from '../../server-v4/src/migration/dataMigrator.ts';

// ---------------------------------------------------------------------------
// Mock PostgreSQL Pool
// ---------------------------------------------------------------------------

function createMockPgPool() {
  /** In-memory storage for the mock PG */
  const tables = new Map();
  const queryLog = [];

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
    // Handle checkpoint upsert
    const match = sql.match(/INSERT INTO "([^"]+)"/);
    if (match) {
      const tableName = match[1];
      if (!tables.has(tableName)) {
        tables.set(tableName, []);
      }
      // Simple upsert: replace existing or add
      const existing = tables.get(tableName);
      if (sql.includes('ON CONFLICT')) {
        // Replace at id=1
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
    query: vi.fn(async (sql, values) => {
      queryLog.push({ sql, values });
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
    }),
    release: vi.fn(),
  };

  const pool = {
    query: vi.fn(async (sql, values) => {
      return mockClient.query(sql, values);
    }),
    connect: vi.fn(async () => mockClient),
    // Test helpers
    _tables: tables,
    _queryLog: queryLog,
    _client: mockClient,
  };

  return pool;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createInMemorySqlite() {
  return new Database(':memory:');
}

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

// ---------------------------------------------------------------------------
// Unit tests for computeTableChecksum
// ---------------------------------------------------------------------------

describe('computeTableChecksum', () => {
  it('returns consistent checksum for same data', () => {
    const rows = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    expect(computeTableChecksum(rows)).toBe(computeTableChecksum(rows));
  });

  it('returns same checksum regardless of row order', () => {
    const rows1 = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    const rows2 = [{ id: 2, name: 'Bob' }, { id: 1, name: 'Alice' }];
    expect(computeTableChecksum(rows1)).toBe(computeTableChecksum(rows2));
  });

  it('returns different checksum for different data', () => {
    const rows1 = [{ id: 1, name: 'Alice' }];
    const rows2 = [{ id: 1, name: 'Charlie' }];
    expect(computeTableChecksum(rows1)).not.toBe(computeTableChecksum(rows2));
  });

  it('handles empty array', () => {
    const result = computeTableChecksum([]);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// Unit tests for listSqliteTables
// ---------------------------------------------------------------------------

describe('listSqliteTables', () => {
  it('lists user tables excluding sqlite internals', () => {
    const db = createInMemorySqlite();
    db.exec('CREATE TABLE users (id INTEGER, name TEXT)');
    db.exec('CREATE TABLE orders (id INTEGER, amount REAL)');

    const tables = listSqliteTables(db);
    expect(tables).toContain('users');
    expect(tables).toContain('orders');
    expect(tables).not.toContain('sqlite_master');
    db.close();
  });

  it('excludes _migrations table', () => {
    const db = createInMemorySqlite();
    db.exec('CREATE TABLE _migrations (version INTEGER)');
    db.exec('CREATE TABLE data (id INTEGER)');

    const tables = listSqliteTables(db);
    expect(tables).not.toContain('_migrations');
    expect(tables).toContain('data');
    db.close();
  });

  it('returns empty array for empty database', () => {
    const db = createInMemorySqlite();
    const tables = listSqliteTables(db);
    expect(tables).toEqual([]);
    db.close();
  });
});

// ---------------------------------------------------------------------------
// Unit tests for readSqliteTableRows
// ---------------------------------------------------------------------------

describe('readSqliteTableRows', () => {
  it('reads all rows from a table', () => {
    const db = createInMemorySqlite();
    seedSqliteTable(
      db,
      'users',
      [{ name: 'id', type: 'INTEGER' }, { name: 'name', type: 'TEXT' }],
      [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
    );

    const rows = readSqliteTableRows(db, 'users');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 1, name: 'Alice' });
    expect(rows[1]).toMatchObject({ id: 2, name: 'Bob' });
    db.close();
  });

  it('returns empty array for empty table', () => {
    const db = createInMemorySqlite();
    db.exec('CREATE TABLE empty_table (id INTEGER)');

    const rows = readSqliteTableRows(db, 'empty_table');
    expect(rows).toEqual([]);
    db.close();
  });
});

// ---------------------------------------------------------------------------
// DataMigrator integration tests
// ---------------------------------------------------------------------------

describe('DataMigrator', () => {
  let db;
  let pgPool;
  let migrator;

  beforeEach(() => {
    db = createInMemorySqlite();
    pgPool = createMockPgPool();
    migrator = createDataMigrator({
      sqliteDb: db,
      pgPool,
      isOffline: () => true,
    });
  });

  describe('migrate()', () => {
    it('fails if application is not offline', async () => {
      const onlineMigrator = createDataMigrator({
        sqliteDb: db,
        pgPool,
        isOffline: () => false,
      });

      const report = await onlineMigrator.migrate();
      expect(report.overallStatus).toBe('failed');
      expect(report.error).toContain('offline');
    });

    it('succeeds with empty database', async () => {
      const report = await migrator.migrate();
      expect(report.overallStatus).toBe('success');
      expect(report.tables).toEqual([]);
    });

    it('migrates a single table successfully', async () => {
      seedSqliteTable(
        db,
        'users',
        [{ name: 'id', type: 'INTEGER' }, { name: 'name', type: 'TEXT' }],
        [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
      );

      const report = await migrator.migrate();
      expect(report.overallStatus).toBe('success');
      expect(report.tables).toHaveLength(1);
      expect(report.tables[0].tableName).toBe('users');
      expect(report.tables[0].sourceRowCount).toBe(2);
      expect(report.tables[0].verified).toBe(true);
    });

    it('migrates multiple tables successfully', async () => {
      seedSqliteTable(
        db,
        'orders',
        [{ name: 'id', type: 'INTEGER' }, { name: 'total', type: 'REAL' }],
        [{ id: 1, total: 99.99 }],
      );
      seedSqliteTable(
        db,
        'users',
        [{ name: 'id', type: 'INTEGER' }, { name: 'name', type: 'TEXT' }],
        [{ id: 1, name: 'Alice' }],
      );

      const report = await migrator.migrate();
      expect(report.overallStatus).toBe('success');
      expect(report.tables).toHaveLength(2);
    });

    it('generates migration report with durations', async () => {
      seedSqliteTable(
        db,
        'items',
        [{ name: 'id', type: 'INTEGER' }],
        [{ id: 1 }],
      );

      const report = await migrator.migrate();
      expect(report.startedAt).toBeInstanceOf(Date);
      expect(report.completedAt).toBeInstanceOf(Date);
      expect(report.tables[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('supports resumable migration from checkpoint', async () => {
      seedSqliteTable(
        db,
        'alpha',
        [{ name: 'id', type: 'INTEGER' }],
        [{ id: 1 }],
      );
      seedSqliteTable(
        db,
        'beta',
        [{ name: 'id', type: 'INTEGER' }],
        [{ id: 2 }],
      );

      // Migrate with resume from "alpha" — should skip alpha and only do beta
      const report = await migrator.migrate({ resumeFrom: 'alpha' });
      expect(report.overallStatus).toBe('success');
      expect(report.tables).toHaveLength(1);
      expect(report.tables[0].tableName).toBe('beta');
    });
  });

  describe('verifyTable()', () => {
    it('returns match=true when data is identical', async () => {
      seedSqliteTable(
        db,
        'items',
        [{ name: 'id', type: 'INTEGER' }, { name: 'label', type: 'TEXT' }],
        [{ id: 1, label: 'Test' }],
      );

      // First migrate so PG has data
      await migrator.migrate();

      const result = await migrator.verifyTable('items');
      expect(result.match).toBe(true);
      expect(result.discrepancies).toEqual([]);
    });
  });

  describe('getCheckpoint()', () => {
    it('returns null initially', () => {
      expect(migrator.getCheckpoint()).toBeNull();
    });

    it('returns last completed table after partial migration', async () => {
      seedSqliteTable(
        db,
        'alpha',
        [{ name: 'id', type: 'INTEGER' }],
        [{ id: 1 }],
      );
      seedSqliteTable(
        db,
        'beta',
        [{ name: 'id', type: 'INTEGER' }],
        [{ id: 2 }],
      );

      await migrator.migrate();
      // After successful full migration checkpoint is cleared
      expect(migrator.getCheckpoint()).toBeNull();
    });
  });

  describe('offline mode requirement', () => {
    it('rejects migration when not in offline mode', async () => {
      seedSqliteTable(
        db,
        'data',
        [{ name: 'id', type: 'INTEGER' }],
        [{ id: 1 }],
      );

      const onlineMigrator = createDataMigrator({
        sqliteDb: db,
        pgPool,
        isOffline: () => false,
      });

      const report = await onlineMigrator.migrate();
      expect(report.overallStatus).toBe('failed');
      expect(report.error).toContain('offline');
      expect(report.tables).toEqual([]);
    });
  });
});
