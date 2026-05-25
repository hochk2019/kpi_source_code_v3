import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ensureServerV4BuildSynced,
  getServerV4BuildStatus,
} from '../scripts/server-v4-build-sync.mjs';

const tempDirs = [];

async function makeProjectRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-server-v4-build-sync-'));
  tempDirs.push(root);
  return root;
}

async function writeFile(filePath, content, mtime = null) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  if (mtime !== null) {
    const timestamp = new Date(mtime);
    await fs.utimes(filePath, timestamp, timestamp);
  }
}

describe('server-v4 build sync', () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) =>
        fs.rm(dir, {
          recursive: true,
          force: true,
        }),
      ),
    );
  });

  it('marks the build stale when shared-sync canary output is missing', async () => {
    const projectRoot = await makeProjectRoot();
    await writeFile(path.join(projectRoot, 'dist', 'server-v4', 'index.js'), 'export {};\n');
    await writeFile(
      path.join(projectRoot, 'dist', 'server-v4', 'app', 'build-v4-app.js'),
      'export {};\n',
    );

    const status = await getServerV4BuildStatus({ projectRoot });
    expect(status.stale).toBe(true);
    expect(status.reason).toBe('missing_canary');
    expect(status.missingFiles).toContain(path.join('app', 'shared-sync', 'sharedSyncRoutes.js'));
  });

  it('marks the build stale when source files are newer than dist', async () => {
    const projectRoot = await makeProjectRoot();
    await writeFile(
      path.join(projectRoot, 'server-v4', 'src', 'app', 'build-v4-app.ts'),
      'export const marker = true;\n',
      2_000,
    );
    await writeFile(path.join(projectRoot, 'dist', 'server-v4', 'index.js'), 'export {};\n', 1_000);
    await writeFile(
      path.join(projectRoot, 'dist', 'server-v4', 'app', 'build-v4-app.js'),
      'export {};\n',
      1_000,
    );
    await writeFile(
      path.join(projectRoot, 'dist', 'server-v4', 'app', 'shared-sync', 'sharedSyncRoutes.js'),
      'export {};\n',
      1_000,
    );

    const status = await getServerV4BuildStatus({ projectRoot });
    expect(status.stale).toBe(true);
    expect(status.reason).toBe('source_newer_than_dist');
    expect(status.sourceMtimeMs).toBeGreaterThan(status.distMtimeMs);
  });

  it('skips rebuilding when dist is already current', async () => {
    const projectRoot = await makeProjectRoot();
    await writeFile(
      path.join(projectRoot, 'server-v4', 'src', 'app', 'build-v4-app.ts'),
      'export const marker = true;\n',
      1_000,
    );
    await writeFile(path.join(projectRoot, 'dist', 'server-v4', 'index.js'), 'export {};\n', 2_000);
    await writeFile(
      path.join(projectRoot, 'dist', 'server-v4', 'app', 'build-v4-app.js'),
      'export {};\n',
      2_000,
    );
    await writeFile(
      path.join(projectRoot, 'dist', 'server-v4', 'app', 'shared-sync', 'sharedSyncRoutes.js'),
      'export {};\n',
      2_000,
    );

    const build = vi.fn(async () => {});
    const result = await ensureServerV4BuildSynced({ projectRoot, build });

    expect(result.rebuilt).toBe(false);
    expect(build).not.toHaveBeenCalled();
  });

  it('triggers a rebuild when the runtime is stale', async () => {
    const projectRoot = await makeProjectRoot();
    await writeFile(
      path.join(projectRoot, 'server-v4', 'src', 'app', 'build-v4-app.ts'),
      'export const marker = true;\n',
      2_000,
    );
    await writeFile(path.join(projectRoot, 'dist', 'server-v4', 'index.js'), 'export {};\n', 1_000);
    await writeFile(
      path.join(projectRoot, 'dist', 'server-v4', 'app', 'build-v4-app.js'),
      'export {};\n',
      1_000,
    );
    await writeFile(
      path.join(projectRoot, 'dist', 'server-v4', 'app', 'shared-sync', 'sharedSyncRoutes.js'),
      'export {};\n',
      1_000,
    );

    const build = vi.fn(async () => {});
    const logger = { log: vi.fn() };
    const result = await ensureServerV4BuildSynced({ projectRoot, build, logger });

    expect(result.rebuilt).toBe(true);
    expect(build).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('pnpm build:server-v4'),
    );
  });
});
