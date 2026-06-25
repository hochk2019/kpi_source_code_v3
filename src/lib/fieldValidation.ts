/**
 * fieldValidation — pure, framework-agnostic helpers for running Zod schema
 * validation against individual form field values.
 *
 * The logic here is intentionally side-effect free so it can be unit-tested
 * and property-tested in isolation (see Property 7) and reused by the
 * `useFieldValidation` React hook.
 *
 * Requirement 5.2: THE KPI_App SHALL provide inline field-level validation
 * errors within 300ms of field blur for all form inputs.
 *
 * Property 7 (Field Validation Error Generation): for any field value that
 * does not satisfy its Zod schema, the validation function returns a non-empty
 * error message string; for any value that satisfies the schema it returns no
 * error (null).
 */

import type { ZodType } from 'zod';

/** Fallback message used when a Zod issue carries an empty message string. */
export const DEFAULT_INVALID_MESSAGE = 'Giá trị không hợp lệ.';

export interface FieldValidationResult {
  /** True when the value satisfies the schema. */
  valid: boolean;
  /** Non-empty error message when invalid; null when valid. */
  error: string | null;
}

/**
 * Validate a single value against a Zod schema.
 *
 * Guarantees (Property 7):
 * - invalid value → `valid: false` and a non-empty `error` string
 * - valid value   → `valid: true` and `error: null`
 */
export function validateFieldValue(schema: ZodType, value: unknown): FieldValidationResult {
  const result = schema.safeParse(value);

  if (result.success) {
    return { valid: true, error: null };
  }

  const firstIssue = result.error.issues[0];
  const rawMessage = firstIssue?.message ?? '';
  const message = rawMessage.trim().length > 0 ? rawMessage : DEFAULT_INVALID_MESSAGE;

  return { valid: false, error: message };
}

/** A map of field name → Zod schema. */
export type FieldSchemas<T extends Record<string, unknown> = Record<string, unknown>> = Partial<
  Record<keyof T, ZodType>
>;

/** A map of field name → error message (null when the field is valid). */
export type FieldErrors<T extends Record<string, unknown> = Record<string, unknown>> = Partial<
  Record<keyof T, string | null>
>;

/**
 * Validate every field that has an associated schema and return a map of
 * field name → error message (null when valid). Fields without a schema are
 * skipped (treated as always-valid).
 */
export function validateFields<T extends Record<string, unknown>>(
  schemas: FieldSchemas<T>,
  values: T,
): FieldErrors<T> {
  const errors: FieldErrors<T> = {};

  (Object.keys(schemas) as Array<keyof T>).forEach((field) => {
    const schema = schemas[field];
    if (!schema) return;
    errors[field] = validateFieldValue(schema, values[field]).error;
  });

  return errors;
}

/** Returns true when an error map contains no non-null error messages. */
export function isErrorMapClean<T extends Record<string, unknown>>(errors: FieldErrors<T>): boolean {
  return (Object.keys(errors) as Array<keyof T>).every((field) => !errors[field]);
}
