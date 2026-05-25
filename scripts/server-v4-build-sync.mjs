import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CANARY_FILES = Object.freeze([
  'index.js',
  path.join('app', 'build-v4-app.js'),
  path.join('app', 'shared-sync', 'sharedSyncRoutes.js'),
]);

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getNewestModifiedTime(rootDir) {
  let newest = 0;

  async function visit(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const stat = await fs.stat(absolutePath);
      newest = Math.max(newest, stat.mtimeMs);
    }
  }

  if (!(await pathExists(rootDir))) {
    return 0;
  }

  await visit(rootDir);
  return newest;
}

export async function getServerV4BuildStatus({
  projectRoot,
  sourceDir = path.join('server-v4', 'src'),
  distDir = path.join('dist', 'server-v4'),
  canaryFiles = DEFAULT_CANARY_FILES,
} = {}) {
  const resolvedProjectRoot = path.resolve(projectRoot ?? process.cwd());
  const resolvedSourceDir = path.resolve(resolvedProjectRoot, sourceDir);
  const resolvedDistDir = path.resolve(resolvedProjectRoot, distDir);
  const missingFiles = [];

  for (const relativeFile of canaryFiles) {
    const absoluteFile = path.join(resolvedDistDir, relativeFile);
    if (!(await pathExists(absoluteFile))) {
      missingFiles.push(relativeFile);
    }
  }

  if (missingFiles.length > 0) {
    return {
      stale: true,
      reason: 'missing_canary',
      projectRoot: resolvedProjectRoot,
      sourceDir: resolvedSourceDir,
      distDir: resolvedDistDir,
      missingFiles,
      sourceMtimeMs: 0,
      distMtimeMs: 0,
    };
  }

  const [sourceMtimeMs, distMtimeMs] = await Promise.all([
    getNewestModifiedTime(resolvedSourceDir),
    getNewestModifiedTime(resolvedDistDir),
  ]);

  return {
    stale: sourceMtimeMs > distMtimeMs,
    reason: sourceMtimeMs > distMtimeMs ? 'source_newer_than_dist' : 'up_to_date',
    projectRoot: resolvedProjectRoot,
    sourceDir: resolvedSourceDir,
    distDir: resolvedDistDir,
    missingFiles,
    sourceMtimeMs,
    distMtimeMs,
  };
}

function describeBuildReason(status) {
  if (status.reason === 'missing_canary') {
    return `do dist/server-v4 thiếu ${status.missingFiles.join(', ')}`;
  }
  if (status.reason === 'source_newer_than_dist') {
    return 'do mã nguồn server-v4 mới hơn bản compiled hiện tại';
  }
  return 'để đồng bộ runtime server-v4';
}

export async function ensureServerV4BuildSynced({
  projectRoot,
  skip = false,
  logger = console,
  build = async () => {},
} = {}) {
  if (skip) {
    return { rebuilt: false, skipped: true, status: null };
  }

  const status = await getServerV4BuildStatus({ projectRoot });
  if (!status.stale) {
    return { rebuilt: false, skipped: false, status };
  }

  logger.log(`Đang chạy "pnpm build:server-v4" ${describeBuildReason(status)}...`);
  await build(status);
  return { rebuilt: true, skipped: false, status };
}
