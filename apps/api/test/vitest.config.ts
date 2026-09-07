import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'domainpulse-api',
    environment: 'node',
    include: ['test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
