/**
 * useBackgroundOperations — React binding for the BackgroundOperationsStore.
 *
 * Components read the live list of background operations and get stable action
 * helpers to start/update/complete/remove operations. Backed by
 * `useSyncExternalStore` so any subscriber re-renders when the store changes.
 *
 * Requirement 4.5: persistent non-blocking status indicator for background
 * operations (sync, import, export).
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  backgroundOperationsStore as defaultStore,
  countRunning,
  type BackgroundOperation,
  type BackgroundOperationsStore,
  type StartOperationInput,
} from '@/lib/backgroundOperationsStore';

export interface UseBackgroundOperationsReturn {
  /** All tracked operations (running + recently finished). */
  operations: BackgroundOperation[];
  /** Operations currently running. */
  running: BackgroundOperation[];
  /** Whether at least one operation is running. */
  hasActive: boolean;
  start: (input: StartOperationInput) => string;
  update: BackgroundOperationsStore['update'];
  complete: BackgroundOperationsStore['complete'];
  remove: BackgroundOperationsStore['remove'];
  clear: BackgroundOperationsStore['clear'];
}

export function useBackgroundOperations(
  store: BackgroundOperationsStore = defaultStore,
): UseBackgroundOperationsReturn {
  const operations = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  const running = useMemo(
    () => operations.filter((op) => op.status === 'running'),
    [operations],
  );

  const start = useCallback((input: StartOperationInput) => store.start(input), [store]);
  const update = useCallback<BackgroundOperationsStore['update']>(
    (id, patch) => store.update(id, patch),
    [store],
  );
  const complete = useCallback<BackgroundOperationsStore['complete']>(
    (id, status) => store.complete(id, status),
    [store],
  );
  const remove = useCallback<BackgroundOperationsStore['remove']>(
    (id) => store.remove(id),
    [store],
  );
  const clear = useCallback(() => store.clear(), [store]);

  return {
    operations,
    running,
    hasActive: countRunning(operations) > 0,
    start,
    update,
    complete,
    remove,
    clear,
  };
}

export default useBackgroundOperations;
