import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '.')
const toolkitsDir = resolve(__dirname, '../toolkits')
const storageDir = resolve(__dirname, '../data/toolkits')

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: [projectRoot, toolkitsDir, storageDir],
    },
  },
  resolve: {
    preserveSymlinks: true,
  },
})
