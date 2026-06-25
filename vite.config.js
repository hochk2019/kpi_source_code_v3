import { defineConfig } from 'vite'

import react from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import path from 'path'

import { fileURLToPath } from 'node:url'

import process from 'node:process'

import { manualChunks } from './src/build/chunkStrategy.js'

import { buildManifestPlugin } from './src/build/buildManifestPlugin.js'



const __dirname = fileURLToPath(new URL('.', import.meta.url))



// https://vite.dev/config/

export default defineConfig({

  server: {

    host: true,
    watch: {
      ignored: [
        '**/data/**',
        '**/*.sqlite*',
        '**/backend-log.txt'
      ]
    },

    proxy: {

      '/api': {

        target:
          process.env.VITE_API_PROXY_TARGET ||
          process.env.VITE_API_BASE ||
          'http://localhost:5000',

        changeOrigin: true,

      },

    },

  },

  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'strip-shebang',
      transform(code, _id) {
        if (code.startsWith('#!')) {
          return { code: code.replace(/^#!.*/, ''), map: null };
        }
      },
    },
    buildManifestPlugin(),
  ],

  resolve: {

    alias: {

      "@": path.resolve(__dirname, "./src"),

    },

  },

  build: {

    rollupOptions: {

      output: {

        manualChunks,

      },

    },

    chunkSizeWarningLimit: 1024,

  },

  test: {

    environment: 'jsdom',

    pool: 'forks',

    testTimeout: 15000,

    setupFiles: './vitest.setup.js',

    environmentMatchGlobs: [
      ['tests/server.*.test.js', 'node'],
      ['tests/server-v4/**', 'node'],
      ['tests/scripts/**', 'node'],
      ['tests/apps*', 'node'],
      ['tests/backendEntrypointPlan*', 'node'],
      ['tests/bootstrapAccountPasswords*', 'node'],
      ['tests/businessSnapshotSqlite*', 'node'],
      ['tests/check-server*', 'node'],
      ['tests/checkServerRetirement*', 'node'],
    ],

    exclude: ['tests/playwright/**', 'node_modules/**', 'dist/**', '.codex_tmp/**'],

  },

})

