#!/usr/bin/env node
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
    const { command, args } = resolvePnpmCommand();
    await run(command, [...args, 'rebuild', 'better-sqlite3']);
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

function normalizeListenHost(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return '0.0.0.0';
  }
  return trimmed;
}

function isWildcardHost(host) {
  return !host || host === '0.0.0.0' || host === '::';
}

function formatHostForDisplay(host) {
  return isWildcardHost(host) ? 'localhost' : host;
}

function formatHostForUrl(host) {
  if (!host) {
    return '';
  }
  return host.includes(':') && !host.startsWith('[') ? '[' + host + ']' : host;
}

async function isServerAlreadyRunning({ host, port, timeoutMs = 1500 }) {
  if (typeof fetch !== 'function') {
    return false;
  }
  const probeHost = isWildcardHost(host) ? '127.0.0.1' : host;
  const targetHost = formatHostForUrl(probeHost);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch('http://' + targetHost + ':' + port + '/api/health', {
      signal: controller?.signal,
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json().catch(() => null);
    return payload?.ok === true;
  } catch {
    return false;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function isPortBusy(host, port) {
  return await new Promise((resolve) => {
    const tester = net.createServer();
    tester.unref();
    tester.once('error', (err) => {
      try {
        tester.close();
      } catch (closeErr) {
        // ignore close errors
      }
      if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    tester.once('listening', () => {
      tester.close(() => resolve(false));
    });
    const listenHost = isWildcardHost(host) ? undefined : host;
    try {
      tester.listen(port, listenHost);
    } catch (err) {
      if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
        resolve(true);
      } else {
        resolve(false);
      }
    }
  });
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

  const listenHost = normalizeListenHost(process.env.KPI_LISTEN_HOST);
  const port = Number.parseInt(process.env.PORT || '5000', 10);
  process.env.KPI_LISTEN_HOST = listenHost;
  process.env.PORT = String(port);

  if (await isServerAlreadyRunning({ host: listenHost, port })) {
    const displayHost = formatHostForDisplay(listenHost);
    console.log('Backend da chay san tai http://' + displayHost + ':' + port + ', bo qua khoi dong.');
    return;
  }

  if (await isPortBusy(listenHost, port)) {
    const displayHost = formatHostForDisplay(listenHost);
    console.error('Khong the khoi dong backend: port ' + port + ' tren ' + displayHost + ' dang duoc su dung.');
    console.error('Neu backend dang duoc chay o tien trinh khac, hay dung tien trinh do hoac doi PORT/KPI_LISTEN_HOST.');
    process.exit(1);
  }

  await ensureBetterSqlite3({ forceRebuild });

  const serverEntry = resolve(__dirname, '..', 'server', 'index.js');
  if (!existsSync(serverEntry)) {
    console.error('Khong tim thay file backend:', serverEntry);
    console.error('Vui long kiem tra cac buoc sau:');
    console.error('- Dam bao ban da giai nen day du ma nguon hoac da clone repo dung cach (git clone).');
    console.error('- Chay "pnpm install" de cai dat dependencies can thiet.');
    console.error('- Neu van gap loi, hay kiem tra lai duong dan va quyen truy cap file.');
    process.exit(1);
  }
  console.log('Khoi dong backend tu', serverEntry);
  const childEnv = { ...process.env };
  const childArgs = [serverEntry, ...passthrough];
  const child = spawn(process.execPath, childArgs, { stdio: 'inherit', env: childEnv });

  const exitCode = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', (err) => {
      console.error('Loi khi chay backend:', err.message);
      resolve(1);
    });
  });

  process.exit(exitCode);
}


startServer().catch((err) => {
  console.error('Không thể khởi động backend:', err.message);
  process.exit(1);
});
