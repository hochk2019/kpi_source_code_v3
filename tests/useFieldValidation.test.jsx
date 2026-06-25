import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { useFieldValidation, MAX_VALIDATION_DELAY_MS } from '@/hooks/useFieldValidation';

/**
 * Unit tests for the useFieldValidation hook.
 *
 * Validates: Requirements 5.2 (inline validation within 300ms of blur).
 */

const schemas = {
  name: z.string().min(1, 'Bắt buộc.'),
  email: z.string().email('Email không hợp lệ.'),
};

describe('useFieldValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces an error on blur of an invalid field within the 300ms budget', () => {
    const { result } = renderHook(() => useFieldValidation({ schemas }));

    act(() => {
      result.current.handleBlur('email', 'not-an-email');
    });

    // No error before the scheduled validation fires.
    expect(result.current.getError('email')).toBeUndefined();

    act(() => {
      vi.advanceTimersByTime(MAX_VALIDATION_DELAY_MS);
    });

    expect(result.current.getError('email')).toBe('Email không hợp lệ.');
    expect(result.current.isValid).toBe(false);
  });

  it('produces no error on blur of a valid field', () => {
    const { result } = renderHook(() => useFieldValidation({ schemas }));

    act(() => {
      result.current.handleBlur('email', 'user@example.com');
      vi.advanceTimersByTime(MAX_VALIDATION_DELAY_MS);
    });

    expect(result.current.getError('email')).toBeNull();
    expect(result.current.isValid).toBe(true);
  });

  it('clamps an over-large debounce so validation still resolves within 300ms', () => {
    const { result } = renderHook(() =>
      useFieldValidation({ schemas, debounceMs: 5000 }),
    );

    act(() => {
      result.current.handleBlur('name', '');
      vi.advanceTimersByTime(MAX_VALIDATION_DELAY_MS);
    });

    expect(result.current.getError('name')).toBe('Bắt buộc.');
  });

  it('debounces rapid blurs to a single validation run', () => {
    const { result } = renderHook(() => useFieldValidation({ schemas, debounceMs: 100 }));

    act(() => {
      result.current.handleBlur('name', '');
      vi.advanceTimersByTime(50);
      // Second blur with a now-valid value resets the timer.
      result.current.handleBlur('name', 'Valid');
      vi.advanceTimersByTime(100);
    });

    expect(result.current.getError('name')).toBeNull();
  });

  it('validateField runs immediately and returns validity', () => {
    const { result } = renderHook(() => useFieldValidation({ schemas }));

    let valid;
    act(() => {
      valid = result.current.validateField('name', '');
    });

    expect(valid).toBe(false);
    expect(result.current.getError('name')).toBe('Bắt buộc.');
  });

  it('validateAll validates every field and returns overall validity', () => {
    const { result } = renderHook(() => useFieldValidation({ schemas }));

    let valid;
    act(() => {
      valid = result.current.validateAll({ name: '', email: 'bad' });
    });

    expect(valid).toBe(false);
    expect(result.current.errors.name).toBe('Bắt buộc.');
    expect(result.current.errors.email).toBe('Email không hợp lệ.');

    act(() => {
      valid = result.current.validateAll({ name: 'An', email: 'a@b.com' });
    });

    expect(valid).toBe(true);
    expect(result.current.isValid).toBe(true);
  });

  it('clearError and reset remove errors', () => {
    const { result } = renderHook(() => useFieldValidation({ schemas }));

    act(() => {
      result.current.validateAll({ name: '', email: 'bad' });
    });
    expect(result.current.isValid).toBe(false);

    act(() => {
      result.current.clearError('name');
    });
    expect(result.current.getError('name')).toBeUndefined();

    act(() => {
      result.current.reset();
    });
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });
});
