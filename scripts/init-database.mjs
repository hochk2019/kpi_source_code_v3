import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { createRuntimeAdminContext, ensureSqliteBaseline } from './runtime-v4-admin.mjs';

const isWin = process.platform === 'win32';

function resolvePnpmCommand() {
  const execPath = process.env.npm_execpath;
  if (execPath && !isWin) {
    return { command: process.execPath, args: [execPath] };
  }
  if (isWin) {
    return { command: 'cmd.exe', args: ['/c', 'pnpm'] };
  }
  return { command: 'pnpm', args: [] };
}

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function ensureBetterSqlite3() {
  let rebuilt = false;
  while (true) {
    try {
      await import('better-sqlite3');
      if (rebuilt) {
        console.log('better-sqlite3 đã sẵn sàng.');
      }
      return;
    } catch (err) {
      if (rebuilt) {
        throw err;
      }
      console.log('Đang chạy "pnpm rebuild better-sqlite3" để chuẩn bị native binding...');
      const { command, args } = resolvePnpmCommand();
      await run(command, [...args, 'rebuild', 'better-sqlite3']);
      rebuilt = true;
    }
  }
}

export async function runInitDatabase({
  env = process.env,
  logger = console,
  ensureSqlite = ensureBetterSqlite3,
  runtimeContextFactory = createRuntimeAdminContext,
} = {}) {
  env.KPI_SKIP_LISTEN = env.KPI_SKIP_LISTEN || '1';

  await ensureSqlite();

  const start = Date.now();
  const runtimeContext = await runtimeContextFactory({ env, logger });
  const dbFile = runtimeContext?.config?.dbFile;

  try {
    if (!dbFile || dbFile === ':memory:') {
      logger.error('Không xác định được đường dẫn cơ sở dữ liệu SQLite cho runtime-v4.');
      return 1;
    }

    await ensureSqliteBaseline(runtimeContext);

    let stats = null;
    try {
      stats = await fs.stat(dbFile);
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        throw err;
      }
    }

    const prettyPath = path.relative(process.cwd(), dbFile);
    if (stats) {
      const sizeKb = (stats.size / 1024).toFixed(1);
      logger.log(
        `Đã sẵn sàng cơ sở dữ liệu SQLite tại ${prettyPath} (${sizeKb} KB, tạo trong ${Date.now() - start}ms).`,
      );
      return 0;
    }

    logger.warn(`Không thể tạo file SQLite tại ${prettyPath}. Kiểm tra quyền ghi và thử lại.`);
    return 1;
  } finally {
    await runtimeContext?.dispose?.();
  }
}

async function main() {
  const exitCode = await runInitDatabase();
  process.exitCode = exitCode;
}

function isExecutedAsScript() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isExecutedAsScript()) {
  main().catch((err) => {
    console.error('Khởi tạo cơ sở dữ liệu thất bại:', err);
    process.exitCode = 1;
  });
}
