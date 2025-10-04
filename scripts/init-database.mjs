#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

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

async function main() {
  process.env.KPI_SKIP_LISTEN = process.env.KPI_SKIP_LISTEN || '1';

  await ensureBetterSqlite3();

  const start = Date.now();
  const module = await import('../server/index.js');
  const { DB_FILE, initializeDatabase } = module;

  if (!DB_FILE) {
    console.error('Không xác định được đường dẫn cơ sở dữ liệu.');
    process.exitCode = 1;
    return;
  }

  const database = await initializeDatabase({ dbFile: DB_FILE });
  database.close?.();

  let stats = null;
  try {
    stats = await fs.stat(DB_FILE);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      throw err;
    }
  }

  const prettyPath = path.relative(process.cwd(), DB_FILE);
  if (stats) {
    const sizeKb = (stats.size / 1024).toFixed(1);
    console.log(`Đã sẵn sàng cơ sở dữ liệu SQLite tại ${prettyPath} (${sizeKb} KB, tạo trong ${Date.now() - start}ms).`);
  } else {
    console.warn(`Không thể tạo file SQLite tại ${prettyPath}. Kiểm tra quyền ghi và thử lại.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Khởi tạo cơ sở dữ liệu thất bại:', err);
  process.exitCode = 1;
});
