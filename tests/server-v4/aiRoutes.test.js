import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { buildV4App } from '../../server-v4/src/index.ts';
import { aiModule } from '../../server-v4/src/modules/ai/ai.module.ts';
import { AI_NOT_CONFIGURED_CODE } from '../../server-v4/src/modules/ai/aiRoutes.ts';

// Concrete frontend AI endpoint inventory (apps consume these via src/lib/aiClient.js).
// Each entry mirrors a call made by the AiAssistant Page_Module.
const FRONTEND_AI_ENDPOINTS = [
  { method: 'get', path: '/api/v4/ai/profile' },
  { method: 'get', path: '/api/v4/ai/config' },
  { method: 'put', path: '/api/v4/ai/config' },
  { method: 'delete', path: '/api/v4/ai/cache' },
  { method: 'post', path: '/api/v4/ai/providers/test' },
  { method: 'post', path: '/api/v4/ai/providers/ping' },
  { method: 'post', path: '/api/v4/ai/chat' },
  { method: 'get', path: '/api/v4/ai/history' },
  { method: 'put', path: '/api/v4/ai/history' },
  { method: 'delete', path: '/api/v4/ai/history' },
  { method: 'get', path: '/api/v4/ai/data/snapshot' },
  { method: 'get', path: '/api/v4/ai/data/snapshot/history' },
  { method: 'get', path: '/api/v4/ai/data/snapshot/history/snap-1' },
  { method: 'get', path: '/api/v4/ai/insights' },
  { method: 'post', path: '/api/v4/ai/insights/run' },
  { method: 'post', path: '/api/v4/ai/insights/feedback' },
  { method: 'put', path: '/api/v4/ai/insights/settings' },
];

describe('server-v4 AI assistant endpoint coverage', () => {
  it('registers the AI module in the runtime catalog', async () => {
    const app = buildV4App({ dbFile: ':memory:' });
    const response = await request(app).get('/api/v4/ai/__meta');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.module.id).toBe('ai');
    expect(response.body.module.basePath).toBe('/api/v4/ai');

    if (app.locals?.runtimePersistenceDispose) {
      await app.locals.runtimePersistenceDispose();
    }
  });

  it('serves every frontend AI endpoint with a structured AI_NOT_CONFIGURED response (never a hard 404)', async () => {
    const app = buildV4App({ dbFile: ':memory:' });

    for (const endpoint of FRONTEND_AI_ENDPOINTS) {
      const response = await request(app)[endpoint.method](endpoint.path);

      // The route MUST be registered: the contract 404 handler would return
      // ENDPOINT_NOT_FOUND, which signals a coverage gap.
      expect(
        response.body?.code,
        `${endpoint.method.toUpperCase()} ${endpoint.path} should be registered`,
      ).not.toBe('ENDPOINT_NOT_FOUND');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        ok: false,
        code: AI_NOT_CONFIGURED_CODE,
      });
      expect(typeof response.body.error).toBe('string');
    }

    if (app.locals?.runtimePersistenceDispose) {
      await app.locals.runtimePersistenceDispose();
    }
  });

  it('keeps the declared AI route matrix in sync with the frontend inventory', () => {
    const declared = new Set(
      aiModule.routeGroups.flatMap((group) =>
        group.routes.map((route) => `${route.method} ${aiModule.basePath}${route.path}`),
      ),
    );

    for (const endpoint of FRONTEND_AI_ENDPOINTS) {
      // Normalize the concrete probe path back to its declared (parameterized) form.
      const declaredPath = endpoint.path.replace('/data/snapshot/history/snap-1', '/data/snapshot/history/:id');
      const key = `${endpoint.method.toUpperCase()} ${declaredPath}`;
      expect(declared.has(key), `AI module should declare ${key}`).toBe(true);
    }
  });
});
