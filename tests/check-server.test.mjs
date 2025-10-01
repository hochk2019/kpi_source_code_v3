import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  ensureRequiredEnvVariables,
  loadEnvCascade,
} from '../scripts/check-server.mjs';

function createTempDir() {
  return mkdtempSync(join(tmpdir(), 'check-server-'));
}

describe('loadEnvCascade', () => {
  let cwd;

  beforeEach(() => {
    cwd = createTempDir();
  });

  afterEach(() => {
    if (cwd) {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('ghi đè giá trị từ .env.local lên .env', () => {
    writeFileSync(join(cwd, '.env'), 'VITE_API_BASE=http://base\n');
    writeFileSync(join(cwd, '.env.local'), 'VITE_API_BASE=http://local\n');

    const cascade = loadEnvCascade({
      cwd,
      candidates: ['.env', '.env.local'],
    });

    expect(cascade.filesRead.map((file) => file.relative)).toEqual([
      '.env',
      '.env.local',
    ]);
    expect(cascade.merged.VITE_API_BASE).toBe('http://local');
    expect(cascade.origins.VITE_API_BASE.file).toBe('.env.local');
  });

  it('ghi đè giá trị từ .env.production', () => {
    writeFileSync(join(cwd, '.env'), 'VITE_API_BASE=http://base\n');
    writeFileSync(join(cwd, '.env.production'), 'VITE_API_BASE=https://prod\n');

    const cascade = loadEnvCascade({
      cwd,
      candidates: ['.env', '.env.production'],
    });

    expect(cascade.filesRead.map((file) => file.relative)).toEqual([
      '.env',
      '.env.production',
    ]);
    expect(cascade.merged.VITE_API_BASE).toBe('https://prod');
    expect(cascade.origins.VITE_API_BASE.file).toBe('.env.production');
  });
});

describe('ensureRequiredEnvVariables', () => {
  let cwd;

  beforeEach(() => {
    cwd = createTempDir();
  });

  afterEach(() => {
    if (cwd) {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('gợi ý đúng file ưu tiên cao nhất khi thiếu biến', () => {
    writeFileSync(join(cwd, '.env'), 'OTHER=value\n');
    writeFileSync(join(cwd, '.env.production'), 'OTHER=value\n');

    const cascade = loadEnvCascade({
      cwd,
      candidates: ['.env', '.env.production'],
    });

    const result = ensureRequiredEnvVariables(
      [{ key: 'VITE_API_BASE', description: 'URL backend' }],
      {
        runtimeEnv: {},
        fileEnv: cascade.merged,
        origins: cascade.origins,
        filesRead: cascade.filesRead,
        candidates: ['.env', '.env.production'],
      },
    );

    expect(result.ok).toBe(false);
    expect(result.recommendedFile).toBe('.env.production');
    expect(result.fixSuggestion).toContain('.env.production');
    expect(result.suggestedFilePerVariable.VITE_API_BASE).toBe('.env.production');
    expect(result.fixSuggestion).toContain('→ Gợi ý: thêm vào .env.production');
  });

  it('ưu tiên giá trị từ biến môi trường hiện tại', () => {
    const cascade = loadEnvCascade({
      cwd,
      candidates: ['.env', '.env.production'],
    });

    const result = ensureRequiredEnvVariables(
      [{ key: 'VITE_API_BASE' }],
      {
        runtimeEnv: { VITE_API_BASE: 'http://runtime' },
        fileEnv: cascade.merged,
        origins: cascade.origins,
        filesRead: cascade.filesRead,
        candidates: ['.env', '.env.production'],
      },
    );

    expect(result.ok).toBe(true);
    const entry = result.resolved.find((item) => item.key === 'VITE_API_BASE');
    expect(entry.source).toBe('runtime');
    expect(entry.value).toBe('http://runtime');
  });

  it('khuyến nghị tạo file cơ bản khi chưa có file .env', () => {
    const cascade = loadEnvCascade({
      cwd,
      candidates: ['.env', '.env.local'],
    });

    const result = ensureRequiredEnvVariables(
      [{ key: 'VITE_API_BASE', description: 'URL backend' }],
      {
        runtimeEnv: {},
        fileEnv: cascade.merged,
        origins: cascade.origins,
        filesRead: cascade.filesRead,
        candidates: ['.env', '.env.local'],
      },
    );

    expect(result.recommendedFile).toBe('.env');
    expect(result.suggestedFilePerVariable.VITE_API_BASE).toBe('.env');
  });
});
