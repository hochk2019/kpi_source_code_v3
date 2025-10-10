import { mergeConfig } from 'vite';
import baseConfig from './vite.config.js';
import { defineConfig } from 'vitest/config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.test.jsx', 'tests/**/*.test.js', 'tests/**/*.test.tsx'],
      environment: 'jsdom',
      environmentMatchGlobs: [],
      setupFiles: ['./vitest.setup.js'],
    },
  })
);
