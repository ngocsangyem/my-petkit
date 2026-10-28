import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// `base: './'` keeps every built URL relative, so the app works wherever it is
// mounted: `/app/` today, `/` after the switch-over, or under a Home Assistant
// Ingress prefix the build cannot know.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
  server: {
    // `pnpm dev` talks to a locally running API (`my-petkit` on 8099).
    proxy: { '/api': { target: 'http://127.0.0.1:8099', ws: true, changeOrigin: false } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
