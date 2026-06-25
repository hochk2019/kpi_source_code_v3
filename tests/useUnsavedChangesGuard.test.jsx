import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useUnsavedChangesGuard,
  isFormDirty,
  valuesEqual,
} from '@/hooks/useUnsavedChangesGuard';

/**
 * Tests for useUnsavedChangesGuard — verifies dirty detection (Property 6 /
 * Requirement 5.1) and the navigation confirmation wiring.
 *
 * Validates: Requirements 5.1
 */

// ─── AppDialog Mock ─────────────────────────────────────────────────────────
// The hook depends on useAppDialog().confirm; stub it so we can control the
// user's confirm/cancel response without rendering the dialog tree.

let confirmResult = true;
let confirmCalls = [];

vi.mock('@/hooks/useAppDialog', () => ({
  useAppDialog: () => ({
    alert: vi.fn(),
    confirm: vi.fn((message, options) => {
      confirmCalls.push({ message, options });
      return Promise.resolve(confirmResult);
    }),
  }),
}));

describe('valuesEqual', () => {
  it('treats equal primitives as equal', () => {
    expect(valuesEqual(1, 1)).toBe(true);
    expect(valuesEqual('a', 'a')).toBe(true);
    expect(valuesEqual(NaN, NaN)).toBe(true);
    expect(valuesEqual(1, 2)).toBe(false);
  });

  it('deep-compares nested objects and arrays', () => {
    expect(valuesEqual({ a: [1, 2], b: { c: 3 } }, { a: [1, 2], b: { c: 3 } })).toBe(true);
    expect(valuesEqual({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
    expect(valuesEqual([1, 2, 3], [1, 2])).toBe(false);
  });

  it('compares Date values by time', () => {
    expect(valuesEqual(new Date(0), new Date(0))).toBe(true);
    expect(valuesEqual(new Date(0), new Date(1))).toBe(false);
  });
});

describe('isFormDirty', () => {
  it('returns false when current equals initial', () => {
    const initial = { name: 'A', tags: ['x'] };
    expect(isFormDirty(initial, { name: 'A', tags: ['x'] })).toBe(false);
  });

  it('returns true when any field differs', () => {
    const initial = { name: 'A', count: 1 };
    expect(isFormDirty(initial, { name: 'B', count: 1 })).toBe(true);
    expect(isFormDirty(initial, { name: 'A', count: 2 })).toBe(true);
  });

  it('honours a custom equality comparator', () => {
    const ciEqual = (a, b) =>
      typeof a === 'string' && typeof b === 'string'
        ? a.toLowerCase() === b.toLowerCase()
        : a === b;
    expect(isFormDirty('Hello', 'hello', ciEqual)).toBe(false);
    expect(isFormDirty('Hello', 'world', ciEqual)).toBe(true);
  });
});

describe('useUnsavedChangesGuard', () => {
  beforeEach(() => {
    confirmResult = true;
    confirmCalls = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports clean state when values match', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ initialValues: { a: 1 }, currentValues: { a: 1 } }),
    );
    expect(result.current.isDirty).toBe(false);
  });

  it('reports dirty state when values differ', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ initialValues: { a: 1 }, currentValues: { a: 2 } }),
    );
    expect(result.current.isDirty).toBe(true);
  });

  it('respects an explicit dirty flag override', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ initialValues: { a: 1 }, currentValues: { a: 1 }, dirty: true }),
    );
    expect(result.current.isDirty).toBe(true);
  });

  it('navigates without prompting when the form is clean', async () => {
    const navigate = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ initialValues: { a: 1 }, currentValues: { a: 1 } }),
    );

    let proceeded;
    await act(async () => {
      proceeded = await result.current.guardNavigation(navigate);
    });

    expect(proceeded).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(confirmCalls).toHaveLength(0);
  });

  it('prompts and navigates when dirty and the user confirms', async () => {
    confirmResult = true;
    const navigate = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ initialValues: { a: 1 }, currentValues: { a: 2 } }),
    );

    let proceeded;
    await act(async () => {
      proceeded = await result.current.guardNavigation(navigate);
    });

    expect(proceeded).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(confirmCalls).toHaveLength(1);
    expect(confirmCalls[0].options.variant).toBe('destructive');
  });

  it('prompts and blocks navigation when dirty and the user cancels', async () => {
    confirmResult = false;
    const navigate = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ initialValues: { a: 1 }, currentValues: { a: 2 } }),
    );

    let proceeded;
    await act(async () => {
      proceeded = await result.current.guardNavigation(navigate);
    });

    expect(proceeded).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(confirmCalls).toHaveLength(1);
  });

  it('registers a beforeunload guard only while dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { rerender, unmount } = renderHook(
      ({ current }) =>
        useUnsavedChangesGuard({ initialValues: { a: 1 }, currentValues: current }),
      { initialProps: { current: { a: 2 } } },
    );

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    rerender({ current: { a: 1 } });
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});
