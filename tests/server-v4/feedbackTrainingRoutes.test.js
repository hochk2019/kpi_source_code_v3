/* eslint-env node */
/* @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { feedbackTrainingModule } from '../../server-v4/src/modules/feedback-training/feedback-training.module.ts';
import { buildFeedbackTrainingRouter } from '../../server-v4/src/modules/feedback-training/feedbackTrainingRoutes.ts';

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
        permissions: {},
      },
    },
    'staff-token': {
      account: {
        username: 'staff',
        role: 'staff',
        permissions: {},
      },
    },
  });

  const runtime = {
    getTrainingResources: vi.fn(async () => [{ id: 'r1', title: 'Quick start' }]),
    getFeedbackSummary: vi.fn(async () => ({ total: 2, latestAt: '2026-03-31T09:00:00.000Z', averageRating: 4 })),
    listFeedbackEntries: vi.fn(async ({ limit } = {}) => [{ id: 'fb-1', category: 'khac', limitEcho: limit }]),
    addFeedbackEntry: vi.fn(async (payload) => ({
      id: 'fb-created',
      category: payload.category,
      actor: payload.actor || null,
    })),
    pushNotification: vi.fn(),
    ...runtimeOverrides,
  };

  const app = express();
  app.use(express.json());
  app.use(
    feedbackTrainingModule.basePath,
    buildFeedbackTrainingRouter(feedbackTrainingModule, authStore, runtime),
  );
  return { app, runtime };
}

describe('buildFeedbackTrainingRouter', () => {
  it('returns metadata and public training/summary endpoints', async () => {
    const { app, runtime } = createApp();

    const metaResponse = await request(app).get('/api/v4/feedback-training/__meta');
    expect(metaResponse.status).toBe(200);
    expect(metaResponse.body.module.id).toBe('feedback-training');

    const trainingResponse = await request(app).get('/api/v4/feedback-training/training-resources');
    expect(trainingResponse.status).toBe(200);
    expect(trainingResponse.body).toEqual({
      ok: true,
      resources: [{ id: 'r1', title: 'Quick start' }],
    });

    const summaryResponse = await request(app).get('/api/v4/feedback-training/feedback/summary');
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body).toEqual({
      ok: true,
      summary: { total: 2, latestAt: '2026-03-31T09:00:00.000Z', averageRating: 4 },
    });

    expect(runtime.getTrainingResources).toHaveBeenCalledTimes(1);
    expect(runtime.getFeedbackSummary).toHaveBeenCalledTimes(1);
  });

  it('requires manager/admin role to review feedback entries', async () => {
    const { app, runtime } = createApp();

    const anonymousResponse = await request(app).get('/api/v4/feedback-training/feedback');
    expect(anonymousResponse.status).toBe(401);
    expect(anonymousResponse.body).toEqual({
      ok: false,
      error: 'Vui lòng đăng nhập để xem phản hồi người dùng.',
    });

    const staffResponse = await request(app)
      .get('/api/v4/feedback-training/feedback')
      .set('Cookie', 'kpi_session=staff-token');
    expect(staffResponse.status).toBe(403);
    expect(staffResponse.body).toEqual({
      ok: false,
      error: 'Chỉ quản trị viên hoặc trưởng bộ phận mới xem được phản hồi người dùng.',
    });

    const managerResponse = await request(app)
      .get('/api/v4/feedback-training/feedback?limit=7')
      .set('Cookie', 'kpi_session=manager-token');
    expect(managerResponse.status).toBe(200);
    expect(managerResponse.body).toEqual({
      ok: true,
      entries: [{ id: 'fb-1', category: 'khac', limitEcho: 7 }],
    });

    expect(runtime.listFeedbackEntries).toHaveBeenCalledWith({ limit: 7 });
  });

  it('creates feedback entries and emits notification payload parity', async () => {
    const { app, runtime } = createApp();

    const response = await request(app)
      .post('/api/v4/feedback-training/feedback')
      .set('Cookie', 'kpi_session=manager-token')
      .send({
        category: 'ui',
        rating: 4,
        message: 'Please simplify this flow.',
        contact: 'ops@example.com',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ok: true,
      entry: {
        id: 'fb-created',
        category: 'ui',
        actor: 'manager',
      },
    });
    expect(runtime.addFeedbackEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'ui',
        rating: 4,
        message: 'Please simplify this flow.',
        actor: 'manager',
      }),
    );
    expect(runtime.pushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'feedback.new',
        severity: 'info',
        meta: { feedbackId: 'fb-created' },
      }),
    );
  });

  it('maps runtime-not-ready and validation errors to legacy-compatible responses', async () => {
    const authStore = createAuthStore({
      'manager-token': {
        account: {
          username: 'manager',
          role: 'manager',
          permissions: {},
        },
      },
    });
    const app = express();
    app.use(express.json());
    app.use(
      feedbackTrainingModule.basePath,
      buildFeedbackTrainingRouter(feedbackTrainingModule, authStore, {}),
    );

    const unavailable = await request(app).get('/api/v4/feedback-training/training-resources');
    expect(unavailable.status).toBe(503);

    const { app: errorApp } = createApp({
      addFeedbackEntry: vi.fn(async () => {
        throw new Error('Thiếu nội dung phản hồi.');
      }),
    });
    const invalidSubmit = await request(errorApp)
      .post('/api/v4/feedback-training/feedback')
      .send({ category: 'ui', message: '' });

    expect(invalidSubmit.status).toBe(400);
    expect(invalidSubmit.body).toEqual({
      ok: false,
      error: 'Thiếu nội dung phản hồi.',
    });
  });
});
