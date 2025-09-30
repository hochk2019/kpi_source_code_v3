#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const children = [];
let shuttingDown = false;

function run(label, command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  children.push({ label, child });
  child.on('error', (err) => {
    console.error(`[${label}] lỗi:`, err.message);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    if (code === 0 || signal === 'SIGINT') {
      shutdown(code ?? 0);
    } else {
      console.error(`[${label}] dừng với mã ${code ?? signal}`);
      shutdown(code || 1);
    }
  });
  return child;
}

function stopChild(item) {
  const { child } = item;
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    child.kill();
  } else {
    child.kill('SIGINT');
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const item of children) {
    stopChild(item);
  }
  setTimeout(() => {
    process.exit(code);
  }, 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const backendScript = resolve(__dirname, 'start-backend.mjs');
run('backend', process.execPath, [backendScript], { env: { ...process.env, KPI_SKIP_LISTEN: undefined } });
run('frontend', 'pnpm', ['exec', 'vite'], { env: { ...process.env } });

setInterval(() => {}, 1 << 30);
