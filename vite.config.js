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
        target: process.env.VITE_API_BASE || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(),tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
  },
})
