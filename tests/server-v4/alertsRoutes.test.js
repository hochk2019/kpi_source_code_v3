/* eslint-env node */
/* @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { alertsModule } from '../../server-v4/src/modules/alerts/alerts.module.ts';
import { buildAlertsRouter } from '../../server-v4/src/modules/alerts/alertsRoutes.ts';
import { createAlertsRuntime } from '../../server-v4/src/modules/alerts/alertsRuntime.ts';

let runtimes = [];

afterEach(async () => {
  await Promise.all(runtimes.map((runtime) => runtime.dispose?.()));
  runtimes = [];
});

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
        role: 'admin',
        permissions: { alertsManage: true, notificationView: true },
      },
    },
    'viewer-token': {
      account: {
        username: 'viewer',
        role: 'staff',
        permissions: { notificationView: true },
      },
    },
    'blocked-token': {
      account: {
        username: 'blocked',
        role: 'staff',
        permissions: { notificationView: false },
      },
    },
  });
  const alertsRuntime = createAlertsRuntime({
    initialAlerts: [
      { key: 'decl-1', resolved: false, code: 'A01' },
      { key: 'decl-2', resolved: false, code: 'B02' },
    ],
    initialConfig: { staleAfterHours: 24 },
    initialNotifications: [
      { id: 'evt-1', message: 'First event' },
      { id: 'evt-2', message: 'Second event' },
    ],
    ...runtimeOverrides,
  });
  runtimes.push(alertsRuntime);

  const app = express();
  app.use(express.json());
  app.use(alertsModule.basePath, buildAlertsRouter(alertsModule, authStore, alertsRuntime));

  return { app, alertsRuntime };
}

describe('buildAlertsRouter', () => {
  it('requires notification permissions for feeds and alert-manage permission for mutations', async () => {
    const { app } = createApp();

    const unauthenticated = await request(app).get('/api/v4/alerts/summary');
    expect(unauthenticated.status).toBe(401);

    const summary = await request(app)
      .get('/api/v4/alerts/notifications')
      .set('Cookie', 'kpi_session=viewer-token');
    expect(summary.status).toBe(200);
    expect(summary.body.ok).toBe(true);

    const deniedConfig = await request(app)
      .put('/api/v4/alerts/config')
      .set('Cookie', 'kpi_session=viewer-token')
      .send({ config: { staleAfterHours: 6 } });
    expect(deniedConfig.status).toBe(403);

    const deniedNotifications = await request(app)
      .get('/api/v4/alerts/notifications')
      .set('Cookie', 'kpi_session=blocked-token');
    expect(deniedNotifications.status).toBe(403);
  });

  it('updates config and toggles review state through the canonical alerts surface', async () => {
    const { app } = createApp();

    const configResponse = await request(app)
      .put('/api/v4/alerts/config')
      .set('Cookie', 'kpi_session=manager-token')
      .send({ config: { staleAfterHours: 6, escalate: true } });
    expect(configResponse.status).toBe(200);
    expect(configResponse.body).toMatchObject({
      ok: true,
      config: {
        staleAfterHours: 6,
        escalate: true,
      },
    });

    const reviewResponse = await request(app)
      .post('/api/v4/alerts/review')
      .set('Cookie', 'kpi_session=manager-token')
      .send({ keys: ['decl-1'] });
    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body).toMatchObject({
      ok: true,
      updated: 1,
      summary: {
        outstanding: 1,
        totalTracked: 2,
      },
    });

    const unreviewResponse = await request(app)
      .post('/api/v4/alerts/unreview')
      .set('Cookie', 'kpi_session=manager-token')
      .send({ keys: ['decl-1'] });
    expect(unreviewResponse.status).toBe(200);
    expect(unreviewResponse.body).toMatchObject({
      ok: true,
      updated: 1,
      summary: {
        outstanding: 2,
        totalTracked: 2,
      },
    });
  });

  it('delegates notification streaming to the runtime adapter', async () => {
    const registerNotificationStream = vi.fn((res) => {
      res.status(200).json({ ok: true, streamed: true });
    });
    const { app } = createApp({ registerNotificationStream });

    const response = await request(app)
      .get('/api/v4/alerts/notifications/stream')
      .set('Cookie', 'kpi_session=manager-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, streamed: true });
    expect(registerNotificationStream).toHaveBeenCalledTimes(1);
  });
});
