import { describe, it, expect, beforeEach } from 'vitest';
import { createNavigationStateStore } from '@/lib/navigationStateStore';

/**
 * Unit tests for NavigationStateStore — the pure sessionStorage-backed
 * state preservation logic.
 *
 * Validates: Requirements 4.4
 */

// ─── In-Memory Storage Mock ────────────────────────────────────────────────

function createMockStorage() {
  const data = new Map();
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

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('NavigationStateStore', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  describe('save and restore', () => {
    it('saves and restores a complete PageState', () => {
      const store = createNavigationStateStore(storage);
      const state = {
        scrollTop: 250,
        filters: { search: 'hello', status: 'active' },
        sortColumn: 'name',
        sortDirection: 'asc',
      };

      store.save('dashboard', state);
      const restored = store.restore('dashboard');

      expect(restored).toEqual(state);
    });

    it('saves and restores PageState without optional fields', () => {
      const store = createNavigationStateStore(storage);
      const state = {
        scrollTop: 0,
        filters: {},
      };

      store.save('import', state);
      const restored = store.restore('import');

      expect(restored).toEqual(state);
    });

    it('returns null for a route with no saved state', () => {
      const store = createNavigationStateStore(storage);
      expect(store.restore('nonexistent')).toBeNull();
    });

    it('preserves state independently per route key', () => {
      const store = createNavigationStateStore(storage);
      const state1 = { scrollTop: 100, filters: { a: 1 } };
      const state2 = { scrollTop: 200, filters: { b: 2 }, sortColumn: 'date', sortDirection: 'desc' };

      store.save('route-a', state1);
      store.save('route-b', state2);

      expect(store.restore('route-a')).toEqual(state1);
      expect(store.restore('route-b')).toEqual(state2);
    });

    it('overwrites previous state for the same route', () => {
      const store = createNavigationStateStore(storage);
      const initial = { scrollTop: 50, filters: { x: 1 } };
      const updated = { scrollTop: 300, filters: { x: 2 }, sortColumn: 'id', sortDirection: 'asc' };

      store.save('teams', initial);
      store.save('teams', updated);

      expect(store.restore('teams')).toEqual(updated);
    });
  });

  describe('clear', () => {
    it('removes the stored state for a specific route', () => {
      const store = createNavigationStateStore(storage);
      const state = { scrollTop: 100, filters: { q: 'test' } };

      store.save('reports', state);
      store.clear('reports');

      expect(store.restore('reports')).toBeNull();
    });

    it('does not affect other routes when clearing one', () => {
      const store = createNavigationStateStore(storage);
      const state1 = { scrollTop: 10, filters: {} };
      const state2 = { scrollTop: 20, filters: { active: true } };

      store.save('route-1', state1);
      store.save('route-2', state2);
      store.clear('route-1');

      expect(store.restore('route-1')).toBeNull();
      expect(store.restore('route-2')).toEqual(state2);
    });

    it('does nothing when clearing a route that was never saved', () => {
      const store = createNavigationStateStore(storage);
      // Should not throw
      store.clear('unknown-route');
      expect(store.restore('unknown-route')).toBeNull();
    });
  });

  describe('storage key format', () => {
    it('uses nav-state:: prefix in storage keys', () => {
      const store = createNavigationStateStore(storage);
      const state = { scrollTop: 0, filters: {} };

      store.save('my-page', state);

      expect(storage.data.has('nav-state::my-page')).toBe(true);
    });
  });

  describe('error resilience', () => {
    it('returns null when storage contains invalid JSON', () => {
      storage.setItem('nav-state::broken', '{not valid json!!!');
      const store = createNavigationStateStore(storage);

      expect(store.restore('broken')).toBeNull();
    });

    it('returns null when storage contains valid JSON but wrong shape', () => {
      storage.setItem('nav-state::wrong-shape', JSON.stringify({ foo: 'bar' }));
      const store = createNavigationStateStore(storage);

      expect(store.restore('wrong-shape')).toBeNull();
    });

    it('returns null when scrollTop is not a number', () => {
      storage.setItem('nav-state::bad-scroll', JSON.stringify({ scrollTop: 'abc', filters: {} }));
      const store = createNavigationStateStore(storage);

      expect(store.restore('bad-scroll')).toBeNull();
    });

    it('returns null when filters is not an object', () => {
      storage.setItem('nav-state::bad-filters', JSON.stringify({ scrollTop: 0, filters: 'string' }));
      const store = createNavigationStateStore(storage);

      expect(store.restore('bad-filters')).toBeNull();
    });

    it('returns null when sortDirection is invalid', () => {
      storage.setItem(
        'nav-state::bad-sort',
        JSON.stringify({ scrollTop: 0, filters: {}, sortDirection: 'up' }),
      );
      const store = createNavigationStateStore(storage);

      expect(store.restore('bad-sort')).toBeNull();
    });

    it('handles storage setItem throwing (quota exceeded)', () => {
      const throwingStorage = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => {},
      };
      const store = createNavigationStateStore(throwingStorage);

      // Should not throw
      expect(() => store.save('page', { scrollTop: 0, filters: {} })).not.toThrow();
    });

    it('handles storage removeItem throwing', () => {
      const throwingStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => { throw new Error('SecurityError'); },
      };
      const store = createNavigationStateStore(throwingStorage);

      expect(() => store.clear('page')).not.toThrow();
    });
  });

  describe('complex filter values', () => {
    it('preserves nested filter objects', () => {
      const store = createNavigationStateStore(storage);
      const state = {
        scrollTop: 0,
        filters: {
          dateRange: { start: '2026-01-01', end: '2026-06-30' },
          tags: ['urgent', 'review'],
          nested: { deep: { value: 42 } },
        },
      };

      store.save('complex', state);
      expect(store.restore('complex')).toEqual(state);
    });

    it('preserves null values within filters', () => {
      const store = createNavigationStateStore(storage);
      const state = {
        scrollTop: 50,
        filters: { search: null, category: 'all' },
      };

      store.save('nullable', state);
      expect(store.restore('nullable')).toEqual(state);
    });
  });
});
