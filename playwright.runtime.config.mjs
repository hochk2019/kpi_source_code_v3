import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_RUNTIME_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: 'tests/playwright',
  testMatch: ['runtime-*.spec.js'],
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 180_000,
      },
});
