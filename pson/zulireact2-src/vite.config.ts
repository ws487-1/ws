import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Built output goes to pson/zulireact/2/ (committed; GitHub Pages serves the repo as-is). v1 in pson/zulireact/ is untouched.
export default defineConfig({
  base: '/pson/zulireact/2/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  build: { outDir: '../zulireact/2', emptyOutDir: true },
})
