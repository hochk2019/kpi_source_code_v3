/**
 * PrefetchManager — Intelligent prefetching of route-level Page_Module chunks.
 *
 * Implements advanced lazy loading so that likely-next pages begin loading
 * before the user clicks, making navigation feel instant.
 *
 *  - Hover intent: prefetch a target chunk after 200ms of dwell time.
 *  - Idle intent: after 3s of inactivity, prefetch the top-3 most-visited
 *    pages using NavigationFrequency data persisted to localStorage.
 *  - Concurrency: never run more than 2 prefetches at once.
 *  - Readiness: track which modules are already loaded so the loading
 *    skeleton can be skipped on navigation.
 *
 * The PAGE_MODULES map lives in `src/components/KPICalculator.tsx`. This
 * service is intentionally decoupled from that map: callers pass a registry
 * of loader functions (the same `() => import(...)` thunks used by
 * React.lazy), keeping this module free of React/component dependencies and
 * fully unit-testable.
 *
 * Requirements:
 *  - 3.1 Prefetch on hover after 200ms dwell time
 *  - 3.2 Idle-time prefetch of top-3 most-visited pages
 *  - 3.3 Max 2 concurrent prefetches
 *  - 3.4 Skip loading skeleton for prefetched modules (isReady)
 */

// ─── Types ─────────────────────────────────────────────────────────────────

/** A lazy module loader — the same thunk passed to React.lazy. */
export type ModuleLoader = () => Promise<unknown>;

/** Registry mapping a route key to its module loader. */
export type LoaderRegistry = Record<string, ModuleLoader>;

/**
 * Navigation frequency record, persisted to localStorage. Drives idle-time
 * prefetching of the most-visited pages.
 */
export interface NavigationFrequency {
  routeKey: string;
  visitCount: number;
  lastVisitedAt: number; // epoch milliseconds
}

/** Minimal timer abstraction so tests can inject deterministic timers. */
export interface PrefetchScheduler {
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** Minimal localStorage shape used for frequency persistence. */
export type FrequencyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface PrefetchManagerOptions {
  /** Registry of route key -> loader thunk. */
  loaders: LoaderRegistry;
  /** Maximum simultaneous in-flight prefetches. Default 2. */
  maxConcurrent?: number;
  /** Hover dwell time before prefetch begins, in ms. Default 200. */
  hoverDwellMs?: number;
  /** Inactivity window before idle prefetch begins, in ms. Default 3000. */
  idleDelayMs?: number;
  /** How many top pages to prefetch when idle. Default 3. */
  idlePrefetchCount?: number;
  /** Timer scheduler (injectable for tests). */
  scheduler?: PrefetchScheduler;
  /** Frequency storage (injectable for tests). */
  storage?: FrequencyStorage;
}

/**
 * PrefetchManager interface (per design document) plus the lifecycle hooks
 * needed to wire hover and idle intent into the application shell.
 */
export interface PrefetchManager {
  /** Begin prefetching a page module by route key (respects concurrency). */
  prefetch(routeKey: string): void;
  /** Check if a module is already prefetched and cached. */
  isReady(routeKey: string): boolean;
  /** Get current number of in-flight prefetches. */
  inFlightCount(): number;
  /** Set navigation frequency data for idle-time prefetching. */
  setFrequencyData(data: Map<string, number>): void;

