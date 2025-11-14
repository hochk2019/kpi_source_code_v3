import { defineConfig } from 'vite'

import react from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import path from 'path'

import { fileURLToPath } from 'node:url'

import process from 'node:process'



const __dirname = fileURLToPath(new URL('.', import.meta.url))



// https://vite.dev/config/

export default defineConfig({

  server: {

    host: true,

    proxy: {

      '/api': {

        target: process.env.VITE_API_BASE || 'http://localhost:5000',

        changeOrigin: true,

      },

    },

  },

  plugins: [react(), tailwindcss()],

  resolve: {

    alias: {

      "@": path.resolve(__dirname, "./src"),

    },

  },

  build: {

    rollupOptions: {

      output: {

        manualChunks(id) {

          if (id.includes('node_modules')) {

            if (id.includes('react-dom') || id.includes('scheduler')) {

              return 'vendor-react-dom';

            }

            if (id.includes('/react/')) {

              return 'vendor-react';

            }

            if (id.includes('@radix-ui')) {

              return 'vendor-radix';

            }

            if (id.includes('recharts')) {

              return 'vendor-charts';

            }

            if (id.includes('date-fns')) {

              return 'vendor-date';

            }

            if (id.includes('xlsx')) {

              return 'vendor-xlsx';

            }

          }

          return undefined;

        },

      },

    },

    chunkSizeWarningLimit: 1024,

  },

  test: {

    environment: 'jsdom',

    setupFiles: './vitest.setup.js',

    environmentMatchGlobs: [

      ['tests/server.*.test.js', 'node'],

    ],

    exclude: ['tests/playwright/**', 'node_modules/**', 'dist/**'],

  },

})

