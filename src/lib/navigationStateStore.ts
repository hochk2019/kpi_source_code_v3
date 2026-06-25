/**
 * NavigationStateStore — Preserves scroll position and filter state
 * across same-session page navigation using sessionStorage.
 *
 * Requirement 4.4: Preserve scroll position and filter state when navigating
 * back to a previously visited Page_Module within the same session.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PageState {
  scrollTop: number;
  filters: Record<string, unknown>;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface NavigationStateStore {
  save(routeKey: string, state: PageState): void;
  restore(routeKey: string): PageState | null;
  clear(routeKey: string): void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'nav-state::';

// ─── Implementation ────────────────────────────────────────────────────────

function buildStorageKey(routeKey: string): string {
  return `${STORAGE_KEY_PREFIX}${routeKey}`;
}

/**
 * Creates a NavigationStateStore backed by sessionStorage.
 * Accepts an optional storage parameter for testing/injection.
 */
export function createNavigationStateStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = getSessionStorage(),
): NavigationStateStore {
  return {
    save(routeKey: string, state: PageState): void {
      const key = buildStorageKey(routeKey);
      try {
        storage.setItem(key, JSON.stringify(state));
      } catch {
        // Silently ignore quota or serialization errors — best-effort persistence.
      }
    },

    restore(routeKey: string): PageState | null {
      const key = buildStorageKey(routeKey);
      try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (isValidPageState(parsed)) {
          return parsed;
        }
        return null;
      } catch {
        return null;
      }
    },

    clear(routeKey: string): void {
      const key = buildStorageKey(routeKey);
      try {
        storage.removeItem(key);
      } catch {
        // Silently ignore removal failures.
      }
    },
  };
}

// ─── Validation ────────────────────────────────────────────────────────────

function isValidPageState(value: unknown): value is PageState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj.scrollTop !== 'number') return false;
  if (typeof obj.filters !== 'object' || obj.filters === null || Array.isArray(obj.filters)) return false;

  if (obj.sortColumn !== undefined && typeof obj.sortColumn !== 'string') return false;
  if (obj.sortDirection !== undefined && obj.sortDirection !== 'asc' && obj.sortDirection !== 'desc') return false;

  return true;
}

// ─── Storage Access ────────────────────────────────────────────────────────

function getSessionStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  // Fallback no-op storage for SSR or environments without sessionStorage
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}
