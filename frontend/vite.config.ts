import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '.')
const bundledToolkitsDir = resolve(__dirname, '../toolkits/bundled')

const devApiTarget = process.env.VITE_DEV_API_PROXY ?? process.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: [projectRoot, bundledToolkitsDir],
    },
    proxy: {
      '/auth': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    preserveSymlinks: true,
  },
})
