import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNavigationState } from '@/hooks/useNavigationState';
import { createNavigationStateStore } from '@/lib/navigationStateStore';

/**
 * Tests for useNavigationState — verifies the auto-save-on-leave /
 * auto-restore-on-return wiring around NavigationStateStore.
 *
 * Validates: Requirements 4.4
 */

// ─── In-Memory Storage Mock ────────────────────────────────────────────────

function createMockStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

describe('useNavigationState', () => {
  let store;
  let scrollTop;

  beforeEach(() => {
    store = createNavigationStateStore(createMockStorage());
    scrollTop = 0;
    // Run scroll-restore rAF callbacks synchronously for deterministic assertions.
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      cb(0);
      return 0;
    });
  });

  function options(overrides = {}) {
    return {
      store,
      getScrollTop: () => scrollTop,
      scrollTo: (top) => {
        scrollTop = top;
      },
      ...overrides,
    };
  }

  it('saves scroll position on route leave and restores it on return', () => {
    const { rerender, unmount } = renderHook(
      ({ routeKey }) => useNavigationState(routeKey, options()),
      { initialProps: { routeKey: 'teams' } },
    );

    // User scrolls within the "teams" tab.
    scrollTop = 320;

    // Navigate to another tab → leaving "teams" should persist its scroll.
    rerender({ routeKey: 'reports' });
    expect(store.restore('teams')?.scrollTop).toBe(320);

    // Reset live scroll then navigate back to "teams" → should auto-restore.
    scrollTop = 0;
    rerender({ routeKey: 'teams' });
    expect(scrollTop).toBe(320);

    unmount();
  });

  it('persists filters set via setFilters when leaving the route', () => {
    const { result, rerender } = renderHook(
      ({ routeKey }) => useNavigationState(routeKey, options()),
      { initialProps: { routeKey: 'import' } },
    );

    act(() => {
      result.current.setFilters({ status: 'pending', q: 'abc' });
    });

    rerender({ routeKey: 'teams' });

    expect(store.restore('import')).toEqual({
      scrollTop: 0,
      filters: { status: 'pending', q: 'abc' },
    });
  });

  it('persists sort state via setSort', () => {
    const { result, rerender } = renderHook(
      ({ routeKey }) => useNavigationState(routeKey, options()),
      { initialProps: { routeKey: 'rules' } },
    );

    act(() => {
      result.current.setSort('name', 'desc');
    });

    rerender({ routeKey: 'dashboard' });

    expect(store.restore('rules')).toEqual({
      scrollTop: 0,
      filters: {},
      sortColumn: 'name',
      sortDirection: 'desc',
    });
  });

  it('saveState persists immediately without leaving the route', () => {
    const { result } = renderHook(() => useNavigationState('audit', options()));

    act(() => {
      result.current.saveState({ scrollTop: 99, filters: { level: 'error' } });
    });

    expect(store.restore('audit')).toEqual({ scrollTop: 99, filters: { level: 'error' } });
  });

  it('getRestoredState returns previously saved state for the route', () => {
    store.save('reports', { scrollTop: 150, filters: { team: 'A' } });

    const { result } = renderHook(() => useNavigationState('reports', options()));

    expect(result.current.getRestoredState()).toEqual({ scrollTop: 150, filters: { team: 'A' } });
  });

  it('clearState removes stored state for the route', () => {
    store.save('teams', { scrollTop: 10, filters: {} });

    const { result } = renderHook(() => useNavigationState('teams', options()));

    act(() => {
      result.current.clearState();
    });

    expect(store.restore('teams')).toBeNull();
  });

  it('does not restore scroll when restoreScroll is false', () => {
    store.save('teams', { scrollTop: 500, filters: {} });
    scrollTop = 0;

    renderHook(() => useNavigationState('teams', options({ restoreScroll: false })));

    expect(scrollTop).toBe(0);
  });

  it('saves state for the leaving route on unmount', () => {
    const { result, unmount } = renderHook(() => useNavigationState('ai', options()));

    act(() => {
      result.current.setFilters({ open: true });
    });
    scrollTop = 42;

    unmount();

    expect(store.restore('ai')).toEqual({ scrollTop: 42, filters: { open: true } });
  });
});
