#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

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

function extractFlags(argv) {
  const flags = new Set();
  const passthrough = [];
  for (const arg of argv) {
    if (arg === '--rebuild') {
      flags.add('rebuild');
      continue;
    }
    if (arg === '--prod' || arg === '--production') {
      flags.add('production');
      continue;
    }
    passthrough.push(arg);
  }
  return { flags, passthrough };
}

async function startServer() {
  const args = process.argv.slice(2);
  const { flags, passthrough } = extractFlags(args);
  const forceRebuild = flags.has('rebuild');
  const production = flags.has('production');

  if (production) {
    process.env.NODE_ENV = 'production';
  } else if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }

  await ensureBetterSqlite3({ forceRebuild });

  const serverEntry = resolve(__dirname, '..', 'server', 'index.js');
  if (!existsSync(serverEntry)) {
    console.error('Không tìm thấy file backend:', serverEntry);
    console.error('Vui lòng kiểm tra các bước sau:');
    console.error('- Đảm bảo bạn đã giải nén đầy đủ mã nguồn hoặc đã clone repo đúng cách (git clone).');
    console.error('- Chạy "pnpm install" để cài đặt dependencies cần thiết.');
    console.error('- Nếu vẫn gặp lỗi, hãy kiểm tra lại đường dẫn và quyền truy cập file.');
    process.exit(1);
  }
  console.log('Khởi động backend từ', serverEntry);
  const childEnv = { ...process.env };
  const childArgs = [serverEntry, ...passthrough];
  const child = spawn(process.execPath, childArgs, { stdio: 'inherit', env: childEnv });

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
