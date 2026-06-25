/**
 * Property-based tests for Prefetch Concurrency Limit Invariant.
 *
 * Feature: system-redesign-2026, Property 3: Prefetch Concurrency Limit Invariant
 *
 * For any sequence of prefetch trigger events, the prefetch manager SHALL never
 * have more than 2 prefetch operations in-flight simultaneously at any point
 * in time.
 *
 * **Validates: Requirements 3.3**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createPrefetchManager } from '../../src/lib/prefetchManager';
import type { LoaderRegistry, PrefetchScheduler } from '../../src/lib/prefetchManager';

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** A no-op scheduler that never fires timers (we call prefetch directly). */
const inertScheduler: PrefetchScheduler = {
  setTimeout: () => 0,
  clearTimeout: () => {},
};

/** In-memory storage stub. */
function createMockStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

/**
 * Creates a loader registry where each loader returns a Promise that never
 * resolves. This keeps all triggered prefetches permanently "in-flight",
 * making it easy to observe the concurrency limit.
 */
function createNeverResolvingRegistry(routeKeys: string[]): LoaderRegistry {
  const registry: LoaderRegistry = {};
  for (const key of routeKeys) {
    registry[key] = () => new Promise(() => {});
  }
  return registry;
}

/**
 * Creates a loader registry where loaders resolve after being awaited once
 * via microtask. This lets us simulate mixed scenarios: some in-flight,
 * some completed.
 */
function createMicrotaskRegistry(routeKeys: string[]): {
  registry: LoaderRegistry;
  flush: () => Promise<void>;
} {
  const resolvers: Array<() => void> = [];
  const registry: LoaderRegistry = {};
  for (const key of routeKeys) {
    registry[key] = () =>
      new Promise<void>((resolve) => {
        resolvers.push(resolve);
      });
  }
  const flush = async () => {
    // Resolve all pending loaders and allow microtask queue to drain
    const batch = resolvers.splice(0);
    for (const r of batch) r();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { registry, flush };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Pool of route keys to pick from. */
const ROUTE_POOL = [
  'DataImporter',
  'RulesEditor',
  'ReportViewer',
  'TeamManager',
  'MSTAssignment',
  'KPIAdjustments',
  'AccountManager',
  'HQAgencyManager',
  'DataHealthDashboard',
  'AuditLog',
  'AiAssistant',
  'ReportCenter',
  'AppDashboardLanding',
];

/** Arbitrary for a sequence of prefetch route keys (allows duplicates). */
const prefetchSequenceArb = fc.array(
  fc.constantFrom(...ROUTE_POOL),
  { minLength: 1, maxLength: 30 },
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 3: Prefetch Concurrency Limit Invariant', () => {
  it(
    'inFlightCount never exceeds 2 for any sequence of synchronous prefetch triggers with non-resolving loaders',
    () => {
      fc.assert(
        fc.property(prefetchSequenceArb, (sequence) => {
          const registry = createNeverResolvingRegistry(ROUTE_POOL);
          const manager = createPrefetchManager({
            loaders: registry,
            maxConcurrent: 2,
            scheduler: inertScheduler,
            storage: createMockStorage(),
          });

          // Fire all prefetch triggers in sequence, checking invariant at each step
          for (const routeKey of sequence) {
            manager.prefetch(routeKey);
            expect(manager.inFlightCount()).toBeLessThanOrEqual(2);
          }

          // Final check after all triggers
          expect(manager.inFlightCount()).toBeLessThanOrEqual(2);

          manager.dispose();
        }),
        { numRuns: 200 },
      );
    },
  );

  it(
    'inFlightCount never exceeds 2 even when the same route is triggered multiple times',
    () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...ROUTE_POOL), { minLength: 2, maxLength: 40 }),
          (sequence) => {
            const registry = createNeverResolvingRegistry(ROUTE_POOL);
            const manager = createPrefetchManager({
              loaders: registry,
              maxConcurrent: 2,
              scheduler: inertScheduler,
              storage: createMockStorage(),
            });

            for (const routeKey of sequence) {
              manager.prefetch(routeKey);
              const count = manager.inFlightCount();
              expect(count).toBeGreaterThanOrEqual(0);
              expect(count).toBeLessThanOrEqual(2);
            }

            manager.dispose();
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  it(
    'inFlightCount never exceeds 2 after interleaved prefetch triggers and completions',
    async () => {
      await fc.assert(
        fc.asyncProperty(prefetchSequenceArb, async (sequence) => {
          const { registry, flush } = createMicrotaskRegistry(ROUTE_POOL);
          const manager = createPrefetchManager({
            loaders: registry,
            maxConcurrent: 2,
            scheduler: inertScheduler,
            storage: createMockStorage(),
          });

          // Interleave: trigger some, flush some, trigger more
          const midpoint = Math.floor(sequence.length / 2);

          // First batch
          for (let i = 0; i < midpoint; i++) {
            manager.prefetch(sequence[i]);
            expect(manager.inFlightCount()).toBeLessThanOrEqual(2);
          }

          // Let some complete
          await flush();

          // Second batch
          for (let i = midpoint; i < sequence.length; i++) {
            manager.prefetch(sequence[i]);
            expect(manager.inFlightCount()).toBeLessThanOrEqual(2);
          }

          // Final flush and check
          await flush();
          expect(manager.inFlightCount()).toBeLessThanOrEqual(2);

          manager.dispose();
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'inFlightCount is bounded by min(unique-triggered-keys, 2) for non-resolving loaders',
    () => {
      fc.assert(
        fc.property(prefetchSequenceArb, (sequence) => {
          const registry = createNeverResolvingRegistry(ROUTE_POOL);
          const manager = createPrefetchManager({
            loaders: registry,
            maxConcurrent: 2,
            scheduler: inertScheduler,
            storage: createMockStorage(),
          });

          for (const routeKey of sequence) {
            manager.prefetch(routeKey);
          }

          const uniqueTriggered = new Set(sequence).size;
          const expectedMax = Math.min(uniqueTriggered, 2);
          expect(manager.inFlightCount()).toBeLessThanOrEqual(expectedMax);

          manager.dispose();
        }),
        { numRuns: 200 },
      );
    },
  );
});
