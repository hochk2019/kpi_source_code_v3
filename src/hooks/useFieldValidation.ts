/**
 * useFieldValidation — React hook that runs Zod schema validation against
 * form field values on blur and exposes inline error messages for rendering
 * below each field.
 *
 * Validation is scheduled on blur with a small debounce that is clamped so it
 * always resolves within the 300ms budget mandated by Requirement 5.2:
 *
 *   "THE KPI_App SHALL provide inline field-level validation errors within
 *    300ms of field blur for all form inputs."
 *
 * The pure validation logic lives in `@/lib/fieldValidation` so it can be
 * unit- and property-tested in isolation (Property 7).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  validateFieldValue,
  validateFields,
  isErrorMapClean,
  type FieldSchemas,
  type FieldErrors,
} from '@/lib/fieldValidation';

/** Maximum allowed blur→error latency (Requirement 5.2). */
export const MAX_VALIDATION_DELAY_MS = 300;

export interface UseFieldValidationOptions<T extends Record<string, unknown>> {
  /** Map of field name → Zod schema. Fields without a schema are not validated. */
  schemas: FieldSchemas<T>;
  /**
   * Debounce applied between blur and validation. Clamped to
   * [0, MAX_VALIDATION_DELAY_MS] so the 300ms guarantee always holds.
   * Defaults to 0 (validate as soon as the event loop yields).
   */
  debounceMs?: number;
}

export interface UseFieldValidationReturn<T extends Record<string, unknown>> {
  /** Current error map (field → message | null). */
  errors: FieldErrors<T>;
  /** Get the error message for a single field (or null/undefined when valid). */
  getError: (field: keyof T) => string | null | undefined;
  /** True when no field currently has an error. */
  isValid: boolean;
  /**
   * Handle a field blur — schedules validation within the 300ms budget.
   * Returns immediately; the error map updates asynchronously.
   */
  handleBlur: (field: keyof T, value: unknown) => void;
  /** Validate a single field immediately and return whether it is valid. */
  validateField: (field: keyof T, value: unknown) => boolean;
  /** Validate all fields immediately, update errors, and return overall validity. */
  validateAll: (values: T) => boolean;
  /** Clear the error for a single field. */
  clearError: (field: keyof T) => void;
  /** Clear all errors. */
  reset: () => void;
}

function clampDelay(delay: number | undefined): number {
  if (typeof delay !== 'number' || Number.isNaN(delay) || delay < 0) return 0;
  return Math.min(delay, MAX_VALIDATION_DELAY_MS);
}

export function useFieldValidation<T extends Record<string, unknown>>(
  options: UseFieldValidationOptions<T>,
): UseFieldValidationReturn<T> {
  const { schemas, debounceMs } = options;
  const [errors, setErrors] = useState<FieldErrors<T>>({});

  // Keep the latest schemas in a ref so scheduled timers always use current
  // schemas without needing to be re-created on every render.
  const schemasRef = useRef(schemas);
  schemasRef.current = schemas;

  const delay = clampDelay(debounceMs);

  // Per-field debounce timers, cleared on unmount to avoid leaks / setState
  // after unmount.
  const timersRef = useRef<Map<keyof T, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const runValidation = useCallback((field: keyof T, value: unknown): string | null => {
    const schema = schemasRef.current[field];
    if (!schema) return null;
    return validateFieldValue(schema, value).error;
  }, []);

  const handleBlur = useCallback(
    (field: keyof T, value: unknown) => {
      const timers = timersRef.current;
      const existing = timers.get(field);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        timers.delete(field);
        const error = runValidation(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }, delay);

      timers.set(field, timer);
    },
    [delay, runValidation],
  );

  const validateField = useCallback(
    (field: keyof T, value: unknown): boolean => {
      const error = runValidation(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
      return !error;
    },
    [runValidation],
  );

  const validateAll = useCallback((values: T): boolean => {
    const nextErrors = validateFields(schemasRef.current, values);
    setErrors(nextErrors);
    return isErrorMapClean(nextErrors);
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const reset = useCallback(() => setErrors({}), []);

  const getError = useCallback((field: keyof T) => errors[field], [errors]);

  const isValid = useMemo(() => isErrorMapClean(errors), [errors]);

  return {
    errors,
    getError,
    isValid,
    handleBlur,
    validateField,
    validateAll,
    clearError,
    reset,
  };
}

export default useFieldValidation;
