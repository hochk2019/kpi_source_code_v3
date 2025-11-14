import { defineConfig } from '@playwright/test';

const PORT = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? '4173', 10);
const HOST = process.env.PLAYWRIGHT_HOST ?? '0.0.0.0';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

const EDGE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0';

export default defineConfig({
  testDir: 'tests/playwright',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        browserName: 'chromium',
        channel: process.env.PLAYWRIGHT_CHROME_CHANNEL ?? 'chromium',
        userAgent: CHROME_USER_AGENT,
      },
    },
    {
      name: 'edge',
      use: {
        browserName: 'chromium',
        userAgent: EDGE_USER_AGENT,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: `pnpm preview --host ${HOST} --port ${PORT}`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 120_000,
      },
});
