import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'domainpulse-database',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
