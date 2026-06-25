/**
 * useNavigationState — React hook that auto-saves page state on route/tab leave
 * and auto-restores it on return, backed by NavigationStateStore (sessionStorage).
 *
 * The KPI app navigates between Page_Modules via an internal tab value
 * (see useKpiShellState) rather than react-router routes, so the caller passes
 * an explicit `routeKey` (typically the active tab id). The hook saves the
 * current page state when the routeKey changes (leave) or the component
 * unmounts, and restores the saved state when a routeKey is (re)entered.
 *
 * Requirement 4.4: Preserve scroll position and filter state when navigating
 * back to a previously visited Page_Module within the same session.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  createNavigationStateStore,
  type PageState,
  type NavigationStateStore,
} from '@/lib/navigationStateStore';

// ─── Shared Store Instance ─────────────────────────────────────────────────

let sharedStore: NavigationStateStore | null = null;

function getDefaultStore(): NavigationStateStore {
  if (!sharedStore) {
    sharedStore = createNavigationStateStore();
  }
  return sharedStore;
}

// ─── Default Scroll Adapters ───────────────────────────────────────────────

function defaultGetScrollTop(): number {
  if (typeof window === 'undefined') return 0;
  return window.scrollY || document.documentElement?.scrollTop || 0;
}

function defaultScrollTo(top: number): void {
  if (typeof window === 'undefined') return;
  window.scrollTo(0, top);
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export interface UseNavigationStateOptions {
  /** If true, auto-restores scroll position on route enter. Default: true */
  restoreScroll?: boolean;
  /** Read the current scroll position. Defaults to window scroll. */
  getScrollTop?: () => number;
  /** Apply a restored scroll position. Defaults to window.scrollTo. */
  scrollTo?: (top: number) => void;
  /** Injectable store (primarily for testing). Defaults to shared sessionStorage store. */
  store?: NavigationStateStore;
}

export interface UseNavigationStateReturn {
  /** Manually save the current page state (merges with tracked filters/sort). */
  saveState: (state?: Partial<PageState>) => void;
  /** Get the restored state for the current route (or null). */
  getRestoredState: () => PageState | null;
  /** Update filters state — persisted on next save or route leave. */
  setFilters: (filters: Record<string, unknown>) => void;
  /** Update sort state — persisted on next save or route leave. */
  setSort: (column: string, direction: 'asc' | 'desc') => void;
  /** Clear stored state for this route. */
  clearState: () => void;
}

export function useNavigationState(
  routeKey: string,
  options: UseNavigationStateOptions = {},
): UseNavigationStateReturn {
  const { restoreScroll = true } = options;

  const store = options.store ?? getDefaultStore();

  // Keep mutable adapters in refs so changing identities don't re-trigger the
  // save/restore effect (which would cause a save→restore loop every render).
  const getScrollTopRef = useRef(options.getScrollTop ?? defaultGetScrollTop);
  getScrollTopRef.current = options.getScrollTop ?? defaultGetScrollTop;
  const scrollToRef = useRef(options.scrollTo ?? defaultScrollTo);
  scrollToRef.current = options.scrollTo ?? defaultScrollTo;

  // Tracks the in-progress page state (filters/sort) without forcing re-renders.
  const stateRef = useRef<Partial<PageState>>({});

  const buildPageState = useCallback((): PageState => {
    const current = stateRef.current;
    return {
      scrollTop: getScrollTopRef.current(),
      filters: (current.filters as Record<string, unknown>) ?? {},
      ...(current.sortColumn ? { sortColumn: current.sortColumn } : {}),
      ...(current.sortDirection ? { sortDirection: current.sortDirection } : {}),
    };
  }, []);

  // Auto-restore on route enter; auto-save on route leave / unmount.
  useEffect(() => {
    const restored = store.restore(routeKey);
    if (restored) {
      stateRef.current = restored;
      if (restoreScroll && restored.scrollTop > 0) {
        const top = restored.scrollTop;
        // Defer to allow the incoming page to render before scrolling.
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => scrollToRef.current(top));
        } else {
          scrollToRef.current(top);
        }
      }
    } else {
      stateRef.current = {};
    }

    return () => {
      store.save(routeKey, buildPageState());
    };
  }, [routeKey, restoreScroll, store, buildPageState]);

  const saveState = useCallback(
    (state: Partial<PageState> = {}) => {
      stateRef.current = { ...stateRef.current, ...state };
      const pageState = buildPageState();
      // Allow an explicit scrollTop override when provided.
      if (typeof state.scrollTop === 'number') {
        pageState.scrollTop = state.scrollTop;
      }
      store.save(routeKey, pageState);
    },
    [routeKey, store, buildPageState],
  );

  const getRestoredState = useCallback(() => store.restore(routeKey), [routeKey, store]);

  const setFilters = useCallback((filters: Record<string, unknown>) => {
    stateRef.current = { ...stateRef.current, filters };
  }, []);

  const setSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    stateRef.current = { ...stateRef.current, sortColumn: column, sortDirection: direction };
  }, []);

  const clearState = useCallback(() => {
    stateRef.current = {};
    store.clear(routeKey);
  }, [routeKey, store]);

  return {
    saveState,
    getRestoredState,
    setFilters,
    setSort,
    clearState,
  };
}
