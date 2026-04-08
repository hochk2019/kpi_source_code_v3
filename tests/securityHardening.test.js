import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createLoginRateLimit, createSecurityMiddleware } from '@kpi/backend-shared/runtime';

describe('securityHardening', () => {
  it('adds baseline security headers', async () => {
    const app = express();
    app.use(createSecurityMiddleware({ isProduction: false }));
    app.get('/health', (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-dns-prefetch-control']).toBe('off');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('rate limits repeated failed login attempts', async () => {
    const onLimitReached = vi.fn();
    const app = express();
    app.use(express.json());
    app.post(
      '/login',
      createLoginRateLimit({ windowMs: 60_000, max: 1, onLimitReached }),
      (_req, res) => {
        res.status(401).json({ ok: false, error: 'Sai tài khoản hoặc mật khẩu' });
      }
    );

    const first = await request(app).post('/login').send({ username: 'tester', password: 'bad' });
    const second = await request(app).post('/login').send({ username: 'tester', password: 'bad' });

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({
      ok: false,
      error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút.',
    });
    expect(onLimitReached).toHaveBeenCalledTimes(1);
  });
});
