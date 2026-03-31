/* eslint-env node */
/* @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { duplicatePolicyModule } from '../../server-v4/src/modules/duplicate-policy/duplicate-policy.module.ts';
import { buildDuplicatePolicyRouter } from '../../server-v4/src/modules/duplicate-policy/duplicatePolicyRoutes.ts';

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
    'manager-token': {
      account: {
        username: 'manager',
        role: 'manager',
        permissions: { syncManage: true },
      },
    },
    'blocked-token': {
      account: {
        username: 'blocked',
        role: 'staff',
        permissions: { syncManage: false },
      },
    },
  });
  const runtime = {
    readDuplicatePolicySnapshot: vi.fn(async () => ({
      config: { autoNotifyAfterDays: 3 },
      state: { lastEvaluatedAt: '2026-03-31T00:00:00.000Z', lockedSources: [] },
      summary: { statusCounts: { awaiting_action: 2 }, sourceBreakdown: [] },
    })),
    updateDuplicatePolicySnapshot: vi.fn(async ({ actor, body }) => ({
      config: { autoNotifyAfterDays: 5, actorEcho: actor },
      state: { lockedSources: body.lockSources || [] },
      summary: { statusCounts: { awaiting_action: 1 }, sourceBreakdown: [] },
    })),
    ...runtimeOverrides,
  };

  const app = express();
  app.use(express.json());
  app.use(duplicatePolicyModule.basePath, buildDuplicatePolicyRouter(duplicatePolicyModule, authStore, runtime));

  return { app, runtime };
}

describe('buildDuplicatePolicyRouter', () => {
  it('requires authenticated manager/admin accounts with syncManage permission', async () => {
    const { app } = createApp();

    const unauthenticated = await request(app).get('/api/v4/duplicate-policy');
    expect(unauthenticated.status).toBe(401);

    const forbidden = await request(app)
      .get('/api/v4/duplicate-policy')
      .set('Cookie', 'kpi_session=blocked-token');
    expect(forbidden.status).toBe(403);
  });

  it('returns service unavailable when runtime handlers are missing', async () => {
    const authStore = createAuthStore({
      'manager-token': {
        account: {
          username: 'manager',
          role: 'manager',
          permissions: { syncManage: true },
        },
      },
    });
    const app = express();
    app.use(express.json());
    app.use(duplicatePolicyModule.basePath, buildDuplicatePolicyRouter(duplicatePolicyModule, authStore, {}));

    const readResponse = await request(app)
      .get('/api/v4/duplicate-policy')
      .set('Cookie', 'kpi_session=manager-token');
    expect(readResponse.status).toBe(503);

    const writeResponse = await request(app)
      .put('/api/v4/duplicate-policy')
      .set('Cookie', 'kpi_session=manager-token')
      .send({});
    expect(writeResponse.status).toBe(503);
  });

  it('returns canonical payload and applies updates through runtime hooks', async () => {
    const { app, runtime } = createApp();

    const metaResponse = await request(app).get('/api/v4/duplicate-policy/__meta');
    expect(metaResponse.status).toBe(200);
    expect(metaResponse.body.module.id).toBe('duplicate-policy');

    const readResponse = await request(app)
      .get('/api/v4/duplicate-policy')
      .set('Cookie', 'kpi_session=manager-token');
    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toEqual(
      expect.objectContaining({
        ok: true,
        config: expect.objectContaining({ autoNotifyAfterDays: 3 }),
        summary: expect.objectContaining({
          statusCounts: expect.objectContaining({ awaiting_action: 2 }),
        }),
      }),
    );
    expect(runtime.readDuplicatePolicySnapshot).toHaveBeenCalledTimes(1);

    const writeResponse = await request(app)
      .put('/api/v4/duplicate-policy')
      .set('Cookie', 'kpi_session=manager-token')
      .send({ lockSources: [{ source: 'A-01' }] });
    expect(writeResponse.status).toBe(200);
    expect(writeResponse.body).toEqual(
      expect.objectContaining({
        ok: true,
        config: expect.objectContaining({ actorEcho: 'manager' }),
        state: expect.objectContaining({
          lockedSources: [{ source: 'A-01' }],
        }),
      }),
    );
    expect(runtime.updateDuplicatePolicySnapshot).toHaveBeenCalledWith({
      actor: 'manager',
      body: { lockSources: [{ source: 'A-01' }] },
    });
  });
});
