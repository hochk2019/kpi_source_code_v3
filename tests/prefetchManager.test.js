import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPrefetchManager, selectTopN } from '@/lib/prefetchManager';

/**
 * Unit tests for PrefetchManager — hover/idle prefetch intent, concurrency
 * limiting, readiness tracking, and frequency persistence.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

// ─── In-Memory Storage Mock ────────────────────────────────────────────────

function createMockStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
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

// ─── Controllable Loader ───────────────────────────────────────────────────

/**
 * Creates a loader whose resolution is controlled manually, so concurrency
 * can be observed while modules are "in flight".
 */
function createControllableLoader() {
  let resolveFn;
  let rejectFn;
  const calls = { count: 0 };
  const loader = () => {
    calls.count += 1;
    return new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
  };
  return {
    loader,
    calls,
    resolve: (value) => resolveFn?.(value),
    reject: (err) => rejectFn?.(err),
  };
}

// Drain queued microtasks (the loader promise chain spans several ticks).
async function flush() {
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

// ─── selectTopN (Property 2 helper) ────────────────────────────────────────

describe('selectTopN', () => {
  it('returns the N highest visitCount entries in descending order', () => {
    const entries = [
      { routeKey: 'a', visitCount: 1 },
      { routeKey: 'b', visitCount: 9 },
      { routeKey: 'c', visitCount: 5 },
      { routeKey: 'd', visitCount: 3 },
    ];
    const top = selectTopN(entries, 2);
    expect(top.map((e) => e.routeKey)).toEqual(['b', 'c']);
  });

  it('returns min(N, length) items when N exceeds length', () => {
    const entries = [{ routeKey: 'a', visitCount: 1 }];
    expect(selectTopN(entries, 5)).toHaveLength(1);
  });

  it('returns empty array for N <= 0', () => {
    const entries = [{ routeKey: 'a', visitCount: 1 }];
    expect(selectTopN(entries, 0)).toEqual([]);
    expect(selectTopN(entries, -3)).toEqual([]);
  });

  it('every returned item has visitCount >= every non-returned item', () => {
    const entries = [
      { routeKey: 'a', visitCount: 4 },
      { routeKey: 'b', visitCount: 8 },
      { routeKey: 'c', visitCount: 2 },
      { routeKey: 'd', visitCount: 6 },
    ];
    const top = selectTopN(entries, 2);
    const returned = new Set(top.map((e) => e.routeKey));
    const notReturned = entries.filter((e) => !returned.has(e.routeKey));
    const minReturned = Math.min(...top.map((e) => e.visitCount));
    const maxNotReturned = Math.max(...notReturned.map((e) => e.visitCount));
    expect(minReturned).toBeGreaterThanOrEqual(maxNotReturned);
  });

  it('does not mutate the input array', () => {
    const entries = [
      { routeKey: 'a', visitCount: 1 },
      { routeKey: 'b', visitCount: 9 },
    ];
    selectTopN(entries, 1);
    expect(entries.map((e) => e.routeKey)).toEqual(['a', 'b']);
  });
});

// ─── PrefetchManager ─────────────────────────────────────────────────────────

describe('PrefetchManager', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
    vi.useFakeTimers();
  });

  function makeLoaders(keys) {
    const controls = {};
    const loaders = {};
    for (const key of keys) {
      const c = createControllableLoader();
      controls[key] = c;
      loaders[key] = c.loader;
    }
    return { loaders, controls };
  }

  describe('prefetch and readiness (Req 3.4)', () => {
    it('marks a module ready after its loader resolves', async () => {
      const { loaders, controls } = makeLoaders(['DataImporter']);
      const mgr = createPrefetchManager({ loaders, storage });

      mgr.prefetch('DataImporter');
      expect(mgr.isReady('DataImporter')).toBe(false);
      expect(mgr.inFlightCount()).toBe(1);

      controls.DataImporter.resolve();
      await flush();

      expect(mgr.isReady('DataImporter')).toBe(true);
      expect(mgr.inFlightCount()).toBe(0);
    });

    it('does not mark ready when the loader rejects (allows retry)', async () => {
      const { loaders, controls } = makeLoaders(['RulesEditor']);
      const mgr = createPrefetchManager({ loaders, storage });

      mgr.prefetch('RulesEditor');
      controls.RulesEditor.reject(new Error('network'));
      await flush();

      expect(mgr.isReady('RulesEditor')).toBe(false);
      expect(mgr.inFlightCount()).toBe(0);
    });

    it('ignores unknown route keys with no loader', () => {
      const { loaders } = makeLoaders(['DataImporter']);
      const mgr = createPrefetchManager({ loaders, storage });
      mgr.prefetch('DoesNotExist');
      expect(mgr.inFlightCount()).toBe(0);
    });

    it('does not start a second load for an already-ready module', async () => {
      const { loaders, controls } = makeLoaders(['DataImporter']);
      const mgr = createPrefetchManager({ loaders, storage });

      mgr.prefetch('DataImporter');
      controls.DataImporter.resolve();
      await flush();
      mgr.prefetch('DataImporter');

      expect(controls.DataImporter.calls.count).toBe(1);
    });
  });

  describe('concurrency limit (Req 3.3 / Property 3)', () => {
    it('never exceeds 2 in-flight prefetches', async () => {
      const keys = ['a', 'b', 'c', 'd'];
      const { loaders, controls } = makeLoaders(keys);
      const mgr = createPrefetchManager({ loaders, storage });

      keys.forEach((k) => mgr.prefetch(k));
      expect(mgr.inFlightCount()).toBe(2);

      // Resolve one — a queued one should take its slot, still capped at 2.
      controls.a.resolve();
      await flush();
      expect(mgr.inFlightCount()).toBe(2);

      controls.b.resolve();
      controls.c.resolve();
      await flush();
      expect(mgr.inFlightCount()).toBeLessThanOrEqual(2);

      controls.d.resolve();
      await flush();
      expect(mgr.inFlightCount()).toBe(0);
    });

    it('eventually loads all queued modules', async () => {
      const keys = ['a', 'b', 'c'];
      const { loaders, controls } = makeLoaders(keys);
      const mgr = createPrefetchManager({ loaders, storage });

      keys.forEach((k) => mgr.prefetch(k));
      controls.a.resolve();
      await flush();
      controls.b.resolve();
      await flush();
      controls.c.resolve();
      await flush();

      keys.forEach((k) => expect(mgr.isReady(k)).toBe(true));
    });
  });

  describe('hover dwell (Req 3.1)', () => {
    it('prefetches after 200ms of dwell', () => {
      const { loaders } = makeLoaders(['DataImporter']);
      const mgr = createPrefetchManager({ loaders, storage });

      mgr.onHoverStart('DataImporter');
      expect(mgr.inFlightCount()).toBe(0);

      vi.advanceTimersByTime(199);
      expect(mgr.inFlightCount()).toBe(0);

      vi.advanceTimersByTime(1);
      expect(mgr.inFlightCount()).toBe(1);
    });

    it('cancels prefetch if hover ends before 200ms', () => {
      const { loaders } = makeLoaders(['DataImporter']);
      const mgr = createPrefetchManager({ loaders, storage });

      mgr.onHoverStart('DataImporter');
      vi.advanceTimersByTime(150);
      mgr.onHoverEnd('DataImporter');
      vi.advanceTimersByTime(100);

      expect(mgr.inFlightCount()).toBe(0);
    });
  });

  describe('idle prefetch (Req 3.2)', () => {
    it('prefetches top-3 most-visited pages after 3s of inactivity', () => {
      const keys = ['a', 'b', 'c', 'd', 'e'];
      const { loaders } = makeLoaders(keys);
      const mgr = createPrefetchManager({ loaders, storage });

      mgr.setFrequencyData(
        new Map([
          ['a', 10],
          ['b', 8],
          ['c', 6],
          ['d', 2],
          ['e', 1],
        ]),
      );

      mgr.notifyActivity();
      vi.advanceTimersByTime(3000);

      // Top-3 are a, b, c; concurrency caps in-flight at 2 with c queued.
      expect(mgr.inFlightCount()).toBe(2);
    });

    it('resets the idle timer on new activity', () => {
      const { loaders } = makeLoaders(['a']);
      const mgr = createPrefetchManager({ loaders, storage });
      mgr.setFrequencyData(new Map([['a', 5]]));

      mgr.notifyActivity();
      vi.advanceTimersByTime(2000);
      mgr.notifyActivity(); // reset
      vi.advanceTimersByTime(2000);
      expect(mgr.inFlightCount()).toBe(0);

      vi.advanceTimersByTime(1000);
      expect(mgr.inFlightCount()).toBe(1);
    });
  });

  describe('frequency persistence', () => {
    it('records visits and persists them to storage', () => {
      const { loaders } = makeLoaders(['a']);
      const mgr = createPrefetchManager({ loaders, storage });

      mgr.recordVisit('a');
      mgr.recordVisit('a');

      const stored = JSON.parse(storage.getItem('nav-frequency'));
      const entry = stored.find((e) => e.routeKey === 'a');
      expect(entry.visitCount).toBe(2);
    });

    it('seeds frequency data from storage on creation', () => {
      const seeded = createMockStorage({
        'nav-frequency': JSON.stringify([
          { routeKey: 'a', visitCount: 7, lastVisitedAt: 1 },
          { routeKey: 'b', visitCount: 3, lastVisitedAt: 1 },
        ]),
      });
      const { loaders } = makeLoaders(['a', 'b']);
      const mgr = createPrefetchManager({ loaders, storage: seeded, idlePrefetchCount: 1 });

      mgr.notifyActivity();
      vi.advanceTimersByTime(3000);
      // Top-1 by stored visitCount is 'a'.
      expect(mgr.inFlightCount()).toBe(1);
    });

    it('ignores malformed storage payloads', () => {
      const bad = createMockStorage({ 'nav-frequency': '{not json' });
      const { loaders } = makeLoaders(['a']);
      expect(() => createPrefetchManager({ loaders, storage: bad })).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('cancels pending hover and idle timers', () => {
      const { loaders } = makeLoaders(['a']);
      const mgr = createPrefetchManager({ loaders, storage });
      mgr.setFrequencyData(new Map([['a', 1]]));

      mgr.onHoverStart('a');
      mgr.notifyActivity();
      mgr.dispose();

      vi.advanceTimersByTime(5000);
      expect(mgr.inFlightCount()).toBe(0);
    });
  });
});
