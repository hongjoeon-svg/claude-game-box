// vite build 결과(dist/)를 CSS·JS 를 인라인한 HTML 한 장으로 합쳐
// 저장소 루트의 meeting-seats.html 로 내보낸다 (GitHub Pages 게임 모음용).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?([^"]+)"[^>]*>/g, (_, href) => {
  const css = readFileSync(join(dist, href), 'utf8');
  return `<style>${css}</style>`;
});
html = html.replace(/<script type="module" crossorigin src="\.?\/?([^"]+)"><\/script>/g, (_, src) => {
  const js = readFileSync(join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
if (/(href|src)="\.?\/?assets\//.test(html)) throw new Error('인라인되지 않은 asset 참조가 남아 있음');

const PUBLIC = 'https://hongjoeon-svg.github.io/claude-game-box/meeting-seats.html';
html = html.replace(
  '<title>',
  `<meta name="description" content="사이 나쁜 동료들, 붙여 앉히면 큰일 나요. 줄마다·부서마다 한 명씩 앉히는 로직 퍼즐">
    <meta property="og:type" content="website">
    <meta property="og:title" content="회의실 자리 배치">
    <meta property="og:description" content="사이 나쁜 동료들, 붙여 앉히면 큰일 나요. 하루 하나 오늘의 퍼즐 + 200 레벨">
    <meta property="og:url" content="${PUBLIC}">
    <title>`,
);

const out = resolve(root, '..', 'meeting-seats.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KB)`);
