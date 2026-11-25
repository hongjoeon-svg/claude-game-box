import { defineConfig } from 'vite';

// base: './' — Capacitor(iOS)는 파일을 상대 경로로 불러오므로 꼭 필요합니다.
export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
});
