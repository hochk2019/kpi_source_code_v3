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

async function ensureBetterSqlite3({ forceRebuild = false } = {}) {
  let rebuildAttempted = false;

  async function rebuild(reason) {
    const label = reason === 'force' ? 'theo yêu cầu (--rebuild)' : 'tự động do thiếu native binding';
    console.log(`Đang chạy "pnpm rebuild better-sqlite3" ${label}...`);
    await run('pnpm', ['rebuild', 'better-sqlite3']);
    rebuildAttempted = true;
  }

  if (forceRebuild) {
    await rebuild('force');
  }

  while (true) {
    try {
      await import('better-sqlite3');
      if (rebuildAttempted || forceRebuild) {
        console.log('better-sqlite3 đã sẵn sàng.');
      }
      return;
    } catch (err) {
      if (rebuildAttempted) {
        console.error('Vẫn không thể nạp better-sqlite3 sau khi thử rebuild.');
        console.error('Hãy chạy "pnpm rebuild better-sqlite3" thủ công hoặc chuẩn bị binary phù hợp cho môi trường hiện tại.');
        throw err;
      }

      try {
        await rebuild('auto');
      } catch (rebuildError) {
        console.error('Rebuild better-sqlite3 thất bại:', rebuildError.message);
        console.error('Vui lòng chạy lại "pnpm rebuild better-sqlite3" hoặc kiểm tra toolchain C++/Python của hệ thống.');
        throw rebuildError;
      }
    }
  }
}

async function startServer() {
  const args = process.argv.slice(2);
  const forceRebuild = args.includes('--rebuild');
  await ensureBetterSqlite3({ forceRebuild });

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
