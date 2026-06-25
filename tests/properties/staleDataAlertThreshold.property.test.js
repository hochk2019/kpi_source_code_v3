/**
 * Property Test: Stale-Data Alert Threshold (Property 13)
 *
 * Feature: system-redesign-2026, Property 13: Stale-Data Alert Threshold
 *
 * For any pair (lastSyncTime, threshold), `isStale()` SHALL return true if and
 * only if `(now - lastSyncTime) > threshold`. The function SHALL be monotonic:
 * if it returns true for threshold T, it returns true for any T' < T.
 *
 * **Validates: Requirements 10.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isStale } from '../../apps/ecus-bridge/src/healthMonitor.js';

// ─── Arbitrary Generators ──────────────────────────────────────────────────

/**
 * Generate a random ISO-8601 timestamp within a reasonable range (2020..2030).
 */
const arbISOTimestamp = fc
  .date({
    min: new Date('2020-01-01T00:00:00Z'),
    max: new Date('2030-12-31T23:59:59Z'),
  })
  .map((d) => d.toISOString());

/**
 * Generate a positive threshold in hours (0.001 to 10000 hours).
 */
const arbThresholdHours = fc.double({
  min: 0.001,
  max: 10000,
  noNaN: true,
  noDefaultInfinity: true,
});

/**
 * Generate a lastSync and now pair where now >= lastSync, plus a threshold.
 * Uses millisecond timestamps to avoid Invalid Date issues.
 */
const MIN_TS = new Date('2020-01-01T00:00:00Z').getTime();
const MAX_TS = new Date('2029-12-31T23:59:59Z').getTime();

const arbStaleInputs = fc
  .record({
    lastSyncMs: fc.integer({ min: MIN_TS, max: MAX_TS }),
    elapsedMs: fc.integer({ min: 0, max: 365 * 24 * 60 * 60 * 1000 }), // up to 1 year
    thresholdHours: arbThresholdHours,
  })
  .map(({ lastSyncMs, elapsedMs, thresholdHours }) => {
    const lastSync = new Date(lastSyncMs);
    const nowDate = new Date(lastSyncMs + elapsedMs);
    return {
      lastSyncISO: lastSync.toISOString(),
      nowISO: nowDate.toISOString(),
      thresholdHours,
      elapsedMs,
    };
  });

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 13: Stale-Data Alert Threshold', () => {
  it('returns true iff (now - lastSync) > threshold for any valid input', () => {
    fc.assert(
      fc.property(arbStaleInputs, ({ lastSyncISO, nowISO, thresholdHours, elapsedMs }) => {
        const result = isStale(lastSyncISO, thresholdHours, nowISO);
        const thresholdMs = thresholdHours * 60 * 60 * 1000;
        const expected = elapsedMs > thresholdMs;
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('is monotonic: if stale for threshold T, also stale for any T_prime < T', () => {
    fc.assert(
      fc.property(
        arbStaleInputs.filter(({ thresholdHours }) => thresholdHours > 0.01),
        fc.double({ min: 0.001, max: 0.999, noNaN: true, noDefaultInfinity: true }),
        ({ lastSyncISO, nowISO, thresholdHours }, fraction) => {
          const result = isStale(lastSyncISO, thresholdHours, nowISO);
          if (result) {
            // If stale for T, must be stale for any T' < T
            const smallerThreshold = thresholdHours * fraction;
            const resultSmaller = isStale(lastSyncISO, smallerThreshold, nowISO);
            expect(resultSmaller).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns true when lastSyncISO is null (no sync ever)', () => {
    fc.assert(
      fc.property(arbThresholdHours, arbISOTimestamp, (threshold, nowISO) => {
        const result = isStale(null, threshold, nowISO);
        expect(result).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('returns false when elapsed time is zero and threshold > 0', () => {
    fc.assert(
      fc.property(
        arbISOTimestamp,
        fc.double({ min: 0.001, max: 10000, noNaN: true, noDefaultInfinity: true }),
        (timestamp, threshold) => {
          // same now and lastSync → elapsed = 0 → not stale for any positive threshold
          const result = isStale(timestamp, threshold, timestamp);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
