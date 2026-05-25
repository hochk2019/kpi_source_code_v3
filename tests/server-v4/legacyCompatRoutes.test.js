import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { ADMIN_ROLE, getPermissionTemplate } from '../../packages/domain/src/accountRoles.js';
import { buildV4App, createRuntimePersistence } from '../../server-v4/src/index.ts';
import { authModule } from '../../server-v4/src/modules/auth/auth.module.ts';

const TEST_DB_FILE = ':memory:';

async function createAuthOnlyApp() {
  const persistence = createRuntimePersistence({
    dbFile: TEST_DB_FILE,
    persistenceMode: 'sqlite-dual-write',
    postgresUrl: null,
    postgresLegacySqliteFallback: false,
  });

  const passwordHash = await bcrypt.hash('admin123', 10);
  await persistence.authStore.saveAccounts([
    {
      username: 'admin',
      passwordHash,
      role: ADMIN_ROLE,
      name: 'Admin User',
      permissions: getPermissionTemplate(ADMIN_ROLE),
      memberId: null,
      memberName: null,
      teamId: null,
      teamName: null,
      updatedAt: new Date().toISOString(),
    },
  ]);

  const app = buildV4App({
    modules: [authModule],
    persistence,
  });

  return app;
}

async function disposeApp(app) {
  await app?.locals?.runtimePersistenceDispose?.();
}

describe('server-v4 legacy compatibility routes', () => {
  let app = null;

  afterEach(async () => {
    await disposeApp(app);
    app = null;
  });

  it('does not mount legacy compatibility endpoints anymore', async () => {
    app = await createAuthOnlyApp();

    const legacyGetRoutes = ['/api/auth/session', '/api/bootstrap', '/api/storage/decl_rows_v1', '/api/session'];
    for (const route of legacyGetRoutes) {
      const response = await request(app).get(route);
      expect(response.status).toBe(404);
    }

    const legacyPostRoutes = ['/api/auth/login', '/api/auth/logout', '/api/login', '/api/logout'];
    for (const route of legacyPostRoutes) {
      const response = await request(app).post(route).send({
        username: 'admin',
        password: 'admin123',
      });
      expect(response.status).toBe(404);
    }
  });

  it('keeps canonical v4 auth routes operational', async () => {
    app = await createAuthOnlyApp();

    const loginResponse = await request(app).post('/api/v4/auth/login').send({
      username: 'admin',
      password: 'admin123',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toMatchObject({
      ok: true,
      data: {
        user: {
          username: 'admin',
          role: ADMIN_ROLE,
        },
      },
    });
  });
});
