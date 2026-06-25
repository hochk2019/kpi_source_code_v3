/* @vitest-environment node */
/**
 * Property-Based Test: API Response Contract Invariants
 *
 * Feature: system-redesign-2026, Property 8: API Response Contract Invariants
 *
 * For any HTTP response from any Server_V4 endpoint:
 * (a) error responses SHALL match the ApiErrorResponse schema shape,
 * (b) responses to requests with invalid bodies SHALL have status 400 with code VALIDATION_FAILED,
 * (c) all responses SHALL include X-API-Version and X-API-Module headers.
 *
 * **Validates: Requirements 6.2, 6.3, 6.5**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';

import {
  apiVersionHeaders,
  notFoundHandler,
  errorFormatter,
} from '../../server-v4/src/middleware/apiContract.ts';
import { validateBody } from '../../server-v4/src/middleware/validateBody.ts';
import { buildV4App } from '../../server-v4/src/index.ts';

// ─── ApiErrorResponse Shape Validator ────────────────────────────────────────

/** Zod schema that mirrors the ApiErrorResponse interface from the design doc */
const ApiErrorResponseSchema = z.object({
  status: z.number().int(),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

// ─── Test App Factory ────────────────────────────────────────────────────────

/**
 * Creates a minimal Express app mimicking the V4 contract middleware stack
 * with a route that has body validation via a Zod schema.
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(apiVersionHeaders);

  // A route with Zod body validation
  const testBodySchema = z.object({
    name: z.string().min(1),
    value: z.number(),
  });

  app.post('/api/v4/test-module/items', validateBody(testBodySchema), (_req, res) => {
    res.status(201).json({ ok: true, data: _req.body });
  });

  // A simple GET route (no body validation)
  app.get('/api/v4/test-module/items', (_req, res) => {
    res.status(200).json({ ok: true, items: [] });
  });

  // Error handler + 404 catch-all
  app.use(notFoundHandler);
  app.use(errorFormatter);

  return app;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates random invalid request bodies that should fail Zod validation.
 * These are all valid JSON values but violate the test schema
 * (name: string min(1), value: number).
 *
 * We avoid non-JSON-parseable content because express.json() handles parse
 * errors separately (returns 400 with a different shape).
 */
const invalidBodyArb = fc.oneof(
  // Missing required fields — empty object
  fc.constant({}),
  // name is empty string (violates min(1))
  fc.record({
    name: fc.constant(''),
    value: fc.integer(),
  }),
  // name is wrong type (number, boolean, null, array)
  fc.record({
    name: fc.oneof(
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.array(fc.integer(), { maxLength: 3 }),
    ),
    value: fc.integer(),
  }),
  // value is wrong type (string, boolean, null, array)
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    value: fc.oneof(
      fc.string(),
      fc.boolean(),
      fc.constant(null),
      fc.array(fc.integer(), { maxLength: 3 }),
    ),
  }),
  // Completely random objects without both required fields
  fc.dictionary(
    fc.stringMatching(/^[a-z]{1,10}$/).filter(k => k !== 'name' && k !== 'value'),
    fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
    { minKeys: 0, maxKeys: 5 },
  ),
  // Array body (not an object — Zod object schema rejects)
  fc.array(fc.oneof(fc.string(), fc.integer()), { maxLength: 5 }),
);

/**
 * Generates random path segments for testing non-existent endpoints.
 */
const randomPathSegmentArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/);

const nonExistentPathArb = fc
  .array(randomPathSegmentArb, { minLength: 1, maxLength: 4 })
  .map(segments => '/api/v4/' + segments.join('/'));

/**
 * Generates random HTTP methods for 404 testing.
 */
const httpMethodArb = fc.constantFrom('get', 'post', 'put', 'patch', 'delete');

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 8: API Response Contract Invariants', () => {
  const app = createTestApp();

  it(
    'invalid request bodies always produce 400 with VALIDATION_FAILED code and match ApiErrorResponse shape',
    async () => {
      await fc.assert(
        fc.asyncProperty(invalidBodyArb, async (body) => {
          const res = await request(app)
            .post('/api/v4/test-module/items')
            .send(body);

          // (b) invalid bodies get 400 with VALIDATION_FAILED
          expect(res.status).toBe(400);
          expect(res.body.error.code).toBe('VALIDATION_FAILED');

          // (a) error response matches ApiErrorResponse shape
          const parseResult = ApiErrorResponseSchema.safeParse(res.body);
          expect(parseResult.success).toBe(true);

          // (c) response includes X-API-Version header
          expect(res.headers['x-api-version']).toBeDefined();
          expect(res.headers['x-api-version']).toBe('4.1.0');

          // X-API-Module header is present
          expect(res.headers['x-api-module']).toBeDefined();
          expect(res.headers['x-api-module']).toBe('test-module');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'non-existent endpoints always return 404 with ApiErrorResponse shape and version headers',
    async () => {
      await fc.assert(
        fc.asyncProperty(nonExistentPathArb, httpMethodArb, async (path, method) => {
          const res = await (request(app) as any)[method](path);

          // (a) error response matches ApiErrorResponse shape
          expect(res.status).toBe(404);
          const parseResult = ApiErrorResponseSchema.safeParse(res.body);
          expect(parseResult.success).toBe(true);
          expect(res.body.error.code).toBe('ENDPOINT_NOT_FOUND');

          // (c) response includes X-API-Version and X-API-Module headers
          expect(res.headers['x-api-version']).toBe('4.1.0');
          expect(res.headers['x-api-module']).toBeDefined();
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'successful responses also include version headers (contract applies to ALL responses)',
    async () => {
      // Valid body for the test schema
      const validBodyArb = fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        value: fc.integer({ min: -1000, max: 1000 }),
      });

      await fc.assert(
        fc.asyncProperty(validBodyArb, async (body) => {
          const res = await request(app)
            .post('/api/v4/test-module/items')
            .send(body);

          // Should succeed
          expect(res.status).toBe(201);

          // (c) ALL responses include version headers
          expect(res.headers['x-api-version']).toBe('4.1.0');
          expect(res.headers['x-api-module']).toBe('test-module');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'error responses from the full buildV4App also match ApiErrorResponse shape with version headers',
    async () => {
      const fullApp = buildV4App();

      await fc.assert(
        fc.asyncProperty(nonExistentPathArb, async (path) => {
          const res = await request(fullApp).get(path);

          // 404 for non-existent routes
          expect(res.status).toBe(404);

          // (a) matches ApiErrorResponse shape
          const parseResult = ApiErrorResponseSchema.safeParse(res.body);
          expect(parseResult.success).toBe(true);

          // (c) version headers present
          expect(res.headers['x-api-version']).toBe('4.1.0');
          expect(res.headers['x-api-module']).toBeDefined();
        }),
        { numRuns: 100 },
      );
    },
  );
});
