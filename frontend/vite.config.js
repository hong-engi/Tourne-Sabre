import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  envPrefix: 'REACT_APP_GAME_SERVER',
  oxc: { jsx: { runtime: 'automatic' } },
  build: { outDir: 'build' },
  server: {
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
})
