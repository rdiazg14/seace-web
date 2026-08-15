import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function spaFallback404() {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
        const index = resolve(import.meta.dirname, 'dist/index.html')
        const dest = resolve(import.meta.dirname, 'dist/404.html')
      if (existsSync(index)) copyFileSync(index, dest)
    },
  }
}

export default defineConfig({
  plugins: [react(), spaFallback404()],
  base: '/',
})
