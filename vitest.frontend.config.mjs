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
        'tests/check-server.test.mjs',
        'tests/e2e.*.test.jsx',
        'tests/automation.flows.test.js',
        '.codex_tmp/**',
      ],
      environment: 'jsdom',
      environmentMatchGlobs: [],
      setupFiles: ['./vitest.setup.js'],
    },
  })
);
