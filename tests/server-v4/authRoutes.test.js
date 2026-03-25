import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { ADMIN_ROLE, DEFAULT_ROLE, getPermissionTemplate } from '../../packages/domain/src/accountRoles.js';
import { buildV4App } from '../../server-v4/src/index.ts';
import { authModule } from '../../server-v4/src/modules/auth/auth.module.ts';

describe('server-v4 auth routes', () => {
  it('supports login, session restore, account management, password flows, and logout with cookie-backed sessions', async () => {
    const authStore = createAuthStore([
      createAccount({
        username: 'admin',
        password: 'admin123',
        role: ADMIN_ROLE,
        name: 'Admin User',
      }),
      createAccount({
        username: 'staff',
        password: 'staff123',
        role: DEFAULT_ROLE,
        name: 'Staff User',
      }),
    ]);
    const app = buildV4App({
      modules: [authModule],
      persistence: {
        mode: 'sqlite-dual-write',
        sourceKind: 'dual-write',
        authStore,
        dispose: async () => {},
      },
    });

    const loginResponse = await request(app)
      .post('/api/v4/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user).toMatchObject({
      username: 'admin',
      role: ADMIN_ROLE,
      name: 'Admin User',
    });

    const cookie = getCookie(loginResponse);

    const sessionResponse = await request(app)
      .get('/api/v4/auth/session')
      .set('Cookie', cookie);

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.data.user).toMatchObject({
      username: 'admin',
      role: ADMIN_ROLE,
    });

    const accountsResponse = await request(app)
      .get('/api/v4/auth/accounts')
      .set('Cookie', cookie);

    expect(accountsResponse.status).toBe(200);
    expect(accountsResponse.body.data.accounts).toHaveLength(2);

    const createResponse = await request(app)
      .post('/api/v4/auth/accounts')
      .set('Cookie', cookie)
      .send({
        username: 'new.staff',
        password: 'newstaff123',
        role: DEFAULT_ROLE,
        name: 'New Staff',
        memberId: 'member-1',
        memberName: 'New Staff',
        teamId: 'team-1',
        teamName: 'Blue Team',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.account).toMatchObject({
      username: 'new.staff',
      role: DEFAULT_ROLE,
      memberId: 'member-1',
      teamName: 'Blue Team',
    });

    const updateResponse = await request(app)
      .patch('/api/v4/auth/accounts/new.staff')
      .set('Cookie', cookie)
      .send({
        name: 'Updated Staff',
        teamName: 'Red Team',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.account).toMatchObject({
      username: 'new.staff',
      name: 'Updated Staff',
      teamName: 'Red Team',
    });

    const setPasswordResponse = await request(app)
      .post('/api/v4/auth/accounts/new.staff/password')
      .set('Cookie', cookie)
      .send({
        password: 'newstaff456',
      });

    expect(setPasswordResponse.status).toBe(200);
    expect(setPasswordResponse.body.data.account).toMatchObject({
      username: 'new.staff',
      name: 'Updated Staff',
    });

    const newStaffLoginResponse = await request(app)
      .post('/api/v4/auth/login')
      .send({ username: 'new.staff', password: 'newstaff456' });

    expect(newStaffLoginResponse.status).toBe(200);
    expect(newStaffLoginResponse.body.data.user).toMatchObject({
      username: 'new.staff',
    });

    const newStaffCookie = getCookie(newStaffLoginResponse);

    const changeOwnPasswordResponse = await request(app)
      .post('/api/v4/auth/password/change')
      .set('Cookie', newStaffCookie)
      .send({
        username: 'new.staff',
        currentPassword: 'newstaff456',
        newPassword: 'newstaff789',
      });

    expect(changeOwnPasswordResponse.status).toBe(200);
    expect(changeOwnPasswordResponse.body.data.account).toMatchObject({
      username: 'new.staff',
      name: 'Updated Staff',
    });

    const changedPasswordCookie = getCookie(changeOwnPasswordResponse);

    const oldPasswordLoginResponse = await request(app)
      .post('/api/v4/auth/login')
      .send({ username: 'new.staff', password: 'newstaff456' });

    expect(oldPasswordLoginResponse.status).toBe(401);
    expect(oldPasswordLoginResponse.body.error).toMatchObject({
      code: 'invalid_credentials',
    });

    const reloginResponse = await request(app)
      .post('/api/v4/auth/login')
      .send({ username: 'new.staff', password: 'newstaff789' });

    expect(reloginResponse.status).toBe(200);

    const deleteResponse = await request(app)
      .delete('/api/v4/auth/accounts/new.staff')
      .set('Cookie', cookie);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data.accounts).toHaveLength(2);

    const logoutResponse = await request(app)
      .post('/api/v4/auth/logout')
      .set('Cookie', changedPasswordCookie);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toEqual({
      ok: true,
      data: {},
    });

    const postLogoutSessionResponse = await request(app)
      .get('/api/v4/auth/session')
      .set('Cookie', changedPasswordCookie);

    expect(postLogoutSessionResponse.status).toBe(200);
    expect(postLogoutSessionResponse.body).toEqual({
      ok: true,
      data: {
        user: null,
        expiresAt: null,
      },
    });
  });

  it('rejects unauthenticated access, invalid credentials, and invalid account payloads', async () => {
    const authStore = createAuthStore([
      createAccount({
        username: 'admin',
        password: 'admin123',
        role: ADMIN_ROLE,
        name: 'Admin User',
      }),
    ]);
    const app = buildV4App({
      modules: [authModule],
      persistence: {
        mode: 'sqlite-dual-write',
        sourceKind: 'dual-write',
        authStore,
        dispose: async () => {},
      },
    });

    const unauthenticatedResponse = await request(app).get('/api/v4/auth/accounts');
    expect(unauthenticatedResponse.status).toBe(401);
    expect(unauthenticatedResponse.body.error).toMatchObject({
      code: 'auth_required',
    });

    const invalidLoginResponse = await request(app)
      .post('/api/v4/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });

    expect(invalidLoginResponse.status).toBe(401);
    expect(invalidLoginResponse.body.error).toMatchObject({
      code: 'invalid_credentials',
    });

    const loginResponse = await request(app)
      .post('/api/v4/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    const cookie = getCookie(loginResponse);

    const invalidCreateResponse = await request(app)
      .post('/api/v4/auth/accounts')
      .set('Cookie', cookie)
      .send({
        username: 'too-short',
        password: '123',
      });

    expect(invalidCreateResponse.status).toBe(400);
    expect(invalidCreateResponse.body.error).toMatchObject({
      code: 'validation_error',
    });

    const invalidSetPasswordResponse = await request(app)
      .post('/api/v4/auth/accounts/admin/password')
      .set('Cookie', cookie)
      .send({
        password: '123',
      });

    expect(invalidSetPasswordResponse.status).toBe(400);
    expect(invalidSetPasswordResponse.body.error).toMatchObject({
      code: 'validation_error',
    });
  });

  it('forbids non-admin account management, enforces self-change boundaries, and blocks the last admin delete/demotion', async () => {
    const authStore = createAuthStore([
      createAccount({
        username: 'admin',
        password: 'admin123',
        role: ADMIN_ROLE,
        name: 'Admin User',
      }),
      createAccount({
        username: 'staff',
        password: 'staff123',
        role: DEFAULT_ROLE,
        name: 'Staff User',
      }),
    ]);
    const app = buildV4App({
      modules: [authModule],
      persistence: {
        mode: 'sqlite-dual-write',
        sourceKind: 'dual-write',
        authStore,
        dispose: async () => {},
      },
    });

    const staffLoginResponse = await request(app)
      .post('/api/v4/auth/login')
      .send({ username: 'staff', password: 'staff123' });
    const staffCookie = getCookie(staffLoginResponse);

    const forbiddenResponse = await request(app)
      .get('/api/v4/auth/accounts')
      .set('Cookie', staffCookie);

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error).toMatchObject({
      code: 'forbidden',
    });

    const forbiddenPasswordResetResponse = await request(app)
      .post('/api/v4/auth/accounts/admin/password')
      .set('Cookie', staffCookie)
      .send({
        password: 'admin456',
      });

    expect(forbiddenPasswordResetResponse.status).toBe(403);
    expect(forbiddenPasswordResetResponse.body.error).toMatchObject({
      code: 'forbidden',
    });

    const forbiddenDeleteResponse = await request(app)
      .delete('/api/v4/auth/accounts/admin')
      .set('Cookie', staffCookie);

    expect(forbiddenDeleteResponse.status).toBe(403);
    expect(forbiddenDeleteResponse.body.error).toMatchObject({
      code: 'forbidden',
    });

    const forbiddenOwnPasswordResponse = await request(app)
      .post('/api/v4/auth/password/change')
      .set('Cookie', staffCookie)
      .send({
        username: 'admin',
        currentPassword: 'staff123',
        newPassword: 'admin456',
      });

    expect(forbiddenOwnPasswordResponse.status).toBe(403);
    expect(forbiddenOwnPasswordResponse.body.error).toMatchObject({
      code: 'forbidden',
    });

    const adminLoginResponse = await request(app)
      .post('/api/v4/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    const adminCookie = getCookie(adminLoginResponse);

    const lastAdminResponse = await request(app)
      .patch('/api/v4/auth/accounts/admin')
      .set('Cookie', adminCookie)
      .send({ role: DEFAULT_ROLE });

    expect(lastAdminResponse.status).toBe(400);
    expect(lastAdminResponse.body.error).toMatchObject({
      code: 'invalid_request',
    });

    const lastAdminDeleteResponse = await request(app)
      .delete('/api/v4/auth/accounts/admin')
      .set('Cookie', adminCookie);

    expect(lastAdminDeleteResponse.status).toBe(400);
    expect(lastAdminDeleteResponse.body.error).toMatchObject({
      code: 'invalid_request',
    });

    const wrongCurrentPasswordResponse = await request(app)
      .post('/api/v4/auth/password/change')
      .set('Cookie', staffCookie)
      .send({
        username: 'staff',
        currentPassword: 'wrong-password',
        newPassword: 'staff456',
      });

    expect(wrongCurrentPasswordResponse.status).toBe(401);
    expect(wrongCurrentPasswordResponse.body.error).toMatchObject({
      code: 'invalid_credentials',
    });
  });
});

function createAuthStore(initialAccounts) {
  let accounts = clone(initialAccounts);
  const sessions = new Map();
  let sessionCounter = 0;

  return {
    async listAccounts() {
      return clone(accounts);
    },
    async saveAccounts(nextAccounts) {
      accounts = clone(nextAccounts);
    },
    async readSession(token) {
      return clone(sessions.get(token) ?? null);
    },
    async createSession(username) {
      const session = {
        token: `session-${++sessionCounter}`,
        username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      };
      sessions.set(session.token, session);
      return clone(session);
    },
    async deleteSession(token) {
      sessions.delete(token);
    },
    async deleteSessionsForUser(username) {
      for (const [token, session] of sessions.entries()) {
        if (session.username === username) {
          sessions.delete(token);
        }
      }
    },
  };
}

function createAccount({ username, password, role, name }) {
  return {
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    name,
    permissions: getPermissionTemplate(role),
    memberId: null,
    memberName: null,
    teamId: null,
    teamName: null,
    updatedAt: '2026-03-13T00:00:00.000Z',
  };
}

function getCookie(response) {
  const cookie = response.headers['set-cookie']?.[0];
  expect(cookie).toContain('kpi_session=');
  return cookie;
}

function clone(value) {
  return value === null ? null : JSON.parse(JSON.stringify(value));
}
