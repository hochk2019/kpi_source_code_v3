import { describe, expect, it } from 'vitest';

import {
  ConstraintViolationError,
  PG_CONSTRAINT_CODES,
  extractAffectedColumns,
  isPgConstraintViolation,
  mapPgCodeToViolationType,
  parseConstraintViolation,
  withConstraintViolationHandling,
} from '../../server-v4/src/persistence/constraintViolationError.ts';

// ---------------------------------------------------------------------------
// mapPgCodeToViolationType
// ---------------------------------------------------------------------------

describe('mapPgCodeToViolationType', () => {
  it('maps 23503 to foreign_key', () => {
    expect(mapPgCodeToViolationType('23503')).toBe('foreign_key');
  });

  it('maps 23502 to not_null', () => {
    expect(mapPgCodeToViolationType('23502')).toBe('not_null');
  });

  it('maps 23505 to unique', () => {
    expect(mapPgCodeToViolationType('23505')).toBe('unique');
  });

  it('maps 23514 to check', () => {
    expect(mapPgCodeToViolationType('23514')).toBe('check');
  });

  it('returns null for non-constraint codes', () => {
    expect(mapPgCodeToViolationType('42P01')).toBeNull();
    expect(mapPgCodeToViolationType('08001')).toBeNull();
    expect(mapPgCodeToViolationType('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isPgConstraintViolation
// ---------------------------------------------------------------------------

describe('isPgConstraintViolation', () => {
  it('returns true for errors with constraint violation codes', () => {
    expect(isPgConstraintViolation({ code: '23505' })).toBe(true);
    expect(isPgConstraintViolation({ code: '23503' })).toBe(true);
    expect(isPgConstraintViolation({ code: '23502' })).toBe(true);
    expect(isPgConstraintViolation({ code: '23514' })).toBe(true);
  });

  it('returns false for null/undefined/non-object', () => {
    expect(isPgConstraintViolation(null)).toBe(false);
    expect(isPgConstraintViolation(undefined)).toBe(false);
    expect(isPgConstraintViolation('string')).toBe(false);
    expect(isPgConstraintViolation(42)).toBe(false);
  });

  it('returns false for errors with non-constraint codes', () => {
    expect(isPgConstraintViolation({ code: '42P01' })).toBe(false);
    expect(isPgConstraintViolation({ code: '08001' })).toBe(false);
  });

  it('returns false for objects without code property', () => {
    expect(isPgConstraintViolation({})).toBe(false);
    expect(isPgConstraintViolation({ message: 'some error' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractAffectedColumns
// ---------------------------------------------------------------------------

describe('extractAffectedColumns', () => {
  it('returns column from direct column field (NOT NULL)', () => {
    expect(extractAffectedColumns({ column: 'name' })).toEqual(['name']);
  });

  it('parses single column from detail string (UNIQUE)', () => {
    const pgErr = {
      detail: 'Key (email)=(user@example.com) already exists.',
      constraint: 'users_email_key',
    };
    expect(extractAffectedColumns(pgErr)).toEqual(['email']);
  });

  it('parses multiple columns from detail string (compound UNIQUE)', () => {
    const pgErr = {
      detail: 'Key (team_id, user_id)=(abc, def) already exists.',
      constraint: 'team_members_team_id_user_id_key',
    };
    expect(extractAffectedColumns(pgErr)).toEqual(['team_id', 'user_id']);
  });

  it('parses FK violation detail string', () => {
    const pgErr = {
      detail: 'Key (agency_id)=(non-existent-id) is not present in table "hq_agencies".',
      constraint: 'teams_agency_id_fkey',
    };
    expect(extractAffectedColumns(pgErr)).toEqual(['agency_id']);
  });

  it('falls back to constraint name when no column or detail', () => {
    const pgErr = { constraint: 'some_check_constraint' };
    expect(extractAffectedColumns(pgErr)).toEqual(['some_check_constraint']);
  });

  it('returns ["unknown"] when no info available', () => {
    expect(extractAffectedColumns({})).toEqual(['unknown']);
  });
});

// ---------------------------------------------------------------------------
// parseConstraintViolation
// ---------------------------------------------------------------------------

describe('parseConstraintViolation', () => {
  it('parses a UNIQUE violation error', () => {
    const pgErr = {
      code: '23505',
      constraint: 'users_email_key',
      table: 'users',
      detail: 'Key (email)=(dupe@test.com) already exists.',
      message: 'duplicate key value violates unique constraint "users_email_key"',
    };

    const result = parseConstraintViolation(pgErr);

    expect(result).toBeInstanceOf(ConstraintViolationError);
    expect(result?.status).toBe(409);
    expect(result?.code).toBe('CONSTRAINT_VIOLATION');
    expect(result?.details).toEqual({
      constraintName: 'users_email_key',
      violationType: 'unique',
      columns: ['email'],
      table: 'users',
      detail: 'Key (email)=(dupe@test.com) already exists.',
    });
  });

  it('parses a FOREIGN KEY violation error', () => {
    const pgErr = {
      code: '23503',
      constraint: 'teams_agency_id_fkey',
      table: 'teams',
      detail: 'Key (agency_id)=(missing-id) is not present in table "hq_agencies".',
      message: 'insert or update on table "teams" violates foreign key constraint "teams_agency_id_fkey"',
    };

    const result = parseConstraintViolation(pgErr);

    expect(result).not.toBeNull();
    expect(result?.details.violationType).toBe('foreign_key');
    expect(result?.details.columns).toEqual(['agency_id']);
    expect(result?.details.table).toBe('teams');
  });

  it('parses a NOT NULL violation error', () => {
    const pgErr = {
      code: '23502',
      column: 'name',
      table: 'teams',
      message: 'null value in column "name" violates not-null constraint',
    };

    const result = parseConstraintViolation(pgErr);

    expect(result).not.toBeNull();
    expect(result?.details.violationType).toBe('not_null');
    expect(result?.details.columns).toEqual(['name']);
    expect(result?.details.constraintName).toBe('unknown');
  });

  it('parses a CHECK constraint violation error', () => {
    const pgErr = {
      code: '23514',
      constraint: 'team_members_role_check',
      table: 'team_members',
      message: 'new row for relation "team_members" violates check constraint "team_members_role_check"',
    };

    const result = parseConstraintViolation(pgErr);

    expect(result).not.toBeNull();
    expect(result?.details.violationType).toBe('check');
    expect(result?.details.constraintName).toBe('team_members_role_check');
  });

  it('returns null for non-constraint errors', () => {
    expect(parseConstraintViolation(new Error('connection refused'))).toBeNull();
    expect(parseConstraintViolation({ code: '42P01', message: 'table not found' })).toBeNull();
    expect(parseConstraintViolation(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ConstraintViolationError
// ---------------------------------------------------------------------------

describe('ConstraintViolationError', () => {
  it('creates error with structured details', () => {
    const err = new ConstraintViolationError({
      constraintName: 'users_email_key',
      violationType: 'unique',
      columns: ['email'],
      table: 'users',
    });

    expect(err.status).toBe(409);
    expect(err.code).toBe('CONSTRAINT_VIOLATION');
    expect(err.name).toBe('ConstraintViolationError');
    expect(err.message).toContain('unique');
    expect(err.message).toContain('users_email_key');
  });

  it('converts to ApiErrorResponse shape', () => {
    const err = new ConstraintViolationError({
      constraintName: 'teams_agency_id_fkey',
      violationType: 'foreign_key',
      columns: ['agency_id'],
      table: 'teams',
    });

    const response = err.toApiErrorResponse();

    expect(response.status).toBe(409);
    expect(response.error.code).toBe('CONSTRAINT_VIOLATION');
    expect(response.error.details).toEqual({
      constraintName: 'teams_agency_id_fkey',
      violationType: 'foreign_key',
      columns: ['agency_id'],
      table: 'teams',
    });
  });
});

// ---------------------------------------------------------------------------
// withConstraintViolationHandling
// ---------------------------------------------------------------------------

describe('withConstraintViolationHandling', () => {
  it('returns result on success', async () => {
    const result = await withConstraintViolationHandling(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('converts constraint violations to ConstraintViolationError', async () => {
    const pgErr = {
      code: '23505',
      constraint: 'users_email_key',
      table: 'users',
      detail: 'Key (email)=(x@y.com) already exists.',
      message: 'duplicate key value violates unique constraint "users_email_key"',
    };

    await expect(
      withConstraintViolationHandling(async () => {
        throw pgErr;
      }),
    ).rejects.toBeInstanceOf(ConstraintViolationError);
  });

  it('re-throws non-constraint errors unchanged', async () => {
    const origErr = new Error('connection timeout');

    await expect(
      withConstraintViolationHandling(async () => {
        throw origErr;
      }),
    ).rejects.toBe(origErr);
  });

  it('preserves constraint violation details on caught error', async () => {
    const pgErr = {
      code: '23503',
      constraint: 'orders_user_id_fkey',
      table: 'orders',
      detail: 'Key (user_id)=(missing) is not present in table "users".',
      message: 'FK violation',
    };

    try {
      await withConstraintViolationHandling(async () => {
        throw pgErr;
      });
    } catch (err) {
      expect(err).toBeInstanceOf(ConstraintViolationError);
      const violation = /** @type {any} */ (err);
      expect(violation.details.violationType).toBe('foreign_key');
      expect(violation.details.columns).toEqual(['user_id']);
      expect(violation.details.table).toBe('orders');
    }
  });
});
