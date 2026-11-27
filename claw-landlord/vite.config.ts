import { defineConfig } from 'vite';

// base: './' — 나중에 Capacitor(iOS)로 감쌀 때 파일을 상대 경로로 불러오므로 꼭 필요합니다.
export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
