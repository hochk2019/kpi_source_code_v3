/**
 * Property Test: Constraint Violation Structured Error (Property 23)
 *
 * Feature: system-redesign-2026, Property 23: Constraint Violation Structured Error
 *
 * For any write operation that violates a database constraint (FK, NOT NULL, UNIQUE, CHECK),
 * the Persistence_Layer SHALL return an error object containing the constraint name,
 * violation type, and affected column(s).
 *
 * **Validates: Requirements 13.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseConstraintViolation,
  ConstraintViolationError,
  PG_CONSTRAINT_CODES,
  type PgDatabaseError,
  type ConstraintViolationType,
} from '../../server-v4/src/persistence/constraintViolationError.js';

// ─── Arbitrary Generators ──────────────────────────────────────────────────

/** All 4 constraint violation codes and their corresponding violation types. */
const CONSTRAINT_CODE_ENTRIES: Array<{ code: string; type: ConstraintViolationType }> = [
  { code: PG_CONSTRAINT_CODES.FOREIGN_KEY, type: 'foreign_key' },
  { code: PG_CONSTRAINT_CODES.NOT_NULL, type: 'not_null' },
  { code: PG_CONSTRAINT_CODES.UNIQUE, type: 'unique' },
  { code: PG_CONSTRAINT_CODES.CHECK, type: 'check' },
];

/** Generate a random constraint violation code paired with its expected type. */
const arbConstraintEntry = fc.constantFrom(...CONSTRAINT_CODE_ENTRIES);

