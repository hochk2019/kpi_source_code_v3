/**
 * Property-based tests for Navigation Frequency Top-N Selection.
 *
 * Feature: system-redesign-2026, Property 2: Navigation Frequency Top-N Selection
 *
 * For any array of navigation frequency entries and any N > 0, the top-N
 * selection function SHALL return exactly min(N, entries.length) items, and
 * every returned item SHALL have a visitCount >= every non-returned item's
 * visitCount.
 *
 * **Validates: Requirements 3.2**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { selectTopN } from '../../src/lib/prefetchManager';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary for a single frequency entry with a realistic visitCount */
const frequencyEntryArb = fc.record({
  routeKey: fc.string({ minLength: 1, maxLength: 30 }),
  visitCount: fc.nat({ max: 10000 }),
});

/** Arbitrary for a non-empty array of frequency entries */
const frequencyArrayArb = fc.array(frequencyEntryArb, { minLength: 1, maxLength: 50 });

/** Arbitrary for N > 0 */
const positiveNArb = fc.integer({ min: 1, max: 100 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 2: Navigation Frequency Top-N Selection', () => {
  it(
    'returns exactly min(N, entries.length) items for any entries and N > 0',
    () => {
      fc.assert(
        fc.property(frequencyArrayArb, positiveNArb, (entries, n) => {
          const result = selectTopN(entries, n);
          expect(result.length).toBe(Math.min(n, entries.length));
        }),
        { numRuns: 200 },
      );
    },
  );

  it(
    'every returned item has visitCount >= every non-returned item',
    () => {
      fc.assert(
        fc.property(frequencyArrayArb, positiveNArb, (entries, n) => {
          const result = selectTopN(entries, n);
          const resultSet = new Set(result);
          const nonReturned = entries.filter(e => !resultSet.has(e));

          if (result.length > 0 && nonReturned.length > 0) {
            const minReturned = Math.min(...result.map(e => e.visitCount));
            const maxNonReturned = Math.max(...nonReturned.map(e => e.visitCount));
            expect(minReturned).toBeGreaterThanOrEqual(maxNonReturned);
          }
        }),
        { numRuns: 200 },
      );
    },
  );

  it(
    'returns empty array when entries is empty regardless of N',
    () => {
      fc.assert(
        fc.property(positiveNArb, n => {
          const result = selectTopN([], n);
          expect(result).toEqual([]);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'returned items are a subset of the input entries',
    () => {
      fc.assert(
        fc.property(frequencyArrayArb, positiveNArb, (entries, n) => {
          const result = selectTopN(entries, n);
          for (const item of result) {
            expect(entries).toContain(item);
          }
        }),
        { numRuns: 200 },
      );
    },
  );

  it(
    'returned items are sorted by visitCount in descending order',
    () => {
      fc.assert(
        fc.property(frequencyArrayArb, positiveNArb, (entries, n) => {
          const result = selectTopN(entries, n);
          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].visitCount).toBeGreaterThanOrEqual(result[i].visitCount);
          }
        }),
        { numRuns: 200 },
      );
    },
  );
});
