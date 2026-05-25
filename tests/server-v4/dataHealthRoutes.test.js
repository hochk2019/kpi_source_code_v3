/* eslint-env node */
/* @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { dataHealthModule } from '../../server-v4/src/modules/data-health/data-health.module.ts';
import { buildDataHealthRouter } from '../../server-v4/src/modules/data-health/dataHealthRoutes.ts';

function createAuthStore(accountsByToken) {
  return {
    listAccounts: async () => Object.values(accountsByToken).map((entry) => entry.account),
    saveAccounts: async () => {},
    readSession: async (token) => {
      const entry = accountsByToken[token];
      if (!entry) {
        return null;
      }

      return {
        token,
        username: entry.account.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      };
    },
    createSession: async () => null,
    deleteSession: async () => {},
    deleteSessionsForUser: async () => {},
  };
}

function createApp(runtimeOverrides = {}) {
  const authStore = createAuthStore({
    'viewer-token': {
      account: {
        username: 'viewer',
        role: 'manager',
        permissions: { dataHealthView: true },
      },
    },
    'blocked-token': {
      account: {
        username: 'blocked',
        role: 'staff',
        permissions: { dataHealthView: false, dataHealthManage: false, accountManage: false },
      },
    },
  });
  const runtime = {
    readDataHealthSnapshot: vi.fn(async () => ({ totals: { declarations: 12 }, storage: { health: { severity: 'ok' } } })),
    ...runtimeOverrides,
  };

  const app = express();
  app.use(express.json());
  app.use(dataHealthModule.basePath, buildDataHealthRouter(dataHealthModule, authStore, runtime));

  return { app, runtime };
}

describe('buildDataHealthRouter', () => {
  it('requires authenticated accounts with data-health permission', async () => {
    const { app } = createApp();

    const unauthenticated = await request(app).get('/api/v4/data-health/summary');
    expect(unauthenticated.status).toBe(401);

    const forbidden = await request(app)
      .get('/api/v4/data-health/summary')
      .set('Cookie', 'kpi_session=blocked-token');
    expect(forbidden.status).toBe(403);
  });

  it('returns service unavailable when runtime is missing', async () => {
    const authStore = createAuthStore({
      'viewer-token': {
        account: {
          username: 'viewer',
          role: 'manager',
          permissions: { dataHealthView: true },
        },
      },
    });
    const app = express();
    app.use(express.json());
    app.use(dataHealthModule.basePath, buildDataHealthRouter(dataHealthModule, authStore, {}));

    const response = await request(app)
      .get('/api/v4/data-health/summary')
      .set('Cookie', 'kpi_session=viewer-token');
    expect(response.status).toBe(503);
    expect(response.body.ok).toBe(false);
  });

  it('returns canonical data-health summary payload and exposes module metadata', async () => {
    const { app, runtime } = createApp();

    const metaResponse = await request(app).get('/api/v4/data-health/__meta');
    expect(metaResponse.status).toBe(200);
    expect(metaResponse.body.module.id).toBe('data-health');

    const summaryResponse = await request(app)
      .get('/api/v4/data-health/summary')
      .set('Cookie', 'kpi_session=viewer-token');
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body).toEqual(
      expect.objectContaining({
        ok: true,
        summary: expect.objectContaining({
          totals: expect.objectContaining({ declarations: 12 }),
        }),
      }),
    );
    expect(runtime.readDataHealthSnapshot).toHaveBeenCalledTimes(1);
  });
});