/** Generate a random non-empty identifier (constraint or column name). */
const arbIdentifier = fc
  .string({ minLength: 1, maxLength: 30, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_0123456789'.split('')) })
  .filter((s) => /^[a-z_]/.test(s));

/** Generate a random table name. */
const arbTableName = arbIdentifier.map((id) => `tbl_${id}`);

/** Generate 1-3 random column names. */
const arbColumns = fc.array(arbIdentifier, { minLength: 1, maxLength: 3 });

/**
 * Generate a PostgreSQL detail string with column names embedded.
 * Mimics the format: "Key (col1, col2)=(val1, val2) already exists." (UNIQUE/FK)
 */
const arbDetailWithColumns = (columns: string[]) => {
  const colList = columns.join(', ');
  const valList = columns.map((_, i) => `val${i}`).join(', ');
  return fc.constantFrom(
    `Key (${colList})=(${valList}) already exists.`,
    `Key (${colList})=(${valList}) is not present in table "other_table".`,
  );
};

/**
 * Generate a full PgDatabaseError object for UNIQUE and FK violations.
 * These use `detail` to communicate affected columns.
 */
const arbFkOrUniqueError = arbConstraintEntry
  .filter((e) => e.type === 'foreign_key' || e.type === 'unique')
  .chain((entry) =>
    fc.tuple(arbIdentifier, arbColumns, arbTableName).chain(([constraint, columns, table]) =>
      arbDetailWithColumns(columns).map((detail) => ({
        pgError: {
          code: entry.code,
          constraint,
          table,
          detail,
          message: `violates ${entry.type} constraint "${constraint}"`,
        } as PgDatabaseError,
        expectedType: entry.type,
        expectedConstraint: constraint,
        expectedColumns: columns,
      })),
    ),
  );

/**
 * Generate a PgDatabaseError for NOT NULL violations.
 * NOT NULL errors have the `column` field directly set.
 */
const arbNotNullError = arbIdentifier.chain((column) =>
  fc.tuple(arbIdentifier, arbTableName).map(([constraint, table]) => ({
    pgError: {
      code: PG_CONSTRAINT_CODES.NOT_NULL,
      constraint,
      column,
      table,
      message: `null value in column "${column}" violates not-null constraint`,
    } as PgDatabaseError,
    expectedType: 'not_null' as ConstraintViolationType,
    expectedConstraint: constraint,
    expectedColumns: [column],
  })),
);

/**
 * Generate a PgDatabaseError for CHECK violations.
 * CHECK errors typically have the constraint name but may use detail for columns.
 */
const arbCheckError = fc
  .tuple(arbIdentifier, arbColumns, arbTableName)
  .chain(([constraint, columns, table]) =>
    arbDetailWithColumns(columns).map((detail) => ({
      pgError: {
        code: PG_CONSTRAINT_CODES.CHECK,
        constraint,
        table,
        detail,
        message: `new row violates check constraint "${constraint}"`,
      } as PgDatabaseError,
      expectedType: 'check' as ConstraintViolationType,
      expectedConstraint: constraint,
      expectedColumns: columns,
    })),
  );

/**
 * Union generator: any of the 4 constraint violation types.
 */
const arbAnyConstraintError = fc.oneof(arbFkOrUniqueError, arbNotNullError, arbCheckError);

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 23: Constraint Violation Structured Error', () => {
  it('parseConstraintViolation always returns a ConstraintViolationError for any constraint violation code', () => {
    fc.assert(
      fc.property(arbAnyConstraintError, ({ pgError }) => {
        const result = parseConstraintViolation(pgError);

        // Must return a ConstraintViolationError, never null
        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(ConstraintViolationError);
      }),
      { numRuns: 200 },
    );
  });

  it('returned error always has correct violationType matching the PG error code', () => {
    fc.assert(
      fc.property(arbAnyConstraintError, ({ pgError, expectedType }) => {
        const result = parseConstraintViolation(pgError)!;

        expect(result.details.violationType).toBe(expectedType);
      }),
      { numRuns: 200 },
    );
  });

  it('returned error always has a non-empty constraintName', () => {
    fc.assert(
      fc.property(arbAnyConstraintError, ({ pgError }) => {
        const result = parseConstraintViolation(pgError)!;

        expect(result.details.constraintName).toBeTruthy();
        expect(result.details.constraintName.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });

  it('returned error always has a non-empty columns array', () => {
    fc.assert(
      fc.property(arbAnyConstraintError, ({ pgError }) => {
        const result = parseConstraintViolation(pgError)!;

        expect(Array.isArray(result.details.columns)).toBe(true);
        expect(result.details.columns.length).toBeGreaterThan(0);
        // Every column entry should be non-empty
        for (const col of result.details.columns) {
          expect(col.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('constraintName matches the constraint field from the PG error when provided', () => {
    fc.assert(
      fc.property(arbAnyConstraintError, ({ pgError, expectedConstraint }) => {
        const result = parseConstraintViolation(pgError)!;

        expect(result.details.constraintName).toBe(expectedConstraint);
      }),
      { numRuns: 200 },
    );
  });

  it('columns match the expected columns extracted from column field or detail string', () => {
    fc.assert(
      fc.property(arbAnyConstraintError, ({ pgError, expectedColumns }) => {
        const result = parseConstraintViolation(pgError)!;

        expect(result.details.columns).toEqual(expectedColumns);
      }),
      { numRuns: 200 },
    );
  });

  it('error has status 409 and code CONSTRAINT_VIOLATION', () => {
    fc.assert(
      fc.property(arbAnyConstraintError, ({ pgError }) => {
        const result = parseConstraintViolation(pgError)!;

        expect(result.status).toBe(409);
        expect(result.code).toBe('CONSTRAINT_VIOLATION');
      }),
      { numRuns: 100 },
    );
  });

  it('returns null for non-constraint-violation PG error codes', () => {
    const arbNonConstraintCode = fc
      .string({ minLength: 5, maxLength: 5, unit: fc.constantFrom(...'0123456789'.split('')) })
      .filter(
        (code) =>
          code !== PG_CONSTRAINT_CODES.FOREIGN_KEY &&
          code !== PG_CONSTRAINT_CODES.NOT_NULL &&
          code !== PG_CONSTRAINT_CODES.UNIQUE &&
          code !== PG_CONSTRAINT_CODES.CHECK,
      );

    fc.assert(
      fc.property(arbNonConstraintCode, (code) => {
        const pgError: PgDatabaseError = {
          code,
          constraint: 'some_constraint',
          detail: 'Key (col)=(val) already exists.',
        };
        const result = parseConstraintViolation(pgError);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
