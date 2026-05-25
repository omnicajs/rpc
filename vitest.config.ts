import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    dangerouslyIgnoreUnhandledErrors: true,
    include: ['src/tests/**/*.spec.ts'],
  },
});
