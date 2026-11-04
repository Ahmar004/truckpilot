/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// The production CSP from vercel.json, sent by `vite preview` so e2e runs the built files under the
// same policy Vercel serves (Step-14: the missing map worker only showed in the build).
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const CSP: string = vercel.headers[0].headers.find(
  (h: { key: string }) => h.key === 'Content-Security-Policy',
).value

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One .env.local at the repo root; only VITE_ variables reach the browser.
  envDir: '..',
  server: {
    // Plain `npm run dev`: send /api to Django's runserver so the browser sees one address.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  preview: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
    headers: { 'Content-Security-Policy': CSP },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
