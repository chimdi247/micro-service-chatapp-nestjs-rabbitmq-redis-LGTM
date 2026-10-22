import { defineConfig } from 'vitest/config';

// Integration tests talk to the running docker compose stack over HTTP.
export default defineConfig({
  test: {
    include: ['integration/**/*.test.ts'],
    environment: 'node',
    globals: true,
    globalSetup: ['integration/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
