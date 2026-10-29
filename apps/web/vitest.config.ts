import path from 'path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
  test: {
    // Deployment tests use node:test and run in a separate workflow step.
    exclude: [...configDefaults.exclude, 'deploy/**'],
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
