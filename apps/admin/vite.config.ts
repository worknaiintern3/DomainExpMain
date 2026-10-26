import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react() as unknown as Plugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'https://app.domainexprt.com',
        changeOrigin: true,
        secure: true,
      },
    } as Record<string, any>,
  },
});
