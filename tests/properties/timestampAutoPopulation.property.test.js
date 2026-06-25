/**
 * Property Test: Timestamp Auto-Population (Property 24)
 *
 * Feature: system-redesign-2026, Property 24: Timestamp Auto-Population
 *
 * For any entity INSERT, `created_at` and `updated_at` SHALL be set to the
 * current time; for any UPDATE, `updated_at` SHALL be updated to the current
 * time while `created_at` remains unchanged.
 *
 * **Validates: Requirements 13.5**
 *
 * Strategy: Use better-sqlite3 in-memory with a trigger that mirrors the
 * PostgreSQL `update_updated_at()` trigger function from migration 001.
 * SQLite supports AFTER UPDATE triggers that achieve the same effect.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Creates an in-memory SQLite database with an entity table and an
 * updated_at trigger that mirrors the PostgreSQL behavior:
 *  - INSERT: both created_at and updated_at default to current timestamp
 *  - UPDATE: trigger sets updated_at to current timestamp, created_at is unchanged
 *
 * We inject a controllable clock (`nowFn`) via a custom SQLite function to make
 * assertions deterministic.
 */
function createTestDb() {
  const db = new Database(':memory:');

  // Register a custom function that returns a controllable "now" timestamp.
  // We'll update the value via a variable before each operation.
  let currentTime = new Date().toISOString();

  db.function('test_now', () => currentTime);

  // Create entity table mimicking the schema pattern from migrations 002-011
  db.exec(`
    CREATE TABLE test_entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      value INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (test_now()),
      updated_at TEXT NOT NULL DEFAULT (test_now())
    )
  `);

  // Create trigger that mirrors PostgreSQL's update_updated_at() function
  db.exec(`
    CREATE TRIGGER trg_test_entities_updated_at
    AFTER UPDATE ON test_entities
    FOR EACH ROW
    BEGIN
      UPDATE test_entities SET updated_at = test_now() WHERE id = NEW.id;
    END
  `);

  return {
    db,
    setNow(iso) {
      currentTime = iso;
    },
    getNow() {
      return currentTime;
    },
    insert(id, name, value) {
      db.prepare('INSERT INTO test_entities (id, name, value) VALUES (?, ?, ?)').run(id, name, value);
    },
    update(id, name, value) {
      db.prepare('UPDATE test_entities SET name = ?, value = ? WHERE id = ?').run(name, value, id);
    },
    get(id) {
      return db.prepare('SELECT * FROM test_entities WHERE id = ?').get(id);
    },
    close() {
      db.close();
    },
  };
}

// ─── Arbitrary Generators ──────────────────────────────────────────────────

/** Generate a random entity id */
const arbId = fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0);

/** Generate a random entity name */
const arbName = fc.string({ minLength: 0, maxLength: 100 });

/** Generate a random integer value */
const arbValue = fc.integer({ min: -1_000_000, max: 1_000_000 });

/** Generate a random ISO timestamp within reasonable range */
const MIN_TS = new Date('2020-01-01T00:00:00Z').getTime();
const MAX_TS = new Date('2030-12-31T23:59:59Z').getTime();

const arbTimestamp = fc.integer({ min: MIN_TS, max: MAX_TS }).map((ms) => new Date(ms).toISOString());

/**
 * Generate a pair of timestamps where the second is strictly after the first.
 * This simulates INSERT time followed by UPDATE time.
 */
const arbTimestampPair = fc
  .record({
    insertMs: fc.integer({ min: MIN_TS, max: MAX_TS - 1000 }),
    gapMs: fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }), // 1ms to 1 year gap
  })
  .map(({ insertMs, gapMs }) => {
    const updateMs = Math.min(insertMs + gapMs, MAX_TS);
    return {
      insertTime: new Date(insertMs).toISOString(),
      updateTime: new Date(updateMs).toISOString(),
    };
  });

/** Generate random entity data */
const arbEntity = fc.record({
  id: arbId,
  name: arbName,
  value: arbValue,
});

/** Generate entity data with a different name/value for updates */
const arbEntityWithUpdate = fc.record({
  id: arbId,
  name: arbName,
  value: arbValue,
  updatedName: arbName,
  updatedValue: arbValue,
});

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 24: Timestamp Auto-Population', () => {
  it('INSERT sets both created_at and updated_at to the current time', () => {
    fc.assert(
      fc.property(arbEntity, arbTimestamp, (entity, insertTime) => {
        const store = createTestDb();
        try {
          store.setNow(insertTime);
          store.insert(entity.id, entity.name, entity.value);

          const row = store.get(entity.id);
          expect(row).not.toBeNull();
          expect(row.created_at).toBe(insertTime);
          expect(row.updated_at).toBe(insertTime);
        } finally {
          store.close();
        }
      }),
      { numRuns: 150 },
    );
  });

  it('UPDATE changes updated_at to current time while created_at remains unchanged', () => {
    fc.assert(
      fc.property(arbEntityWithUpdate, arbTimestampPair, (entity, times) => {
        const store = createTestDb();
        try {
          // INSERT at insertTime
          store.setNow(times.insertTime);
          store.insert(entity.id, entity.name, entity.value);

          // Verify initial state
          const rowAfterInsert = store.get(entity.id);
          expect(rowAfterInsert.created_at).toBe(times.insertTime);
          expect(rowAfterInsert.updated_at).toBe(times.insertTime);

          // UPDATE at updateTime (later)
          store.setNow(times.updateTime);
          store.update(entity.id, entity.updatedName, entity.updatedValue);

          // Verify: created_at unchanged, updated_at changed
          const rowAfterUpdate = store.get(entity.id);
          expect(rowAfterUpdate.created_at).toBe(times.insertTime);
          expect(rowAfterUpdate.updated_at).toBe(times.updateTime);
        } finally {
          store.close();
        }
      }),
      { numRuns: 150 },
    );
  });

  it('multiple UPDATEs always set updated_at to latest time; created_at never changes', () => {
    const arbMultiUpdate = fc.record({
      id: arbId,
      name: arbName,
      value: arbValue,
      updateCount: fc.integer({ min: 2, max: 5 }),
    });

    fc.assert(
      fc.property(
        arbMultiUpdate,
        fc.integer({ min: MIN_TS, max: MAX_TS - 10_000_000 }),
        (entity, baseMs) => {
          const store = createTestDb();
          try {
            const insertTime = new Date(baseMs).toISOString();
            store.setNow(insertTime);
            store.insert(entity.id, entity.name, entity.value);

            let lastUpdateTime = insertTime;
            for (let i = 0; i < entity.updateCount; i++) {
              const updateMs = baseMs + (i + 1) * 1000; // Each update 1 second apart
              lastUpdateTime = new Date(updateMs).toISOString();
              store.setNow(lastUpdateTime);
              store.update(entity.id, `name_${i}`, i);
            }

            const finalRow = store.get(entity.id);
            // created_at NEVER changes
            expect(finalRow.created_at).toBe(insertTime);
            // updated_at reflects the LAST update time
            expect(finalRow.updated_at).toBe(lastUpdateTime);
          } finally {
            store.close();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('created_at and updated_at are equal immediately after INSERT (no intervening update)', () => {
    fc.assert(
      fc.property(arbEntity, arbTimestamp, (entity, time) => {
        const store = createTestDb();
        try {
          store.setNow(time);
          store.insert(entity.id, entity.name, entity.value);

          const row = store.get(entity.id);
          expect(row.created_at).toBe(row.updated_at);
        } finally {
          store.close();
        }
      }),
      { numRuns: 100 },
    );
  });
});
