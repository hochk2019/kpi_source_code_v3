/**
 * Structured constraint violation error handling for PostgreSQL.
 *
 * Catches PostgreSQL constraint violations (FK, NOT NULL, UNIQUE, CHECK)
 * and converts them into a structured error compatible with ApiErrorResponse.
 *
 * @module constraintViolationError
 * @see Requirements 13.4
 */

import { buildErrorResponse } from '../middleware/apiContract.js';
import type { ApiErrorResponse } from '../middleware/apiContract.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** PostgreSQL error codes for constraint violations. */
export const PG_CONSTRAINT_CODES = {
  FOREIGN_KEY: '23503',
  NOT_NULL: '23502',
  UNIQUE: '23505',
  CHECK: '23514',
} as const;

export type ConstraintViolationType = 'foreign_key' | 'not_null' | 'unique' | 'check';

export interface ConstraintViolationDetails {
  constraintName: string;
  violationType: ConstraintViolationType;
  columns: string[];
  table?: string;
  detail?: string;
}

/**
 * Custom error class thrown when a PostgreSQL constraint is violated.
 * Carries structured information about which constraint failed and why.
 */
export class ConstraintViolationError extends Error {
  readonly status = 409;
  readonly code = 'CONSTRAINT_VIOLATION';
  readonly details: ConstraintViolationDetails;

  constructor(details: ConstraintViolationDetails, originalMessage?: string) {
    const message =
      originalMessage ?? `Constraint violation: ${details.violationType} on ${details.constraintName}`;
    super(message);
    this.name = 'ConstraintViolationError';
    this.details = details;
  }

  /**
   * Converts to the standard ApiErrorResponse shape (409/CONSTRAINT_VIOLATION).
   */
  toApiErrorResponse(): ApiErrorResponse {
    return buildErrorResponse(409, 'CONSTRAINT_VIOLATION', this.message, this.details);
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL error shape (subset from `pg` driver)
// ---------------------------------------------------------------------------

/**
 * The shape of a PostgreSQL error object as exposed by the `pg` driver.
 * Only the fields we need for constraint violation detection.
 */
export interface PgDatabaseError {
  code?: string;
  constraint?: string;
  column?: string;
  table?: string;
  detail?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Core detection logic
// ---------------------------------------------------------------------------

/**
 * Maps a PostgreSQL error code to a human-readable violation type.
 * Returns `null` if the code is not a constraint violation.
 */
export function mapPgCodeToViolationType(code: string): ConstraintViolationType | null {
  switch (code) {
    case PG_CONSTRAINT_CODES.FOREIGN_KEY:
      return 'foreign_key';
    case PG_CONSTRAINT_CODES.NOT_NULL:
      return 'not_null';
    case PG_CONSTRAINT_CODES.UNIQUE:
      return 'unique';
    case PG_CONSTRAINT_CODES.CHECK:
      return 'check';
    default:
      return null;
  }
}

/**
 * Determines whether an unknown error is a PostgreSQL constraint violation.
 */
export function isPgConstraintViolation(error: unknown): error is PgDatabaseError {
  if (!error || typeof error !== 'object') return false;
  const pgErr = error as PgDatabaseError;
  return typeof pgErr.code === 'string' && mapPgCodeToViolationType(pgErr.code) !== null;
}

/**
 * Extracts affected column(s) from a PostgreSQL error.
 *
 * - For NOT NULL violations: `column` is directly available.
 * - For UNIQUE/FK violations: parses the `detail` string for column names.
 * - Falls back to constraint name as the identifier.
 */
export function extractAffectedColumns(pgErr: PgDatabaseError): string[] {
  // Direct column field (typical for NOT NULL violations)
  if (pgErr.column) {
    return [pgErr.column];
  }

  // Parse detail string: "Key (col1, col2)=(val1, val2) already exists."
  // or "Key (col)=(val) is not present in table ..."
  if (pgErr.detail) {
    const keyMatch = pgErr.detail.match(/Key \(([^)]+)\)/);
    if (keyMatch) {
      return keyMatch[1].split(',').map((col) => col.trim());
    }
  }

  // Fallback: use constraint name if available
  if (pgErr.constraint) {
    return [pgErr.constraint];
  }

  return ['unknown'];
}

/**
 * Converts a raw PostgreSQL constraint violation error into a structured
 * `ConstraintViolationError`.
 *
 * @throws If the error is not a constraint violation, returns `null`.
 */
export function parseConstraintViolation(error: unknown): ConstraintViolationError | null {
  if (!isPgConstraintViolation(error)) {
    return null;
  }

  const pgErr = error as PgDatabaseError;
  const violationType = mapPgCodeToViolationType(pgErr.code!)!;
  const columns = extractAffectedColumns(pgErr);

  const details: ConstraintViolationDetails = {
    constraintName: pgErr.constraint ?? 'unknown',
    violationType,
    columns,
    table: pgErr.table,
    detail: pgErr.detail,
  };

  return new ConstraintViolationError(details, pgErr.message);
}

// ---------------------------------------------------------------------------
// Wrapper utility for persistence operations
// ---------------------------------------------------------------------------

/**
 * Wraps an async persistence operation, catching PostgreSQL constraint violations
 * and converting them into structured `ConstraintViolationError` instances.
 *
 * Non-constraint errors are re-thrown unchanged.
 *
 * @example
 * ```ts
 * const result = await withConstraintViolationHandling(async () => {
 *   return pool.query(INSERT_SQL, [id, name]);
 * });
 * ```
 */
export async function withConstraintViolationHandling<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const violation = parseConstraintViolation(error);
    if (violation) {
      throw violation;
    }
    throw error;
  }
}
