/* eslint-env node */
/* @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { filterPresetsModule } from '../../server-v4/src/modules/filter-presets/filter-presets.module.ts';
import { buildFilterPresetsRouter } from '../../server-v4/src/modules/filter-presets/filterPresetsRoutes.ts';

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
  });

  const runtime = {
    sanitizeFilterPresetScope: vi.fn((scope) => {
      const normalized = String(scope || '').trim().toLowerCase();
      if (normalized === 'report-viewer') {
        return 'report-viewer';
      }
      return 'data-importer';
    }),
    listFilterPresetsForUser: vi.fn(async (_username, { scope }) => ({
      presets: [{ id: 'preset-1', name: 'Main presets', scope }],
      updatedAt: '2026-03-31T10:00:00.000Z',
    })),
    createFilterPresetForUser: vi.fn(async (_username, body, { actor }) => ({
      preset: {
        id: 'preset-created',
        name: body.name || 'Created preset',
        scope: body.scope || 'data-importer',
        actorEcho: actor,
      },
      updatedAt: '2026-03-31T10:05:00.000Z',
    })),
    updateFilterPresetForUser: vi.fn(async (_username, presetId, body) => ({
      preset: {
        id: presetId,
        name: body.name || 'Updated preset',
        scope: body.scope || 'data-importer',
      },
      updatedAt: '2026-03-31T10:10:00.000Z',
    })),
    deleteFilterPresetForUser: vi.fn(async (_username, presetId) => ({
      deleted: true,
      removed: { name: `Preset ${presetId}` },
      updatedAt: '2026-03-31T10:15:00.000Z',
    })),
    pushAuditLog: vi.fn(),
    ...runtimeOverrides,
  };

  const app = express();
  app.use(express.json());
  app.use(filterPresetsModule.basePath, buildFilterPresetsRouter(filterPresetsModule, authStore, runtime));

  return { app, runtime };
}

describe('buildFilterPresetsRouter', () => {
  it('requires an authenticated session', async () => {
    const { app } = createApp();

    const response = await request(app).get('/api/v4/filter-presets');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: 'Bạn cần đăng nhập để sử dụng bộ lọc đã lưu.',
    });
  });

  it('returns service unavailable when runtime handlers are missing', async () => {
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
    app.use(filterPresetsModule.basePath, buildFilterPresetsRouter(filterPresetsModule, authStore, {}));

    const readResponse = await request(app)
      .get('/api/v4/filter-presets')
      .set('Cookie', 'kpi_session=manager-token');
    expect(readResponse.status).toBe(503);

    const createResponse = await request(app)
      .post('/api/v4/filter-presets')
      .set('Cookie', 'kpi_session=manager-token')
      .send({ name: 'Preset 1' });
    expect(createResponse.status).toBe(503);
  });

  it('provides canonical CRUD behavior and audit logging parity', async () => {
    const { app, runtime } = createApp();

    const metaResponse = await request(app).get('/api/v4/filter-presets/__meta');
    expect(metaResponse.status).toBe(200);
    expect(metaResponse.body.module.id).toBe('filter-presets');

    const listResponse = await request(app)
      .get('/api/v4/filter-presets?scope=report-viewer')
      .set('Cookie', 'kpi_session=manager-token');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      ok: true,
      scope: 'report-viewer',
      presets: [{ id: 'preset-1', name: 'Main presets', scope: 'report-viewer' }],
      updatedAt: '2026-03-31T10:00:00.000Z',
    });

    const createResponse = await request(app)
      .post('/api/v4/filter-presets')
      .set('Cookie', 'kpi_session=manager-token')
      .send({ name: 'My preset', scope: 'data-importer' });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual(
      expect.objectContaining({
        ok: true,
        preset: expect.objectContaining({
          id: 'preset-created',
          name: 'My preset',
          scope: 'data-importer',
          actorEcho: 'manager',
        }),
      }),
    );

    const updateResponse = await request(app)
      .put('/api/v4/filter-presets/preset-created')
      .set('Cookie', 'kpi_session=manager-token')
      .send({ name: 'Updated name' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual(
      expect.objectContaining({
        ok: true,
        preset: expect.objectContaining({
          id: 'preset-created',
          name: 'Updated name',
        }),
      }),
    );

    const deleteResponse = await request(app)
      .delete('/api/v4/filter-presets/preset-created')
      .set('Cookie', 'kpi_session=manager-token');
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({
      ok: true,
      deleted: true,
      updatedAt: '2026-03-31T10:15:00.000Z',
    });

    expect(runtime.sanitizeFilterPresetScope).toHaveBeenCalledWith('report-viewer');
    expect(runtime.listFilterPresetsForUser).toHaveBeenCalledWith('manager', { scope: 'report-viewer' });
    expect(runtime.createFilterPresetForUser).toHaveBeenCalledWith(
      'manager',
      { name: 'My preset', scope: 'data-importer' },
      { actor: 'manager' },
    );
    expect(runtime.updateFilterPresetForUser).toHaveBeenCalledWith(
      'manager',
      'preset-created',
      { name: 'Updated name' },
      { actor: 'manager' },
    );
    expect(runtime.deleteFilterPresetForUser).toHaveBeenCalledWith('manager', 'preset-created', {
      actor: 'manager',
    });
    expect(runtime.pushAuditLog).toHaveBeenCalledTimes(3);
    expect(runtime.pushAuditLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        actor: 'manager',
        action: 'filter.preset.create',
      }),
    );
  });

  it('maps legacy error codes to the same response status and messages', async () => {
    const { app } = createApp({
      createFilterPresetForUser: vi.fn(async () => {
        const error = new Error('invalid filters');
        error.code = 'INVALID_FILTERS';
        throw error;
      }),
      deleteFilterPresetForUser: vi.fn(async () => {
        const error = new Error('not found');
        error.code = 'NOT_FOUND';
        throw error;
      }),
    });

    const createResponse = await request(app)
      .post('/api/v4/filter-presets')
      .set('Cookie', 'kpi_session=manager-token')
      .send({});
    expect(createResponse.status).toBe(400);
    expect(createResponse.body).toEqual({
      ok: false,
      error: 'Không có điều kiện lọc hợp lệ để lưu.',
    });

    const deleteResponse = await request(app)
      .delete('/api/v4/filter-presets/preset-missing')
      .set('Cookie', 'kpi_session=manager-token');
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.body).toEqual({
      ok: false,
      error: 'Không tìm thấy bộ lọc đã lưu tương ứng.',
    });
  });
});
