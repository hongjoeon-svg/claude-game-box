import { defineConfig } from 'vitest/config';

// base: './' — 나중에 Capacitor(iOS)가 파일을 상대 경로로 불러오므로 필요합니다.
export default defineConfig({
  base: './',
  server: { host: true },
  build: { outDir: 'dist' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
