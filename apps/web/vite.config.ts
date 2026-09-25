import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Cast bridges a pre-existing duplicate-install artifact: @vitejs/plugin-react
  // resolves vite types from the repo root copy while this workspace builds
  // with its local vite copy. Runtime is unaffected (workspace-local binary).
  plugins: [react() as unknown as Plugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    // Development only: forward same-origin /api calls (used when
    // VITE_API_BASE_URL is unset and the client falls back to /api/v1)
    // to the backend's documented default dev listener (see
    // apps/api/src/config/env.schema.ts: API_HOST/API_PORT defaults).
    // Paths pass through unchanged; the backend serves /api/v1 directly.
    // String shorthand keeps this assignable without new dependencies.
    proxy: {
      '/api': 'http://127.0.0.1:4000',
      '/whoisfreaks-api': {
        target: 'https://api.whoisfreaks.com',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/whoisfreaks-api/, ''),
        secure: true,
      },
    } as Record<string, any>,
  },
});