  // ── Lifecycle hooks ──────────────────────────────────────────────────────
  /** Start the 200ms hover-dwell timer for a route. */
  onHoverStart(routeKey: string): void;
  /** Cancel a pending hover-dwell timer (pointer left before 200ms). */
  onHoverEnd(routeKey: string): void;
  /** Signal user activity; resets the idle timer. */
  notifyActivity(): void;
  /** Record a visit to a route, incrementing its frequency and persisting it. */
  recordVisit(routeKey: string): void;
  /** Cancel all pending timers and release resources. */
  dispose(): void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_HOVER_DWELL_MS = 200;
const DEFAULT_IDLE_DELAY_MS = 3000;
const DEFAULT_IDLE_PREFETCH_COUNT = 3;
const FREQUENCY_STORAGE_KEY = 'nav-frequency';

// ─── Pure Helpers ────────────────────────────────────────────────────────────

/**
 * Select the top-N entries by visitCount (descending).
 *
 * Returns exactly min(N, entries.length) items for N > 0, and every returned
 * item has a visitCount >= every non-returned item's visitCount.
 *
 * Validates: Requirements 3.2 (Property 2)
 */
export function selectTopN<T extends { visitCount: number }>(entries: readonly T[], n: number): T[] {
  if (n <= 0 || entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => b.visitCount - a.visitCount);
  return sorted.slice(0, Math.min(n, sorted.length));
}

// ─── Storage Access ──────────────────────────────────────────────────────────

function getLocalStorage(): FrequencyStorage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  // No-op fallback for SSR / non-browser environments.
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function isValidFrequency(value: unknown): value is NavigationFrequency {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.routeKey === 'string' &&
    typeof obj.visitCount === 'number' &&
    typeof obj.lastVisitedAt === 'number'
  );
}

function loadFrequencyFromStorage(storage: FrequencyStorage): NavigationFrequency[] {
  try {
    const raw = storage.getItem(FREQUENCY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidFrequency);
  } catch {
    return [];
  }
}

function persistFrequency(storage: FrequencyStorage, entries: NavigationFrequency[]): void {
  try {
    storage.setItem(FREQUENCY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Best-effort persistence; ignore quota/serialization failures.
  }
}

// ─── Default Scheduler ───────────────────────────────────────────────────────

const defaultScheduler: PrefetchScheduler = {
  setTimeout: (handler, ms) => setTimeout(handler, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a PrefetchManager. All collaborators (timers, storage) are injectable
 * to keep the manager deterministic and unit-testable.
 */
export function createPrefetchManager(options: PrefetchManagerOptions): PrefetchManager {
  const loaders = options.loaders;
  const maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  const hoverDwellMs = options.hoverDwellMs ?? DEFAULT_HOVER_DWELL_MS;
  const idleDelayMs = options.idleDelayMs ?? DEFAULT_IDLE_DELAY_MS;
  const idlePrefetchCount = options.idlePrefetchCount ?? DEFAULT_IDLE_PREFETCH_COUNT;
  const scheduler = options.scheduler ?? defaultScheduler;
  const storage = options.storage ?? getLocalStorage();

  // Modules fully loaded and cached.
  const ready = new Set<string>();
  // Modules whose loader is currently running.
  const inFlight = new Set<string>();
  // Route keys waiting for a free concurrency slot.
  const waiting: string[] = [];
  // Pending hover-dwell timers, keyed by route.
  const hoverTimers = new Map<string, unknown>();
  // Idle timer handle (single).
  let idleTimer: unknown = null;

  // Frequency data: seeded from storage, overridable via setFrequencyData.
  let frequency: NavigationFrequency[] = loadFrequencyFromStorage(storage);

  function frequencyEntries(): NavigationFrequency[] {
    return frequency;
  }

  function pumpQueue(): void {
    while (waiting.length > 0 && inFlight.size < maxConcurrent) {
      const next = waiting.shift();
      if (next === undefined) break;
      if (!ready.has(next) && !inFlight.has(next)) {
        startPrefetch(next);
      }
    }
  }

  function startPrefetch(routeKey: string): void {
    if (ready.has(routeKey) || inFlight.has(routeKey)) return;
    const loader = loaders[routeKey];
    if (typeof loader !== 'function') return;

    // Concurrency guard: queue when at capacity (Requirement 3.3 / Property 3).
    if (inFlight.size >= maxConcurrent) {
      if (!waiting.includes(routeKey)) waiting.push(routeKey);
      return;
    }

    inFlight.add(routeKey);
    void (async () => {
      try {
        await loader();
        ready.add(routeKey);
      } catch {
        // Leave out of `ready` so a future trigger can retry.
      } finally {
        inFlight.delete(routeKey);
        pumpQueue();
      }
    })();
  }

  function triggerIdlePrefetch(): void {
    idleTimer = null;
    const top = selectTopN(frequencyEntries(), idlePrefetchCount);
    for (const entry of top) {
      startPrefetch(entry.routeKey);
    }
  }

  return {
    prefetch(routeKey: string): void {
      startPrefetch(routeKey);
    },

    isReady(routeKey: string): boolean {
      return ready.has(routeKey);
    },

    inFlightCount(): number {
      return inFlight.size;
    },

    setFrequencyData(data: Map<string, number>): void {
      frequency = [...data.entries()].map(([routeKey, visitCount]) => {
        const existing = frequency.find((f) => f.routeKey === routeKey);
        return {
          routeKey,
          visitCount,
          lastVisitedAt: existing?.lastVisitedAt ?? 0,
        };
      });
    },

    onHoverStart(routeKey: string): void {
      if (ready.has(routeKey) || inFlight.has(routeKey)) return;
      // Reset any existing dwell timer for this route.
      const existing = hoverTimers.get(routeKey);
      if (existing !== undefined) scheduler.clearTimeout(existing);
      const handle = scheduler.setTimeout(() => {
        hoverTimers.delete(routeKey);
        startPrefetch(routeKey);
      }, hoverDwellMs);
      hoverTimers.set(routeKey, handle);
    },

    onHoverEnd(routeKey: string): void {
      const handle = hoverTimers.get(routeKey);
      if (handle !== undefined) {
        scheduler.clearTimeout(handle);
        hoverTimers.delete(routeKey);
      }
    },

    notifyActivity(): void {
      if (idleTimer !== null) scheduler.clearTimeout(idleTimer);
      idleTimer = scheduler.setTimeout(() => triggerIdlePrefetch(), idleDelayMs);
    },

    recordVisit(routeKey: string): void {
      const now = Date.now();
      const existing = frequency.find((f) => f.routeKey === routeKey);
      if (existing) {
        existing.visitCount += 1;
        existing.lastVisitedAt = now;
      } else {
        frequency.push({ routeKey, visitCount: 1, lastVisitedAt: now });
      }
      persistFrequency(storage, frequency);
    },

    dispose(): void {
      for (const handle of hoverTimers.values()) {
        scheduler.clearTimeout(handle);
      }
      hoverTimers.clear();
      if (idleTimer !== null) {
        scheduler.clearTimeout(idleTimer);
        idleTimer = null;
      }
      waiting.length = 0;
    },
  };
}
