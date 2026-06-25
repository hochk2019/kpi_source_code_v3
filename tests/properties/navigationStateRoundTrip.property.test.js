import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createNavigationStateStore } from '@/lib/navigationStateStore';

/**
 * Property 5: Navigation State Round-Trip Preservation
 *
 * For any PageState object, save then restore returns deeply equal object.
 *
 * Feature: system-redesign-2026, Property 5: Navigation State Round-Trip Preservation
 * Validates: Requirements 4.4
 */

// ─── In-Memory Storage Mock ────────────────────────────────────────────────

function createInMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

// ─── Arbitrary Generators ──────────────────────────────────────────────────

/**
 * Generate arbitrary JSON-safe values for filter entries.
 * We constrain to values that survive JSON round-trip (no undefined, no functions, no symbols).
 */
const arbJsonValue = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small' },
    fc.string(),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie('value'), { maxLength: 5 }),
    fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), tie('value'), { maxKeys: 5 }),
  ),
})).value;

/**
 * Generate arbitrary PageState objects matching the interface:
 * { scrollTop: number, filters: Record<string, unknown>, sortColumn?: string, sortDirection?: 'asc' | 'desc' }
 */
const arbPageState = fc.record({
  scrollTop: fc.double({ noNaN: true, noDefaultInfinity: true, min: 0 }),
  filters: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    arbJsonValue,
    { maxKeys: 10 },
  ),
  sortColumn: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  sortDirection: fc.option(fc.constantFrom('asc', 'desc'), { nil: undefined }),
});

const arbRouteKey = fc.string({ minLength: 1, maxLength: 50 });

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 5: Navigation State Round-Trip Preservation', () => {
  let storage;
  let store;

  beforeEach(() => {
    storage = createInMemoryStorage();
    store = createNavigationStateStore(storage);
  });

  it('save then restore returns deeply equal PageState for any valid PageState', () => {
    fc.assert(
      fc.property(arbRouteKey, arbPageState, (routeKey, pageState) => {
        store.save(routeKey, pageState);
        const restored = store.restore(routeKey);
        expect(restored).toEqual(pageState);
      }),
      { numRuns: 100 },
    );
  });

  it('round-trip preserves state independently across different route keys', () => {
    fc.assert(
      fc.property(
        arbRouteKey,
        arbRouteKey,
        arbPageState,
        arbPageState,
        (key1, key2, state1, state2) => {
          fc.pre(key1 !== key2);
          store.save(key1, state1);
          store.save(key2, state2);
          expect(store.restore(key1)).toEqual(state1);
          expect(store.restore(key2)).toEqual(state2);
        },
      ),
      { numRuns: 100 },
    );
  });
});
