/**
 * Property-Based Test: Field Validation Error Generation
 *
 * Feature: system-redesign-2026, Property 7: Field Validation Error Generation
 *
 * For any field value violating Zod schema → non-empty error message;
 * for valid value → no error.
 *
 * **Validates: Requirements 5.2**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { z } from 'zod';
import { validateFieldValue } from '../../src/lib/fieldValidation';

// ─── Generators ─────────────────────────────────────────────────────────────

/**
 * Generate a pair of (schema, validValue) for various Zod schemas.
 * We test several schema types to get broad coverage.
 */

/** z.string().min(minLen) with a valid string of at least that length */
const stringMinSchemaWithValid = fc
  .integer({ min: 1, max: 20 })
  .chain(minLen =>
    fc.string({ minLength: minLen, maxLength: minLen + 50 }).map(validStr => ({
      schema: z.string().min(minLen),
      validValue: validStr,
      schemaDesc: `z.string().min(${minLen})`,
    })),
  );

/** z.string().max(maxLen) with a valid string within length */
const stringMaxSchemaWithValid = fc
  .integer({ min: 1, max: 50 })
  .chain(maxLen =>
    fc.string({ minLength: 0, maxLength: maxLen }).map(validStr => ({
      schema: z.string().max(maxLen),
      validValue: validStr,
      schemaDesc: `z.string().max(${maxLen})`,
    })),
  );

/** z.number().positive() with a valid positive number */
const numberPositiveSchemaWithValid = fc
  .double({ min: 0.001, max: 1e9, noNaN: true })
  .map(n => ({
    schema: z.number().positive(),
    validValue: n,
    schemaDesc: 'z.number().positive()',
  }));

/** z.number().int() with a valid integer */
const numberIntSchemaWithValid = fc
  .integer({ min: -1e6, max: 1e6 })
  .map(n => ({
    schema: z.number().int(),
    validValue: n,
    schemaDesc: 'z.number().int()',
  }));

/** z.number().min(min).max(max) with a valid number in range */
const numberRangeSchemaWithValid = fc
  .tuple(
    fc.integer({ min: -100, max: 0 }),
    fc.integer({ min: 1, max: 100 }),
  )
  .chain(([min, max]) =>
    fc.integer({ min, max }).map(n => ({
      schema: z.number().min(min).max(max),
      validValue: n,
      schemaDesc: `z.number().min(${min}).max(${max})`,
    })),
  );

/** z.string().email() with a valid email-like string */
const emailSchemaWithValid = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 10, unit: 'grapheme' }).filter(s => /^[a-z]+$/.test(s)),
    fc.string({ minLength: 1, maxLength: 8, unit: 'grapheme' }).filter(s => /^[a-z]+$/.test(s)),
  )
  .map(([user, domain]) => ({
    schema: z.string().email(),
    validValue: `${user}@${domain}.com`,
    schemaDesc: 'z.string().email()',
  }));

/** Combined arbitrary producing schema+validValue pairs */
const schemaWithValidArb = fc.oneof(
  stringMinSchemaWithValid,
  stringMaxSchemaWithValid,
  numberPositiveSchemaWithValid,
  numberIntSchemaWithValid,
  numberRangeSchemaWithValid,
  emailSchemaWithValid,
);

/**
 * Generate (schema, invalidValue) pairs — values known to violate a schema.
 */

/** String that is too short for z.string().min(minLen) */
const stringMinSchemaWithInvalid = fc
  .integer({ min: 2, max: 20 })
  .chain(minLen =>
    fc.string({ minLength: 0, maxLength: minLen - 1 }).map(invalidStr => ({
      schema: z.string().min(minLen),
      invalidValue: invalidStr,
      schemaDesc: `z.string().min(${minLen})`,
    })),
  );

/** String that is too long for z.string().max(maxLen) */
const stringMaxSchemaWithInvalid = fc
  .integer({ min: 1, max: 20 })
  .chain(maxLen =>
    fc.string({ minLength: maxLen + 1, maxLength: maxLen + 30 }).map(invalidStr => ({
      schema: z.string().max(maxLen),
      invalidValue: invalidStr,
      schemaDesc: `z.string().max(${maxLen})`,
    })),
  );

/** Non-positive number for z.number().positive() */
const numberPositiveSchemaWithInvalid = fc
  .double({ min: -1e9, max: 0, noNaN: true })
  .map(n => ({
    schema: z.number().positive(),
    invalidValue: n,
    schemaDesc: 'z.number().positive()',
  }));

/** Non-integer for z.number().int() */
const numberIntSchemaWithInvalid = fc
  .double({ min: 0.01, max: 1e6, noNaN: true })
  .filter(n => !Number.isInteger(n))
  .map(n => ({
    schema: z.number().int(),
    invalidValue: n,
    schemaDesc: 'z.number().int()',
  }));

/** Wrong type: number where string expected */
const wrongTypeStringSchemaWithInvalid = fc
  .double({ noNaN: true })
  .map(n => ({
    schema: z.string(),
    invalidValue: n,
    schemaDesc: 'z.string() (given number)',
  }));

/** Wrong type: string where number expected */
const wrongTypeNumberSchemaWithInvalid = fc
  .string({ minLength: 1, maxLength: 20 })
  .map(s => ({
    schema: z.number(),
    invalidValue: s,
    schemaDesc: 'z.number() (given string)',
  }));

/** Combined arbitrary producing schema+invalidValue pairs */
const schemaWithInvalidArb = fc.oneof(
  stringMinSchemaWithInvalid,
  stringMaxSchemaWithInvalid,
  numberPositiveSchemaWithInvalid,
  numberIntSchemaWithInvalid,
  wrongTypeStringSchemaWithInvalid,
  wrongTypeNumberSchemaWithInvalid,
);

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Property 7: Field Validation Error Generation', () => {
  it('valid values produce valid=true and error=null', () => {
    fc.assert(
      fc.property(schemaWithValidArb, ({ schema, validValue }) => {
        const result = validateFieldValue(schema, validValue);

        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      }),
      { numRuns: 150 },
    );
  });

  it('invalid values produce valid=false and a non-empty error message', () => {
    fc.assert(
      fc.property(schemaWithInvalidArb, ({ schema, invalidValue }) => {
        const result = validateFieldValue(schema, invalidValue);

        expect(result.valid).toBe(false);
        expect(result.error).not.toBeNull();
        expect(typeof result.error).toBe('string');
        expect(result.error!.length).toBeGreaterThan(0);
      }),
      { numRuns: 150 },
    );
  });

  it('error message is always a trimmed non-empty string for invalid inputs', () => {
    fc.assert(
      fc.property(schemaWithInvalidArb, ({ schema, invalidValue }) => {
        const result = validateFieldValue(schema, invalidValue);

        // error must be non-empty after trimming
        expect(result.error!.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('validation is deterministic — same input always produces same result', () => {
    fc.assert(
      fc.property(schemaWithValidArb, ({ schema, validValue }) => {
        const r1 = validateFieldValue(schema, validValue);
        const r2 = validateFieldValue(schema, validValue);

        expect(r1).toEqual(r2);
      }),
      { numRuns: 100 },
    );
  });

  it('validation is deterministic for invalid inputs', () => {
    fc.assert(
      fc.property(schemaWithInvalidArb, ({ schema, invalidValue }) => {
        const r1 = validateFieldValue(schema, invalidValue);
        const r2 = validateFieldValue(schema, invalidValue);

        expect(r1).toEqual(r2);
      }),
      { numRuns: 100 },
    );
  });
});
