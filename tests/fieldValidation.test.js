import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateFieldValue,
  validateFields,
  isErrorMapClean,
  DEFAULT_INVALID_MESSAGE,
} from '@/lib/fieldValidation';

/**
 * Unit tests for the pure field-validation core.
 *
 * Validates: Requirements 5.2 (inline field-level validation).
 */

describe('validateFieldValue', () => {
  it('returns valid=true and no error for a value satisfying the schema', () => {
    const schema = z.string().min(3);
    const result = validateFieldValue(schema, 'hello');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns valid=false and a non-empty error for a violating value', () => {
    const schema = z.string().min(3, 'Tối thiểu 3 ký tự.');
    const result = validateFieldValue(schema, 'hi');
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);
    expect(result.error).toBe('Tối thiểu 3 ký tự.');
  });

  it('reports the first issue message when multiple constraints fail', () => {
    const schema = z.string().email('Email không hợp lệ.');
    const result = validateFieldValue(schema, 'not-an-email');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email không hợp lệ.');
  });

  it('falls back to a default message when the issue message is empty', () => {
    const schema = z.string().refine(() => false, { message: '' });
    const result = validateFieldValue(schema, 'anything');
    expect(result.valid).toBe(false);
    expect(result.error).toBe(DEFAULT_INVALID_MESSAGE);
  });

  it('validates non-string schemas (number ranges)', () => {
    const schema = z.number().min(0).max(100);
    expect(validateFieldValue(schema, 50).valid).toBe(true);
    expect(validateFieldValue(schema, 150).valid).toBe(false);
    expect(validateFieldValue(schema, 150).error).not.toBeNull();
  });
});

describe('validateFields', () => {
  const schemas = {
    name: z.string().min(1, 'Bắt buộc.'),
    age: z.number().int().min(18, 'Phải từ 18 tuổi.'),
  };

  it('returns null errors for all-valid input', () => {
    const errors = validateFields(schemas, { name: 'An', age: 30 });
    expect(errors).toEqual({ name: null, age: null });
  });

  it('reports per-field errors for invalid input', () => {
    const errors = validateFields(schemas, { name: '', age: 10 });
    expect(errors.name).toBe('Bắt buộc.');
    expect(errors.age).toBe('Phải từ 18 tuổi.');
  });

  it('skips fields without a schema', () => {
    const errors = validateFields({ name: schemas.name }, { name: 'Ok', extra: 'ignored' });
    expect(errors).toEqual({ name: null });
    expect('extra' in errors).toBe(false);
  });
});

describe('isErrorMapClean', () => {
  it('is true for an empty map', () => {
    expect(isErrorMapClean({})).toBe(true);
  });

  it('is true when all entries are null', () => {
    expect(isErrorMapClean({ a: null, b: null })).toBe(true);
  });

  it('is false when any entry has a message', () => {
    expect(isErrorMapClean({ a: null, b: 'bad' })).toBe(false);
  });
});
