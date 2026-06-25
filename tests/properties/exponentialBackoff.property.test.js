/**
 * Property Test: Exponential Backoff Delay Calculation (Property 9)
 *
 * Feature: system-redesign-2026, Property 9: Exponential Backoff Delay Calculation
 *
 * For any attempt number (1..maxAttempts) and any valid RetryConfig,
 * `calculateBackoffDelay(attempt, config)` SHALL return
 * `min(initialDelay * factor^(attempt-1), maxDelay)`, and the result SHALL be
 * monotonically non-decreasing with attempt number.
 *
 * **Validates: Requirements 8.1**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
} from '../../apps/ecus-bridge/src/retryEngine.js';

// ─── Arbitrary Generators ──────────────────────────────────────────────────

/**
 * Generate a valid RetryConfig with:
 * - positive initialDelayMs (1..10000)
 * - positive maxDelayMs (>= initialDelayMs, up to 120000)
 * - backoffFactor > 1 (1.01..10)
 * - maxAttempts (1..20)
 */
const arbRetryConfig = fc
  .record({
    initialDelayMs: fc.integer({ min: 1, max: 10000 }),
    maxDelayMs: fc.integer({ min: 1, max: 120000 }),
    backoffFactor: fc.double({ min: 1.01, max: 10, noNaN: true, noDefaultInfinity: true }),
    maxAttempts: fc.integer({ min: 1, max: 20 }),
  })
  .filter((cfg) => cfg.maxDelayMs >= cfg.initialDelayMs);

/**
 * Generate a valid attempt number (1..maxAttempts) paired with its config.
 */
const arbAttemptAndConfig = arbRetryConfig.chain((config) =>
  fc.integer({ min: 1, max: config.maxAttempts }).map((attempt) => ({ attempt, config })),
);

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 9: Exponential Backoff Delay Calculation', () => {
  it('result equals min(initial * factor^(attempt-1), maxDelay) for any valid input', () => {
    fc.assert(
      fc.property(arbAttemptAndConfig, ({ attempt, config }) => {
        const result = calculateBackoffDelay(attempt, config);
        const expected = Math.min(
          config.initialDelayMs * Math.pow(config.backoffFactor, attempt - 1),
          config.maxDelayMs,
        );
        expect(result).toBeCloseTo(expected, 6);
      }),
      { numRuns: 200 },
    );
  });

  it('is monotonically non-decreasing with attempt number', () => {
    fc.assert(
      fc.property(arbRetryConfig, (config) => {
        let previousDelay = -Infinity;
        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
          const delay = calculateBackoffDelay(attempt, config);
          expect(delay).toBeGreaterThanOrEqual(previousDelay);
          previousDelay = delay;
        }
      }),
      { numRuns: 200 },
    );
  });

  it('never exceeds maxDelayMs for any attempt number', () => {
    fc.assert(
      fc.property(arbAttemptAndConfig, ({ attempt, config }) => {
        const result = calculateBackoffDelay(attempt, config);
        expect(result).toBeLessThanOrEqual(config.maxDelayMs);
      }),
      { numRuns: 100 },
    );
  });

  it('returns initialDelayMs for attempt 1 (since factor^0 = 1)', () => {
    fc.assert(
      fc.property(arbRetryConfig, (config) => {
        const result = calculateBackoffDelay(1, config);
        // When initialDelayMs <= maxDelayMs (guaranteed by our filter),
        // attempt 1 should always return initialDelayMs
        expect(result).toBeCloseTo(config.initialDelayMs, 6);
      }),
      { numRuns: 100 },
    );
  });

  it('works correctly with DEFAULT_RETRY_CONFIG for all attempts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: DEFAULT_RETRY_CONFIG.maxAttempts }),
        (attempt) => {
          const result = calculateBackoffDelay(attempt, DEFAULT_RETRY_CONFIG);
          const expected = Math.min(
            DEFAULT_RETRY_CONFIG.initialDelayMs *
              Math.pow(DEFAULT_RETRY_CONFIG.backoffFactor, attempt - 1),
            DEFAULT_RETRY_CONFIG.maxDelayMs,
          );
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
