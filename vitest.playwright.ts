import path from 'node:path';

import {playwright} from '@vitest/browser-playwright';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~tests': path.resolve(__dirname, './tests'),
    },
  },
  test: {
    include: ['tests/e2e/**/*.e2e.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['json'],
      reportsDirectory: 'coverage/playwright',
      include: ['src/**/*.ts'],
      exclude: ['tests/**', 'src/**/*.d.ts'],
    },
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotDirectory: path.resolve(__dirname, 'artifacts/__screenshots__'),
      instances: process.argv.includes('--coverage')
        ? [{browser: 'chromium'}]
        : [{browser: 'chromium'}, {browser: 'firefox'}],
    },
  },
});
