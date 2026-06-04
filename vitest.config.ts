import path from 'node:path'

import {defineConfig} from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~tests': path.resolve(__dirname, './tests'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    dangerouslyIgnoreUnhandledErrors: true,
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary', 'json'],
      reportOnFailure: true,
      include: ['src/**/*.ts'],
      exclude: ['tests/**', 'src/**/*.d.ts'],
    },
  },
})
