import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';

import {
  apiVersionHeaders,
  notFoundHandler,
  errorFormatter,
  extractModuleName,
  buildErrorResponse,
} from '../../server-v4/src/middleware/apiContract.ts';
import { ConstraintViolationError } from '../../server-v4/src/persistence/constraintViolationError.ts';
import { buildV4App } from '../../server-v4/src/index.ts';

// ---------------------------------------------------------------------------
// Unit tests for pure helpers
// ---------------------------------------------------------------------------

describe('extractModuleName', () => {
  it('extracts module from /api/v4/{module}/... paths', () => {
    expect(extractModuleName('/api/v4/teams')).toBe('teams');
    expect(extractModuleName('/api/v4/teams/123')).toBe('teams');
    expect(extractModuleName('/api/v4/kpi-rules/active')).toBe('kpi-rules');
    expect(extractModuleName('/api/v4/declarations')).toBe('declarations');
  });

  it('returns "unknown" for paths that do not match the pattern', () => {
    expect(extractModuleName('/api/v3/teams')).toBe('unknown');
    expect(extractModuleName('/health')).toBe('unknown');
    expect(extractModuleName('/')).toBe('unknown');
  });
});

describe('buildErrorResponse', () => {
  it('builds a structured error response', () => {
    const result = buildErrorResponse(404, 'NOT_FOUND', 'Resource not found');
    expect(result).toEqual({
      status: 404,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  it('includes details when provided', () => {
    const details = { field: 'name', issue: 'required' };
    const result = buildErrorResponse(400, 'VALIDATION_FAILED', 'Bad input', details);
    expect(result.error.details).toEqual(details);
  });

  it('omits details field when not provided', () => {
    const result = buildErrorResponse(500, 'INTERNAL_ERROR', 'Oops');
    expect('details' in result.error).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration tests for middleware stack
// ---------------------------------------------------------------------------

describe('apiVersionHeaders middleware', () => {
  it('adds X-API-Version and X-API-Module headers to responses', async () => {
    const app = express();
    app.use(apiVersionHeaders);
    app.get('/api/v4/teams', (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/api/v4/teams');

    expect(res.headers['x-api-version']).toBe('4.1.0');
    expect(res.headers['x-api-module']).toBe('teams');
  });

  it('sets module to "unknown" for non-v4 paths', async () => {
    const app = express();
    app.use(apiVersionHeaders);
    app.get('/health', (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/health');

    expect(res.headers['x-api-version']).toBe('4.1.0');
    expect(res.headers['x-api-module']).toBe('unknown');
  });
});

describe('notFoundHandler middleware', () => {
  it('returns 404 with ENDPOINT_NOT_FOUND for unmatched routes', async () => {
    const app = express();
    app.use(apiVersionHeaders);
    app.get('/api/v4/teams', (_req, res) => res.json({ ok: true }));
    app.use(notFoundHandler);

    const res = await request(app).get('/api/v4/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      status: 404,
      error: {
        code: 'ENDPOINT_NOT_FOUND',
        message: 'No endpoint matches GET /api/v4/nonexistent',
      },
    });
  });

  it('includes the HTTP method in the error message', async () => {
    const app = express();
    app.use(notFoundHandler);

    const res = await request(app).post('/api/v4/missing');

    expect(res.body.error.message).toContain('POST');
    expect(res.body.error.message).toContain('/api/v4/missing');
  });
});

describe('errorFormatter middleware', () => {
  it('wraps thrown errors into ApiErrorResponse shape', async () => {
    const app = express();
    app.use(apiVersionHeaders);
    app.get('/api/v4/teams/fail', (_req, _res) => {
      throw new Error('Something broke');
    });
    app.use(errorFormatter);

    const res = await request(app).get('/api/v4/teams/fail');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      status: 500,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something broke',
      },
    });
  });

  it('preserves custom status and code from error objects', async () => {
    const app = express();
    app.use(apiVersionHeaders);
    app.get('/api/v4/teams/custom', (_req, _res) => {
      const err = new Error('Team not found');
      err.status = 404;
      err.code = 'TEAM_NOT_FOUND';
      throw err;
    });
    app.use(errorFormatter);

    const res = await request(app).get('/api/v4/teams/custom');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TEAM_NOT_FOUND');
    expect(res.body.error.message).toBe('Team not found');
  });
});

// ---------------------------------------------------------------------------
// Integration: ConstraintViolationError + errorFormatter middleware
// ---------------------------------------------------------------------------

describe('ConstraintViolationError integration with errorFormatter', () => {
  it('produces a 409 response with structured details via errorFormatter', async () => {
    const app = express();
    app.use(apiVersionHeaders);
    app.post('/api/v4/teams', (_req, _res, next) => {
      const err = new ConstraintViolationError({
        constraintName: 'teams_agency_id_fkey',
        violationType: 'foreign_key',
        columns: ['agency_id'],
        table: 'teams',
      });
      next(err);
    });
    app.use(errorFormatter);

    const res = await request(app).post('/api/v4/teams').send({ name: 'test' });

    expect(res.status).toBe(409);
    expect(res.body.status).toBe(409);
    expect(res.body.error.code).toBe('CONSTRAINT_VIOLATION');
    expect(res.body.error.details).toEqual({
      constraintName: 'teams_agency_id_fkey',
      violationType: 'foreign_key',
      columns: ['agency_id'],
      table: 'teams',
    });
  });
});

// ---------------------------------------------------------------------------
// Integration test with full buildV4App
// ---------------------------------------------------------------------------

describe('buildV4App API contract integration', () => {
  it('includes X-API-Version header on known endpoints', async () => {
    const app = buildV4App();

    const res = await request(app).get('/api/v4/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-api-version']).toBe('4.1.0');
    expect(res.headers['x-api-module']).toBe('health');
  });

  it('returns structured 404 for non-existent endpoints', async () => {
    const app = buildV4App();

    const res = await request(app).get('/api/v4/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe(404);
    expect(res.body.error.code).toBe('ENDPOINT_NOT_FOUND');
    expect(res.body.error.message).toContain('/api/v4/does-not-exist');
  });

  it('returns X-API-Module header matching the route module segment', async () => {
    const app = buildV4App();

    const res = await request(app).get('/api/v4/meta/modules');

    expect(res.headers['x-api-module']).toBe('meta');
  });
});
