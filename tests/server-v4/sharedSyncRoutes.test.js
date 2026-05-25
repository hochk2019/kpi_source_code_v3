import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { ADMIN_ROLE, getPermissionTemplate } from '../../packages/domain/src/accountRoles.js';
import { buildV4App, createRuntimePersistence } from '../../server-v4/src/index.ts';
import { authModule } from '../../server-v4/src/modules/auth/auth.module.ts';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../server-v4/src/modules/auth/authShared.ts';

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

describe('server-v4 shared sync routes', () => {
  let app = null;

  afterEach(async () => {
    await disposeApp(app);
    app = null;
  });

  it('mounts canonical shared-sync routes with auth and read/write behavior', async () => {
    app = await createAuthOnlyApp();
    const agent = request.agent(app);

    const unauthorized = await agent.get('/api/v4/shared-sync/bootstrap');
    expect(unauthorized.status).toBe(401);

    const loginResponse = await agent.post('/api/v4/auth/login').send({
      username: 'admin',
      password: 'admin123',
    });

    expect(loginResponse.status).toBe(200);
    const csrfToken = getCookieValue(loginResponse, CSRF_COOKIE_NAME);
    expect(csrfToken).toBeTruthy();

    const bootstrapResponse = await agent.get('/api/v4/shared-sync/bootstrap');
    expect(bootstrapResponse.status).toBe(200);
    expect(bootstrapResponse.body).toMatchObject({
      mode: 'shared-light',
      data: expect.objectContaining({
        kpi_users_v1: expect.any(String),
      }),
      deferredKeys: expect.any(Array),
      meta: expect.objectContaining({
        requestId: expect.any(String),
        durationMs: expect.any(Number),
      }),
    });

    const readDeclarations = await agent.get('/api/v4/shared-sync/storage/decl_rows_v1');
    expect(readDeclarations.status).toBe(200);
    expect(readDeclarations.body).toMatchObject({
      ok: true,
      key: 'decl_rows_v1',
      value: [],
      raw: '[]',
    });

    const writeRoster = await agent
      .put('/api/v4/shared-sync/storage/team_roster_v1')
      .set(CSRF_HEADER_NAME, csrfToken)
      .send({
        value: {
          version: 1,
          teams: [
            {
              id: 'blue-team',
              name: 'Blue Team',
              members: [],
            },
          ],
        },
      });

    expect(writeRoster.status).toBe(200);
    expect(writeRoster.body).toMatchObject({
      ok: true,
      key: 'team_roster_v1',
      value: expect.objectContaining({
        version: 1,
        teams: expect.arrayContaining([
          expect.objectContaining({
            name: 'Blue Team',
            members: [],
          }),
        ]),
      }),
    });

  });
});

function getCookieValue(response, name) {
  const cookie = response.headers['set-cookie']?.find((entry) => entry.startsWith(`${name}=`));
  return cookie?.split(';')[0]?.split('=')[1] ?? '';
}
