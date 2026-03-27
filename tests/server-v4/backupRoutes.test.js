/* eslint-env node */
/* @vitest-environment node */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { backupModule } from '../../server-v4/src/modules/backup/backup.module.ts';
import { buildBackupRouter } from '../../server-v4/src/modules/backup/backupRoutes.ts';
import { createBackupAdminRuntime } from '../../server-v4/src/modules/backup/backupRuntime.ts';

let tempDirs = [];
let runtimes = [];

afterEach(async () => {
  await Promise.all(runtimes.map((runtime) => runtime.dispose?.()));
  runtimes = [];
  await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function createTempRoot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-backup-routes-'));
  tempDirs.push(dir);
  return dir;
}

function createAuthStore(accountsByToken) {
  const resetMock = vi.fn();

  return {
    resetMock,
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
    reset: () => {
      resetMock();
    },
  };
}

async function createApp() {
  const root = await createTempRoot();
  const dbFile = path.join(root, 'storage.sqlite');
  const backupDir = path.join(root, 'custom-backups');

  await fs.writeFile(dbFile, 'primary-db');

  const authStore = createAuthStore({
    'admin-token': {
      account: {
        username: 'admin',
        role: 'admin',
        permissions: { accountManage: true, auditView: true },
      },
    },
    'auditor-token': {
      account: {
        username: 'auditor',
        role: 'staff',
        permissions: { auditView: true },
      },
    },
  });
  const backupAdmin = createBackupAdminRuntime({
    authStore,
    dbFile,
    defaultCron: '0 3 * * *',
  });
  runtimes.push(backupAdmin);

  const app = express();
  app.use(express.json());
  app.use(backupModule.basePath, buildBackupRouter(backupModule, authStore, backupAdmin));

  return { app, authStore, backupAdmin, backupDir, dbFile };
}

describe('buildBackupRouter', () => {
  it('requires audit permission for summary and admin permission for mutations', async () => {
    const { app } = await createApp();

    const unauthenticated = await request(app).get('/api/v4/backups/summary');
    expect(unauthenticated.status).toBe(401);

    const summary = await request(app)
      .get('/api/v4/backups/summary')
      .set('Cookie', 'kpi_session=auditor-token');
    expect(summary.status).toBe(200);
    expect(summary.body.ok).toBe(true);

    const deniedRun = await request(app)
      .post('/api/v4/backups/run')
      .set('Cookie', 'kpi_session=auditor-token')
      .send({ reason: 'manual' });
    expect(deniedRun.status).toBe(403);
  });

  it('runs backups and updates schedule config through the route surface', async () => {
    const { app, backupDir } = await createApp();

    const runResponse = await request(app)
      .post('/api/v4/backups/run')
      .set('Cookie', 'kpi_session=admin-token')
      .send({
        reason: 'manual-smoke',
        directory: backupDir,
      });

    expect(runResponse.status).toBe(200);
    expect(runResponse.body.ok).toBe(true);
    const backupFiles = await fs.readdir(backupDir);
    expect(backupFiles.some((entry) => entry.endsWith('.sqlite'))).toBe(true);

    const scheduleResponse = await request(app)
      .post('/api/v4/backups/schedule')
      .set('Cookie', 'kpi_session=admin-token')
      .send({
        cron: '15 2 * * *',
        retentionCopies: 3,
        directory: backupDir,
      });

    expect(scheduleResponse.status).toBe(200);
    expect(scheduleResponse.body).toMatchObject({
      ok: true,
      config: {
        cron: '15 2 * * *',
        retentionCopies: 3,
        directory: backupDir,
      },
      summary: {
        schedule: {
          cron: '15 2 * * *',
          retentionCopies: 3,
          directory: backupDir,
        },
      },
    });
  });

  it('restores a selected backup file and resets the auth store handle', async () => {
    const { app, authStore, backupDir, dbFile } = await createApp();
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(path.join(backupDir, 'storage-restore.sqlite'), 'restored-db');
    await fs.writeFile(dbFile, 'live-db');

    const scheduleResponse = await request(app)
      .post('/api/v4/backups/schedule')
      .set('Cookie', 'kpi_session=admin-token')
      .send({
        cron: '0 3 * * *',
        directory: backupDir,
      });
    expect(scheduleResponse.status).toBe(200);

    const restoreResponse = await request(app)
      .post('/api/v4/backups/restore')
      .set('Cookie', 'kpi_session=admin-token')
      .send({
        filename: 'storage-restore.sqlite',
        note: 'restore smoke',
      });

    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.ok).toBe(true);
    expect(await fs.readFile(dbFile, 'utf8')).toBe('restored-db');
    expect(authStore.resetMock).toHaveBeenCalled();
  });
});
