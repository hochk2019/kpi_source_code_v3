/**
 * BackgroundOperationsStore — tracks long-running background operations
 * (sync, import, export) so the application shell can render a persistent,
 * non-blocking status indicator while they are in progress.
 *
 * The store is framework-agnostic and exposes a `useSyncExternalStore`-friendly
 * subscribe/getSnapshot pair. A shared singleton is provided for app use; a
 * factory (`createBackgroundOperationsStore`) is exported for isolated testing.
 *
 * Requirement 4.5: WHILE a background operation is in progress (sync, import,
 * export), THE KPI_App SHALL display a persistent non-blocking status indicator
 * in the application shell.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type BackgroundOperationKind = 'sync' | 'import' | 'export';

export type BackgroundOperationStatus = 'running' | 'success' | 'error';

export interface BackgroundOperation {
  /** Stable unique id for the operation */
  id: string;
  /** Operation category — drives the icon/label shown in the indicator */
  kind: BackgroundOperationKind;
  /** Human-readable label, e.g. "Đồng bộ ECUS" */
  label: string;
  /** Current lifecycle status */
  status: BackgroundOperationStatus;
  /** Optional completion progress in the range [0, 1] */
  progress?: number;
  /** Epoch ms when the operation was started */
  startedAt: number;
  /** Epoch ms when the operation finished (success/error), if applicable */
  finishedAt?: number;
}

export interface StartOperationInput {
  /** Optional explicit id; auto-generated when omitted */
  id?: string;
  kind: BackgroundOperationKind;
  label: string;
  progress?: number;
}

export interface BackgroundOperationsStore {
  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Snapshot of the current operations (stable reference between changes). */
  getSnapshot(): BackgroundOperation[];
  /** Register a new running operation and return its id. */
  start(input: StartOperationInput): string;
  /** Patch an existing operation (e.g. progress updates). */
  update(id: string, patch: Partial<Omit<BackgroundOperation, 'id'>>): void;
  /** Mark an operation finished with success/error status. */
  complete(id: string, status?: Extract<BackgroundOperationStatus, 'success' | 'error'>): void;
  /** Remove an operation from the store entirely. */
  remove(id: string): void;
  /** Remove every tracked operation. */
  clear(): void;
}

// ─── Implementation ──────────────────────────────────────────────────────────

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `bg-op-${Date.now().toString(36)}-${idCounter}`;
}

function now(): number {
  return typeof Date.now === 'function' ? Date.now() : new Date().getTime();
}

export function createBackgroundOperationsStore(): BackgroundOperationsStore {
  let operations: BackgroundOperation[] = [];
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot(): BackgroundOperation[] {
      return operations;
    },

    start(input: StartOperationInput): string {
      const id = input.id ?? nextId();
      const op: BackgroundOperation = {
        id,
        kind: input.kind,
        label: input.label,
        status: 'running',
        startedAt: now(),
        ...(typeof input.progress === 'number' ? { progress: input.progress } : {}),
      };
      // Replace any existing op with the same id (idempotent start).
      operations = [...operations.filter((existing) => existing.id !== id), op];
      emit();
      return id;
    },

    update(id: string, patch: Partial<Omit<BackgroundOperation, 'id'>>): void {
      let changed = false;
      const next = operations.map((op) => {
        if (op.id !== id) return op;
        changed = true;
        return { ...op, ...patch };
      });
      if (changed) {
        operations = next;
        emit();
      }
    },

    complete(id: string, status: Extract<BackgroundOperationStatus, 'success' | 'error'> = 'success'): void {
      let changed = false;
      const next = operations.map((op) => {
        if (op.id !== id) return op;
        changed = true;
        return { ...op, status, finishedAt: now() };
      });
      if (changed) {
        operations = next;
        emit();
      }
    },

    remove(id: string): void {
      const next = operations.filter((op) => op.id !== id);
      if (next.length !== operations.length) {
        operations = next;
        emit();
      }
    },

    clear(): void {
      if (operations.length > 0) {
        operations = [];
        emit();
      }
    },
  };
}

// ─── Shared Singleton ────────────────────────────────────────────────────────

export const backgroundOperationsStore: BackgroundOperationsStore =
  createBackgroundOperationsStore();

/** Count operations still running. */
export function countRunning(operations: BackgroundOperation[]): number {
  return operations.filter((op) => op.status === 'running').length;
}
