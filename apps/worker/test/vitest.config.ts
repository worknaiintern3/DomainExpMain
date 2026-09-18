import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 10_000,
    include: ['test/**/*.spec.ts'],
    name: 'domainpulse-worker',
    testTimeout: 10_000,
  },
});
