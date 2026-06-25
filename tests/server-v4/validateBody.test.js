/* eslint-env node */
/* @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { validateBody, validateQuery } from '../../server-v4/src/middleware/validateBody.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createApp(schema, variant = 'body') {
  const app = express();
  app.use(express.json());

  if (variant === 'body') {
    app.post('/test', validateBody(schema), (req, res) => {
      res.status(200).json({ ok: true, data: req.body });
    });
  } else {
    app.get('/test', validateQuery(schema), (req, res) => {
      res.status(200).json({ ok: true, data: req.query });
    });
  }

  return app;
}

// ---------------------------------------------------------------------------
// validateBody
// ---------------------------------------------------------------------------

describe('validateBody middleware', () => {
  const userSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().int().positive().optional(),
  });

  it('passes valid body through and replaces req.body with parsed data', async () => {
    const app = createApp(userSchema);

    const res = await request(app)
      .post('/test')
      .send({ name: 'Alice', email: 'alice@example.com', age: 30 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: { name: 'Alice', email: 'alice@example.com', age: 30 },
    });
  });

  it('strips unknown fields when schema does not use passthrough', async () => {
    const app = createApp(userSchema);

    const res = await request(app)
      .post('/test')
      .send({ name: 'Bob', email: 'bob@test.com', extraField: 'should be removed' });

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('extraField');
    expect(res.body.data).toEqual({ name: 'Bob', email: 'bob@test.com' });
  });

  it('returns 400 with VALIDATION_FAILED code on invalid body', async () => {
    const app = createApp(userSchema);

    const res = await request(app)
      .post('/test')
      .send({ name: '', email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.message).toBe('Request body validation failed');
    expect(res.body.error.details).toBeDefined();
  });

  it('returns flattened Zod errors in details', async () => {
    const app = createApp(userSchema);

    const res = await request(app)
      .post('/test')
      .send({ name: '', email: 'invalid' });

    const { details } = res.body.error;
    expect(details).toHaveProperty('fieldErrors');
    expect(details.fieldErrors).toHaveProperty('name');
    expect(details.fieldErrors).toHaveProperty('email');
  });

  it('returns 400 when required fields are missing', async () => {
    const app = createApp(userSchema);

    const res = await request(app)
      .post('/test')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.fieldErrors).toHaveProperty('name');
    expect(res.body.error.details.fieldErrors).toHaveProperty('email');
  });

  it('applies coercion transforms from Zod schema', async () => {
    const coerceSchema = z.object({
      count: z.coerce.number().int().positive(),
      label: z.string().trim(),
    });
    const app = createApp(coerceSchema);

    const res = await request(app)
      .post('/test')
      .send({ count: '42', label: '  hello  ' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ count: 42, label: 'hello' });
  });

  it('calls next() only on success', async () => {
    const app = createApp(userSchema);

    const validRes = await request(app)
      .post('/test')
      .send({ name: 'Valid', email: 'valid@test.com' });

    expect(validRes.status).toBe(200);
    expect(validRes.body.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateQuery
// ---------------------------------------------------------------------------

describe('validateQuery middleware', () => {
  const querySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  });

  it('passes valid query params and replaces req.query with parsed data', async () => {
    const app = createApp(querySchema, 'query');

    const res = await request(app).get('/test?page=2&limit=25');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ page: 2, limit: 25 });
  });

  it('returns 400 with VALIDATION_FAILED code on invalid query params', async () => {
    const app = createApp(querySchema, 'query');

    const res = await request(app).get('/test?page=-1&limit=999');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.message).toBe('Query parameter validation failed');
    expect(res.body.error.details).toBeDefined();
  });

  it('allows empty query params when all fields are optional', async () => {
    const app = createApp(querySchema, 'query');

    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({});
  });
});
