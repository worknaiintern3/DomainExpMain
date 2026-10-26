import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // Cast bridges a pre-existing duplicate-install artifact: @vitejs/plugin-react
    // resolves vite types from the repo root copy while this workspace builds
    // with its local vite copy. Runtime is unaffected (workspace-local binary).
    plugins: [react() as unknown as Plugin],
    resolve: {
      alias: {
        '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      // Development only: forward same-origin /api calls to the selected backend.
      // This avoids browser CORS requirements while the site runs on localhost.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || process.env.VITE_API_TARGET || 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
        },
        '/whoisfreaks-api': {
          target: 'https://api.whoisfreaks.com',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/whoisfreaks-api/, ''),
          secure: true,
        },
      },
    },
  };
});
