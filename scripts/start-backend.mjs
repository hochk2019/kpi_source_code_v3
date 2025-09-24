#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function ensureBetterSqlite3({ autoRebuild = false } = {}) {
  try {
    await import('better-sqlite3');
    return;
  } catch (err) {
    console.error('Không thể tải thư viện better-sqlite3.', err.message);
    if (!autoRebuild) {
      console.error('\nHãy chạy: pnpm rebuild better-sqlite3');
      console.error('Hoặc chạy lại script này với tham số --rebuild để tự động biên dịch.');
      throw err;
    }
  }

  console.log('Đang chạy "pnpm rebuild better-sqlite3"...');
  await run('pnpm', ['rebuild', 'better-sqlite3']);
  try {
    await import('better-sqlite3');
    console.log('better-sqlite3 đã sẵn sàng.');
  } catch (err) {
    console.error('Vẫn không thể nạp better-sqlite3 sau khi rebuild.');
    throw err;
  }
}

async function startServer() {
  const args = process.argv.slice(2);
  const autoRebuild = args.includes('--rebuild');
  await ensureBetterSqlite3({ autoRebuild });

  const serverEntry = resolve(__dirname, '..', 'server', 'index.js');
  console.log('Khởi động backend từ', serverEntry);
  const child = spawn(process.execPath, [serverEntry], { stdio: 'inherit' });

  const exitCode = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', (err) => {
      console.error('Lỗi khi chạy backend:', err.message);
      resolve(1);
    });
  });

  process.exit(exitCode);
}

startServer().catch((err) => {
  console.error('Không thể khởi động backend:', err.message);
  process.exit(1);
});
