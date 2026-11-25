// vite build 결과(dist/)를 HTML 한 파일로 합쳐 게임 모음집 루트에 last-train.html 로 내보낸다.
// (모음집의 다른 게임들처럼 파일 하나만 올리면 되도록)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = resolve(root, '..', 'last-train.html');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/g, (_, p) => {
  const js = readFileSync(join(dist, p), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/g, (_, p) => `<style>${readFileSync(join(dist, p), 'utf8')}</style>`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('인라인되지 않은 에셋이 남아 있습니다');
writeFileSync(out, html);
console.log(`→ ${out} (${(html.length / 1024).toFixed(0)} KB)`);
