import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Built output goes straight to pson/zulireact/ (committed; GitHub Pages serves the repo as-is).
export default defineConfig({
  base: '/pson/zulireact/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  build: { outDir: '../zulireact', emptyOutDir: true },
})
