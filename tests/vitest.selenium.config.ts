import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['selenium/**/*.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 90_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
