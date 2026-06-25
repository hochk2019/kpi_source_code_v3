/**
 * Property Test: Duration Statistics Calculation (Property 14)
 *
 * Feature: system-redesign-2026, Property 14: Duration Statistics Calculation
 *
 * For any non-empty array of sync durations, `computeDurationStats()` SHALL return
 * an average equal to sum/count, and a p95 value equal to the ceil(0.95 * count)-th
 * smallest value when sorted ascending.
 *
 * **Validates: Requirements 10.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeDurationStats } from '../../apps/ecus-bridge/src/healthMonitor.js';

// ─── Arbitrary Generators ──────────────────────────────────────────────────

/**
 * Generate a non-empty array of positive integers (durations in ms),
 * already sorted ascending as required by computeDurationStats.
 */
const arbSortedDurations = fc
  .array(fc.integer({ min: 1, max: 100000 }), { minLength: 1, maxLength: 500 })
  .map((arr) => arr.slice().sort((a, b) => a - b));

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 14: Duration Statistics Calculation', () => {
  it('average equals sum / count for any non-empty sorted durations array', () => {
    fc.assert(
      fc.property(arbSortedDurations, (sortedDurations) => {
        const result = computeDurationStats(sortedDurations);
        const count = sortedDurations.length;
        const sum = sortedDurations.reduce((acc, d) => acc + d, 0);
        const expectedAverage = sum / count;
        expect(result.average).toBeCloseTo(expectedAverage, 10);
      }),
      { numRuns: 100 },
    );
  });

  it('p95 equals the value at index ceil(0.95 * count) - 1 in the sorted array', () => {
    fc.assert(
      fc.property(arbSortedDurations, (sortedDurations) => {
        const result = computeDurationStats(sortedDurations);
        const count = sortedDurations.length;
        const p95Index = Math.ceil(0.95 * count) - 1;
        const clampedIndex = Math.min(Math.max(0, p95Index), count - 1);
        const expectedP95 = sortedDurations[clampedIndex];
        expect(result.p95).toBe(expectedP95);
      }),
      { numRuns: 100 },
    );
  });
});
