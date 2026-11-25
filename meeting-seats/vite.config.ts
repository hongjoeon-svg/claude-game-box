import { defineConfig } from 'vite';

export default defineConfig({
  // Capacitor 는 앱 안에서 파일 경로로 불러오므로 상대 경로로 빌드
  base: './',
  build: { target: 'es2019', outDir: 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
});
