import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
const frontendRoot = resolve(repoRoot, 'frontend')
const nodeModules = resolve(frontendRoot, 'node_modules')

const frontendRequire = createRequire(resolve(frontendRoot, 'package.json'))
const { defineConfig } = frontendRequire('vitest/config')
const reactPlugin = frontendRequire('@vitejs/plugin-react')
const react = reactPlugin.default ?? reactPlugin

export default defineConfig({
  root: repoRoot,
  plugins: [react()],
  resolve: {
    alias: {
      react: resolve(nodeModules, 'react'),
      'react-dom': resolve(nodeModules, 'react-dom'),
      'react-dom/client': resolve(nodeModules, 'react-dom/client'),
      'react-dom/test-utils': resolve(nodeModules, 'react-dom/test-utils'),
    },
  },
  test: {
    environment: 'node',
    include: ['toolkits/api_checker/frontend/__tests__/**/*.test.ts'],
  },
})
