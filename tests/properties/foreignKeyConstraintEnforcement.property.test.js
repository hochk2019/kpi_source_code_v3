/**
 * Property Test: Foreign Key Constraint Enforcement (Property 22)
 *
 * Feature: system-redesign-2026, Property 22: Foreign Key Constraint Enforcement
 *
 * For any INSERT or UPDATE that references a non-existent foreign key value,
 * the PostgreSQL_Store SHALL reject the operation and return a structured error
 * before the row is persisted.
 *
 * Since we don't have a real PostgreSQL in tests, we test the parsing logic with
 * generated PG-like error objects. We verify that `parseConstraintViolation` returns
 * a ConstraintViolationError with violationType='foreign_key' when given a FK error.
 *
 * **Validates: Requirements 13.1**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseConstraintViolation,
  isPgConstraintViolation,
  ConstraintViolationError,
  PG_CONSTRAINT_CODES,
} from '../../server-v4/src/persistence/constraintViolationError.ts';

// ─── Arbitrary Generators ──────────────────────────────────────────────────

/**
 * Generate a valid SQL identifier-like string (lowercase, 1-30 chars, starts with letter).
 */
const arbSqlIdentifier = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_'.split('')),
      { minLength: 0, maxLength: 29 }
    ),
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a random FK constraint name (e.g., "fk_orders_customer_id").
 */
const arbConstraintName = fc
  .tuple(arbSqlIdentifier, arbSqlIdentifier)
  .map(([table, col]) => `fk_${table}_${col}`);

/**
 * Generate a random column name.
 */
const arbColumnName = arbSqlIdentifier;

/**
 * Generate a random table name.
 */
const arbTableName = arbSqlIdentifier;

/**
 * Generate a random FK value that "does not exist" (any non-empty string).
 * Avoids parentheses to not interfere with PG detail parsing regex.
 */
const arbFkValue = fc.oneof(
  fc.integer({ min: 1, max: 999999 }).map(String),
  fc.array(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
    { minLength: 1, maxLength: 30 }
  ).map((chars) => chars.join('')),
);

/**
 * Generate a PG-like foreign key violation error object.
 * Code '23503' is the FK violation code from PostgreSQL.
 * The detail string matches PG format: 'Key (col)=(val) is not present in table "X".'
 */
const arbFkViolationError = fc
  .record({
    constraint: arbConstraintName,
    column: arbColumnName,
    table: arbTableName,
    referencedTable: arbTableName,
    value: arbFkValue,
  })
  .map(({ constraint, column, table, referencedTable, value }) => ({
    code: PG_CONSTRAINT_CODES.FOREIGN_KEY, // '23503'
    constraint,
    table,
    detail: `Key (${column})=(${value}) is not present in table "${referencedTable}".`,
    message: `insert or update on table "${table}" violates foreign key constraint "${constraint}"`,
  }));

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 22: Foreign Key Constraint Enforcement', () => {
  it('parseConstraintViolation returns ConstraintViolationError with violationType=foreign_key for any FK error', () => {
    fc.assert(
      fc.property(arbFkViolationError, (pgError) => {
        const result = parseConstraintViolation(pgError);

        // Must return a non-null ConstraintViolationError
        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(ConstraintViolationError);

        // violationType must be 'foreign_key'
        expect(result.details.violationType).toBe('foreign_key');

        // constraintName must match the input
        expect(result.details.constraintName).toBe(pgError.constraint);

        // table must match the input
        expect(result.details.table).toBe(pgError.table);

        // detail must match the input
        expect(result.details.detail).toBe(pgError.detail);

        // status must be 409
        expect(result.status).toBe(409);

        // code must be CONSTRAINT_VIOLATION
        expect(result.code).toBe('CONSTRAINT_VIOLATION');
      }),
      { numRuns: 200 },
    );
  });

  it('isPgConstraintViolation correctly identifies FK violation errors', () => {
    fc.assert(
      fc.property(arbFkViolationError, (pgError) => {
        expect(isPgConstraintViolation(pgError)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('parseConstraintViolation extracts the correct column from FK error detail', () => {
    fc.assert(
      fc.property(
        fc.record({
          constraint: arbConstraintName,
          column: arbColumnName,
          table: arbTableName,
          referencedTable: arbTableName,
          value: arbFkValue,
        }),
        ({ constraint, column, table, referencedTable, value }) => {
          const pgError = {
            code: PG_CONSTRAINT_CODES.FOREIGN_KEY,
            constraint,
            table,
            detail: `Key (${column})=(${value}) is not present in table "${referencedTable}".`,
            message: `insert or update on table "${table}" violates foreign key constraint "${constraint}"`,
          };

          const result = parseConstraintViolation(pgError);

          // The columns array must contain the FK column extracted from the detail
          expect(result).not.toBeNull();
          expect(result.details.columns).toContain(column);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('parseConstraintViolation returns null for non-constraint errors', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Random error codes that are NOT constraint violations
          fc.constantFrom('42P01', '08001', '28P01', '3D000', '57P01', '42601', '40001', '53100'),
          // Random 5-digit numeric strings that are not constraint codes
          fc.array(
            fc.constantFrom(...'0123456789'.split('')),
            { minLength: 5, maxLength: 5 }
          ).map((chars) => chars.join(''))
            .filter((code) => !['23503', '23502', '23505', '23514'].includes(code)),
        ),
        (nonConstraintCode) => {
          const pgError = {
            code: nonConstraintCode,
            constraint: 'some_constraint',
            table: 'some_table',
            detail: 'Some detail',
            message: 'Some error message',
          };

          const result = parseConstraintViolation(pgError);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('parseConstraintViolation returns null for non-object/falsy inputs', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(0),
          fc.constant(''),
          fc.constant(false),
          fc.integer(),
          fc.string(),
        ),
        (invalidInput) => {
          const result = parseConstraintViolation(invalidInput);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
