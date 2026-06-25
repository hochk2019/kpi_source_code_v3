import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBackgroundOperationsStore,
  countRunning,
} from '@/lib/backgroundOperationsStore';

/**
 * Unit tests for BackgroundOperationsStore — the framework-agnostic store
 * backing the persistent non-blocking status indicator.
 *
 * Validates: Requirements 4.5
 */

describe('BackgroundOperationsStore', () => {
  let store;

  beforeEach(() => {
    store = createBackgroundOperationsStore();
  });

  it('starts empty', () => {
    expect(store.getSnapshot()).toEqual([]);
  });

  it('registers a running operation on start and returns its id', () => {
    const id = store.start({ kind: 'sync', label: 'Đồng bộ ECUS' });
    const ops = store.getSnapshot();

    expect(typeof id).toBe('string');
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ id, kind: 'sync', label: 'Đồng bộ ECUS', status: 'running' });
    expect(typeof ops[0].startedAt).toBe('number');
  });

  it('honours an explicit id and is idempotent on re-start', () => {
    store.start({ id: 'op-1', kind: 'import', label: 'Nhập dữ liệu' });
    store.start({ id: 'op-1', kind: 'import', label: 'Nhập dữ liệu (lần 2)' });

    const ops = store.getSnapshot();
    expect(ops).toHaveLength(1);
    expect(ops[0].label).toBe('Nhập dữ liệu (lần 2)');
  });

  it('updates an existing operation (e.g. progress)', () => {
    const id = store.start({ kind: 'export', label: 'Xuất báo cáo' });
    store.update(id, { progress: 0.5 });

    expect(store.getSnapshot()[0].progress).toBe(0.5);
  });

  it('marks an operation completed with a finish status and timestamp', () => {
    const id = store.start({ kind: 'sync', label: 'Đồng bộ' });
    store.complete(id, 'success');

    const op = store.getSnapshot()[0];
    expect(op.status).toBe('success');
    expect(typeof op.finishedAt).toBe('number');
  });

  it('defaults completion status to success', () => {
    const id = store.start({ kind: 'sync', label: 'Đồng bộ' });
    store.complete(id);
    expect(store.getSnapshot()[0].status).toBe('success');
  });

  it('removes a specific operation', () => {
    const a = store.start({ kind: 'sync', label: 'A' });
    const b = store.start({ kind: 'import', label: 'B' });
    store.remove(a);

    const ops = store.getSnapshot();
    expect(ops).toHaveLength(1);
    expect(ops[0].id).toBe(b);
  });

  it('clears all operations', () => {
    store.start({ kind: 'sync', label: 'A' });
    store.start({ kind: 'import', label: 'B' });
    store.clear();
    expect(store.getSnapshot()).toEqual([]);
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });

    store.start({ kind: 'sync', label: 'A' });
    expect(calls).toBe(1);

    unsubscribe();
    store.start({ kind: 'import', label: 'B' });
    expect(calls).toBe(1);
  });

  it('returns a stable snapshot reference when nothing changes', () => {
    const id = store.start({ kind: 'sync', label: 'A' });
    const snapshotA = store.getSnapshot();
    // No-op update on a non-existent id must not change the reference.
    store.update('does-not-exist', { progress: 1 });
    expect(store.getSnapshot()).toBe(snapshotA);

    // A real change produces a new reference.
    store.complete(id);
    expect(store.getSnapshot()).not.toBe(snapshotA);
  });

  describe('countRunning', () => {
    it('counts only running operations', () => {
      const a = store.start({ kind: 'sync', label: 'A' });
      store.start({ kind: 'import', label: 'B' });
      store.complete(a);

      expect(countRunning(store.getSnapshot())).toBe(1);
    });
  });
});
