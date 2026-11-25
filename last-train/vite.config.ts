import { defineConfig } from 'vite';

// base './' : Capacitor(iOS)에서 file/capacitor 스킴으로 열어도 에셋 경로가 깨지지 않게 상대 경로로 빌드
export default defineConfig({
  base: './',
  server: { host: false, port: 5173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});
