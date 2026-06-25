/**
 * Property Test: Sync History Record Completeness (Property 12)
 *
 * Feature: system-redesign-2026, Property 12: Sync History Record Completeness
 *
 * For any completed sync operation (success or failure), the recorded
 * SyncHistoryEntry SHALL contain non-null values for startedAt, completedAt,
 * rowsFetched, rowsCommitted, outcome, and durationMs, where
 * durationMs equals completedAt - startedAt.
 *
 * **Validates: Requirements 10.2**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { createHealthMonitor } from '../../apps/ecus-bridge/src/healthMonitor.js';

/**
 * Arbitrary for a valid SyncHistoryEntry (without id — supplied by recordSync).
 * Generates random but valid sync history data with consistent timestamps.
 */
const syncHistoryEntryArb = fc
  .record({
    // startedAt: a random timestamp within a reasonable range
    startedAtMs: fc.integer({ min: 1_600_000_000_000, max: 1_800_000_000_000 }),
    // durationMs: positive duration in ms (1ms to 5 minutes)
    durationMs: fc.integer({ min: 1, max: 300_000 }),
    rowsFetched: fc.integer({ min: 0, max: 100_000 }),
    rowsCommitted: fc.integer({ min: 0, max: 100_000 }),
    outcome: fc.constantFrom('success', 'failure', 'partial'),
    errorMessage: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  })
  .map(({ startedAtMs, durationMs, rowsFetched, rowsCommitted, outcome, errorMessage }) => {
    const startedAt = new Date(startedAtMs);
    const completedAt = new Date(startedAtMs + durationMs);
    return {
      startedAt,
      completedAt,
      rowsFetched,
      rowsCommitted,
      outcome,
      errorMessage,
      durationMs,
    };
  });

describe('Property 12: Sync History Record Completeness', () => {
  it('recorded entry has all non-null required fields after recordSync', async () => {
    await fc.assert(
      fc.asyncProperty(syncHistoryEntryArb, async (entry) => {
        const db = new Database(':memory:');

        let generatedId = null;
        const monitor = createHealthMonitor({
          db,
          now: () => new Date().toISOString(),
          generateId: () => {
            generatedId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            return generatedId;
          },
          logger: { warn: () => {}, info: () => {}, error: () => {} },
        });

        // Record the sync
        await monitor.recordSync(entry);

        // Retrieve the row directly from DB
        const row = db.prepare('SELECT * FROM ecus_sync_history WHERE id = ?').get(generatedId);

        // All required fields must be non-null
        expect(row).not.toBeNull();
        expect(row.id).not.toBeNull();
        expect(row.started_at).not.toBeNull();
        expect(row.completed_at).not.toBeNull();
        expect(row.rows_fetched).not.toBeNull();
        expect(row.rows_committed).not.toBeNull();
        expect(row.outcome).not.toBeNull();
        expect(row.duration_ms).not.toBeNull();

        // Required fields must have correct types / non-empty values
        expect(typeof row.id).toBe('string');
        expect(row.id.length).toBeGreaterThan(0);
        expect(typeof row.started_at).toBe('string');
        expect(row.started_at.length).toBeGreaterThan(0);
        expect(typeof row.completed_at).toBe('string');
        expect(row.completed_at.length).toBeGreaterThan(0);
        expect(typeof row.rows_fetched).toBe('number');
        expect(typeof row.rows_committed).toBe('number');
        expect(['success', 'failure', 'partial']).toContain(row.outcome);
        expect(typeof row.duration_ms).toBe('number');

        db.close();
      }),
      { numRuns: 100 },
    );
  });

  it('durationMs equals completedAt - startedAt for any recorded entry', async () => {
    await fc.assert(
      fc.asyncProperty(syncHistoryEntryArb, async (entry) => {
        const db = new Database(':memory:');

        let generatedId = null;
        const monitor = createHealthMonitor({
          db,
          now: () => new Date().toISOString(),
          generateId: () => {
            generatedId = `dur-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            return generatedId;
          },
          logger: { warn: () => {}, info: () => {}, error: () => {} },
        });

        await monitor.recordSync(entry);

        const row = db.prepare('SELECT * FROM ecus_sync_history WHERE id = ?').get(generatedId);

        // Compute expected durationMs from the stored timestamps
        const storedStartedAt = new Date(row.started_at).getTime();
        const storedCompletedAt = new Date(row.completed_at).getTime();
        const expectedDuration = storedCompletedAt - storedStartedAt;

        // The stored durationMs should equal completedAt - startedAt
        expect(row.duration_ms).toBe(expectedDuration);

        db.close();
      }),
      { numRuns: 100 },
    );
  });

  it('rowsFetched and rowsCommitted are preserved as non-negative integers', async () => {
    await fc.assert(
      fc.asyncProperty(syncHistoryEntryArb, async (entry) => {
        const db = new Database(':memory:');

        let generatedId = null;
        const monitor = createHealthMonitor({
          db,
          now: () => new Date().toISOString(),
          generateId: () => {
            generatedId = `rows-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            return generatedId;
          },
          logger: { warn: () => {}, info: () => {}, error: () => {} },
        });

        await monitor.recordSync(entry);

        const row = db.prepare('SELECT * FROM ecus_sync_history WHERE id = ?').get(generatedId);

        // rowsFetched and rowsCommitted should be non-negative integers matching input
        expect(row.rows_fetched).toBe(entry.rowsFetched);
        expect(row.rows_committed).toBe(entry.rowsCommitted);
        expect(row.rows_fetched).toBeGreaterThanOrEqual(0);
        expect(row.rows_committed).toBeGreaterThanOrEqual(0);

        db.close();
      }),
      { numRuns: 100 },
    );
  });
});
