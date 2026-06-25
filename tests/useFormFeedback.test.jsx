import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * Unit tests for the useFormFeedback hook.
 *
 * Validates: Requirements 5.3 (success toast) and 5.4 (error toast with retry +
 * preserve form values on failed submission).
 */

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('@/shared/toast', () => ({
  toast: toastMock,
}));

const { useFormFeedback } = await import('@/hooks/useFormFeedback');

beforeEach(() => {
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});

describe('useFormFeedback', () => {
  it('notifySuccess shows a success toast', () => {
    const { result } = renderHook(() => useFormFeedback());
    act(() => result.current.notifySuccess('Saved!'));
    expect(toastMock.success).toHaveBeenCalledWith('Saved!', undefined);
  });

  it('notifyError shows an error toast with a retry action', () => {
    const onRetry = vi.fn();
    const { result } = renderHook(() => useFormFeedback());

    act(() => result.current.notifyError('Failed!', { onRetry, retryLabel: 'Again' }));

    expect(toastMock.error).toHaveBeenCalledTimes(1);
    const [message, options] = toastMock.error.mock.calls[0];
    expect(message).toBe('Failed!');
    expect(options.action.label).toBe('Again');

    options.action.onClick();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('notifyError without onRetry omits the action', () => {
    const { result } = renderHook(() => useFormFeedback());
    act(() => result.current.notifyError('Oops'));
    const [, options] = toastMock.error.mock.calls[0];
    expect(options.action).toBeUndefined();
  });

  it('submit shows success toast and returns data on success', async () => {
    const { result } = renderHook(() => useFormFeedback());
    const values = { name: 'An' };

    let outcome;
    await act(async () => {
      outcome = await result.current.submit(async () => 'ok', values, {
        successMessage: 'Done',
      });
    });

    expect(outcome).toEqual({ ok: true, data: 'ok' });
    expect(toastMock.success).toHaveBeenCalledWith('Done', undefined);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('submit preserves form values and shows retry on failure', async () => {
    const { result } = renderHook(() => useFormFeedback());
    const values = { name: 'An', email: 'a@b.com' };
    const failingAction = vi.fn(async () => {
      throw new Error('network');
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.submit(failingAction, values, { errorMessage: 'Nope' });
    });

    expect(outcome.ok).toBe(false);
    // Values returned unchanged (preserved) for the form to keep.
    expect(outcome.values).toEqual(values);
    expect(outcome.values).toBe(values);
    expect(toastMock.error).toHaveBeenCalledTimes(1);

    // Retry action re-runs the same submit.
    const [, options] = toastMock.error.mock.calls[0];
    await act(async () => {
      options.action.onClick();
    });
    expect(failingAction).toHaveBeenCalledTimes(2);
  });
});
