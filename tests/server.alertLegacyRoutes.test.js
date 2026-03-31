/* eslint-env node */
/* @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import {
  registerLegacyImportAlertRoutes,
  registerLegacyNotificationRoutes,
} from '../server-v4/src/modules/alerts/alertsLegacyRoutes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}

describe('legacy alert + notification route registration', () => {
  it('serves /api/notifications with parsed limit', async () => {
    const app = createApp();
    const requireNotificationAccess = vi.fn(() => ({ denied: false }));
    const listNotifications = vi.fn(() => [{ id: 'evt-1' }]);
    const registerSseClient = vi.fn();

    registerLegacyNotificationRoutes(app, {
      requireNotificationAccess,
      listNotifications,
      registerSseClient,
    });

    const res = await request(app).get('/api/notifications?limit=25');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, events: [{ id: 'evt-1' }] });
    expect(listNotifications).toHaveBeenCalledWith({ limit: 25 });
    expect(registerSseClient).not.toHaveBeenCalled();
  });

  it('opens /api/notifications/stream via registerSseClient', async () => {
    const app = createApp();
    const requireNotificationAccess = vi.fn(() => ({ denied: false }));
    const listNotifications = vi.fn();
    const registerSseClient = vi.fn((res) => {
      res.status(200).json({ ok: true, stream: 'opened' });
    });

    registerLegacyNotificationRoutes(app, {
      requireNotificationAccess,
      listNotifications,
      registerSseClient,
    });

    const res = await request(app).get('/api/notifications/stream');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, stream: 'opened' });
    expect(registerSseClient).toHaveBeenCalledTimes(1);
  });

  it('serves /api/import/alerts payload and config', async () => {
    const app = createApp();
    const requireAlertsManage = vi.fn(() => ({
      denied: false,
      context: { account: { username: 'admin' } },
    }));
    const buildAlertPayload = vi.fn(() => ({
      alerts: [{ key: 'decl-1' }],
      config: { enabled: true },
      summary: { outstanding: 1, totalTracked: 1, lastEvaluatedAt: null },
    }));
    const getAlertConfig = vi.fn(() => ({ enabled: true }));
    const saveAlertConfig = vi.fn(() => ({ enabled: false }));
    const evaluateDeclarationAlerts = vi.fn(() => ({
      outstanding: 0,
      totalTracked: 1,
      lastEvaluatedAt: '2026-01-01T00:00:00.000Z',
    }));
    const markDeclarationsReviewed = vi.fn(() => 1);
    const unmarkDeclarationsReviewed = vi.fn(() => 1);

    registerLegacyImportAlertRoutes(app, {
      requireAlertsManage,
      buildAlertPayload,
      getAlertConfig,
      saveAlertConfig,
      evaluateDeclarationAlerts,
      markDeclarationsReviewed,
      unmarkDeclarationsReviewed,
    });

    const summaryRes = await request(app).get('/api/import/alerts');
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.ok).toBe(true);
    expect(summaryRes.body.alerts).toEqual([{ key: 'decl-1' }]);

    const configRes = await request(app).get('/api/import/alerts/config');
    expect(configRes.status).toBe(200);
    expect(configRes.body).toEqual({ ok: true, config: { enabled: true } });
  });

  it('updates/reviews/unreviews import alerts with actor context', async () => {
    const app = createApp();
    const requireAlertsManage = vi.fn(() => ({
      denied: false,
      context: { account: { username: 'auditor' } },
    }));
    const buildAlertPayload = vi.fn(() => ({
      alerts: [],
      config: {},
      summary: { outstanding: 0, totalTracked: 0, lastEvaluatedAt: null },
    }));
    const getAlertConfig = vi.fn(() => ({}));
    const saveAlertConfig = vi.fn(() => ({ threshold: 3 }));
    const evaluateDeclarationAlerts = vi.fn(() => ({
      outstanding: 2,
      totalTracked: 4,
      lastEvaluatedAt: '2026-01-01T00:00:00.000Z',
    }));
    const markDeclarationsReviewed = vi.fn(() => 2);
    const unmarkDeclarationsReviewed = vi.fn(() => 1);

    registerLegacyImportAlertRoutes(app, {
      requireAlertsManage,
      buildAlertPayload,
      getAlertConfig,
      saveAlertConfig,
      evaluateDeclarationAlerts,
      markDeclarationsReviewed,
      unmarkDeclarationsReviewed,
    });

    const updateRes = await request(app).put('/api/import/alerts/config').send({ config: { threshold: 3 } });
    expect(updateRes.status).toBe(200);
    expect(saveAlertConfig).toHaveBeenCalledWith({ threshold: 3 });
    expect(evaluateDeclarationAlerts).toHaveBeenCalledWith({ actor: 'auditor', reason: 'alert-config' });

    const reviewRes = await request(app).post('/api/import/alerts/review').send({ keys: ['a', 'b'] });
    expect(reviewRes.status).toBe(200);
    expect(markDeclarationsReviewed).toHaveBeenCalledWith(['a', 'b'], { actor: 'auditor' });
    expect(evaluateDeclarationAlerts).toHaveBeenCalledWith({ actor: 'auditor', reason: 'manual-review' });

    const unreviewRes = await request(app).post('/api/import/alerts/unreview').send({ keys: ['a'] });
    expect(unreviewRes.status).toBe(200);
    expect(unmarkDeclarationsReviewed).toHaveBeenCalledWith(['a'], { actor: 'auditor' });
    expect(evaluateDeclarationAlerts).toHaveBeenCalledWith({ actor: 'auditor', reason: 'manual-unreview' });
  });
});
