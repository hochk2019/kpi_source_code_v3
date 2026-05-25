import { mergeConfig } from 'vite';
import baseConfig from './vite.config.js';
import { defineConfig } from 'vitest/config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.test.jsx', 'tests/**/*.test.js', 'tests/**/*.test.tsx'],
      exclude: [
        'tests/server.*.test.js',
        'tests/server-v4/**',
        'tests/scripts/**',
        'tests/check-server.test.mjs',
        'tests/checkServerRetirement.test.js',
        'tests/e2e.*.test.jsx',
        'tests/automation.flows.test.js',
        'tests/apps*.test.js',
        'tests/backendEntrypointPlan.test.js',
        'tests/bootstrapAccountPasswords.test.js',
        'tests/businessSnapshotSqlite.test.js',
        '.codex_tmp/**',
      ],
      environment: 'jsdom',
      environmentMatchGlobs: [],
      setupFiles: ['./vitest.setup.js'],
    },
  })
);
