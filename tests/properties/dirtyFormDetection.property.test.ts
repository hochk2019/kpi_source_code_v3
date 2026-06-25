import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isFormDirty, valuesEqual } from '@/hooks/useUnsavedChangesGuard';

/**
 * Property 6: Dirty Form Detection
 *
 * For any form with initial state: changed field → dirty=true;
 * all fields equal initial → dirty=false.
 *
 * Feature: system-redesign-2026, Property 6: Dirty Form Detection
 * Validates: Requirements 5.1
 */

// ─── Arbitrary Generators ──────────────────────────────────────────────────

/**
 * Generate JSON-safe values suitable for form fields (primitives, arrays,
 * nested objects). Constrained to types handled by valuesEqual.
 */
const arbFieldValue: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small' },
    fc.string(),
    fc.integer(),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie('value'), { maxLength: 4 }),
    fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), tie('value'), { maxKeys: 4 }),
  ),
})).value;

/**
 * Generate arbitrary form objects — flat records with string keys
 * and JSON-safe field values.
 */
const arbFormState = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 15 }),
  arbFieldValue,
  { minKeys: 1, maxKeys: 8 },
);

/**
 * Generate a field value guaranteed to differ from the given value.
 * Used to produce a "changed" field.
 */
function arbDifferentValue(original: unknown): fc.Arbitrary<unknown> {
  // Simple approach: generate a value and filter out equals.
  // For efficiency, use a mapped approach that guarantees difference.
  if (typeof original === 'string') {
    return fc.string().filter((v) => v !== original);
  }
  if (typeof original === 'number') {
    return fc.integer().map((n) => (n === original ? n + 1 : n));
  }
  if (typeof original === 'boolean') {
    return fc.constant(!original);
  }
  if (original === null) {
    return fc.oneof(fc.string(), fc.integer(), fc.constant(true));
  }
  // For arrays/objects, just produce a different type to guarantee inequality
  return fc.string().map((s) => `__changed__${s}`);
}

// ─── Property Tests ────────────────────────────────────────────────────────

describe('Property 6: Dirty Form Detection', () => {
  it('identical initial and current values → dirty=false', () => {
    fc.assert(
      fc.property(arbFormState, (formState) => {
        // When current equals initial, form should NOT be dirty
        const dirty = isFormDirty(formState, formState);
        expect(dirty).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('structurally equal (deep clone) initial and current → dirty=false', () => {
    fc.assert(
      fc.property(arbFormState, (formState) => {
        // Deep clone to ensure structural equality check (not referential)
        const clone = JSON.parse(JSON.stringify(formState));
        const dirty = isFormDirty(formState, clone);
        expect(dirty).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('any field changed to a different value → dirty=true', () => {
    fc.assert(
      fc.property(arbFormState, fc.nat(), (formState, seed) => {
        const keys = Object.keys(formState);
        fc.pre(keys.length > 0);

        // Pick a field to mutate
        const keyIndex = seed % keys.length;
        const targetKey = keys[keyIndex];
        const originalValue = formState[targetKey];

        // Create a modified copy with one field changed.
        // Use a deep clone to avoid mutating the original object.
        const modified = JSON.parse(JSON.stringify(formState));

        // Produce a value guaranteed to differ from originalValue.
        // We use type-switching that always guarantees inequality.
        if (typeof originalValue === 'boolean') {
          modified[targetKey] = !originalValue;
        } else if (originalValue === null) {
          modified[targetKey] = '__not_null__';
        } else if (typeof originalValue === 'string') {
          modified[targetKey] = originalValue + '__dirty';
        } else if (typeof originalValue === 'number') {
          // Avoid floating-point precision issues with large integers.
          // Switch to a string type to guarantee difference.
          modified[targetKey] = String(originalValue) + '_changed';
        } else if (Array.isArray(originalValue)) {
          modified[targetKey] = [...originalValue, '__appended'];
        } else {
          // Object or other — replace with a distinct string
          modified[targetKey] = '__changed__';
        }

        // Verify the mutation actually produced a different value
        fc.pre(!valuesEqual(formState[targetKey], modified[targetKey]));

        const dirty = isFormDirty(formState, modified);
        expect(dirty).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('valuesEqual is reflexive: any value equals itself', () => {
    fc.assert(
      fc.property(arbFieldValue, (value) => {
        expect(valuesEqual(value, value)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('valuesEqual is symmetric: equal(a, b) === equal(b, a)', () => {
    fc.assert(
      fc.property(arbFieldValue, arbFieldValue, (a, b) => {
        expect(valuesEqual(a, b)).toBe(valuesEqual(b, a));
      }),
      { numRuns: 100 },
    );
  });

  it('adding an extra field to current makes form dirty', () => {
    fc.assert(
      fc.property(
        arbFormState,
        fc.string({ minLength: 1, maxLength: 10 }),
        arbFieldValue,
        (formState, extraKey, extraValue) => {
          // Ensure the extra key doesn't already exist
          fc.pre(!Object.prototype.hasOwnProperty.call(formState, extraKey));

          const modified = { ...formState, [extraKey]: extraValue };
          const dirty = isFormDirty(formState, modified);
          expect(dirty).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('removing a field from current makes form dirty', () => {
    fc.assert(
      fc.property(arbFormState, fc.nat(), (formState, seed) => {
        const keys = Object.keys(formState);
        fc.pre(keys.length > 1); // Need at least 2 keys so we can remove one

        const keyIndex = seed % keys.length;
        const targetKey = keys[keyIndex];

        // Create a copy without one field
        const modified = { ...formState };
        delete modified[targetKey];

        const dirty = isFormDirty(formState, modified);
        expect(dirty).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
