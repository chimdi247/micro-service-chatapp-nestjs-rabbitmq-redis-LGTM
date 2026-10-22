import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests import the shared package and service validation straight from
// source (no build needed). Requires `pnpm install` at the repo root.
export default defineConfig({
  resolve: {
    alias: {
      '@chatapp/common': fileURLToPath(new URL('../packages/common/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['unit/**/*.test.ts'],
    environment: 'node',
    globals: true,
    coverage: { provider: 'v8', include: ['../packages/common/src/**'] },
  },
});
