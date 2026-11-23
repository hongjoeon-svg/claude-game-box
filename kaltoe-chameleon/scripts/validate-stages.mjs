// 스테이지 JSON 검사기: npm run validate
// - 지도 크기(15x20), 허용 문자, 시작점/출구, 시작→출구 도달 가능 여부
// - 순찰 경로 웨이포인트와 구간이 벽·가구를 지나지 않는지
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/data/stages');
const COLS = 15;
const ROWS = 20;
const SOLID = new Set(['#', 'd', 't', 'c']);
const ALLOWED = new Set(['#', '.', 'o', 'k', 'm', 'd', 't', 'c', 'E', 'P']);
const PROPS = new Set(['plant', 'copier', 'water', 'box', 'chair']);

let errors = 0;
const ids = new Set();
const fail = (file, msg) => {
  errors++;
  console.error(`❌ ${file}: ${msg}`);
};

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  let s;
  try {
    s = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  } catch (e) {
    fail(file, `JSON 파싱 실패 - ${e.message}`);
    continue;
  }
  if (typeof s.id !== 'number') fail(file, 'id(숫자)가 없습니다');
  if (ids.has(s.id)) fail(file, `id ${s.id} 가 중복됩니다`);
  ids.add(s.id);
  if (!s.name) fail(file, 'name이 없습니다');
  if (!(s.timeLimitSec > 0)) fail(file, 'timeLimitSec 은 0보다 커야 합니다');
  if (!(s.fastClearSec > 0 && s.fastClearSec < s.timeLimitSec)) fail(file, 'fastClearSec 은 0 < fastClearSec < timeLimitSec');
  if (!['easy', 'normal', 'strict'].includes(s.strictness)) fail(file, 'strictness 는 easy|normal|strict');
  if (!Array.isArray(s.props) || s.props.length < 3 || s.props.length > 5) fail(file, 'props 는 3~5개');
  for (const p of s.props ?? []) if (!PROPS.has(p)) fail(file, `알 수 없는 소품 '${p}'`);

  const map = s.map ?? [];
  if (map.length !== ROWS) fail(file, `map 은 ${ROWS}줄이어야 합니다 (현재 ${map.length})`);
  map.forEach((row, y) => {
    if (row.length !== COLS) fail(file, `map ${y}번째 줄 길이 ${row.length} (≠ ${COLS})`);
    [...row].forEach((ch, x) => {
      if (!ALLOWED.has(ch)) fail(file, `map (${x},${y}) 알 수 없는 문자 '${ch}'`);
    });
  });
  const at = (x, y) => (y < 0 || y >= map.length || x < 0 || x >= (map[y]?.length ?? 0) ? '#' : map[y][x]);
  const walkable = (x, y) => !SOLID.has(at(x, y));

  const starts = [];
  const exits = [];
  map.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === 'P') starts.push([x, y]);
    if (ch === 'E') exits.push([x, y]);
  }));
  if (starts.length !== 1) fail(file, `시작점 P 는 정확히 1개 (현재 ${starts.length})`);
  if (exits.length < 1) fail(file, '출구 E 가 없습니다');

  if (starts.length === 1 && exits.length) {
    const seen = new Set([starts[0].join(',')]);
    const q = [starts[0]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (!seen.has(k) && walkable(x + dx, y + dy)) {
          seen.add(k);
          q.push([x + dx, y + dy]);
        }
      }
    }
    if (!exits.some((e) => seen.has(e.join(',')))) fail(file, '시작점에서 출구까지 갈 수 없습니다');
  }

  (s.patrollers ?? []).forEach((p, i) => {
    const tag = `patrollers[${i}]`;
    if (!['boss', 'manager'].includes(p.type)) fail(file, `${tag}.type 은 boss|manager`);
    if (!(p.speed > 0 && p.fovDeg > 0 && p.viewDist > 0)) fail(file, `${tag} speed/fovDeg/viewDist 확인`);
    const path = p.path ?? [];
    if (path.length < 1) fail(file, `${tag}.path 가 비어 있습니다`);
    path.forEach(([x, y]) => {
      if (!walkable(x, y)) fail(file, `${tag} 웨이포인트 (${x},${y}) 가 벽/가구 위입니다`);
    });
    const segs = [];
    for (let j = 0; j < path.length - 1; j++) segs.push([path[j], path[j + 1]]);
    if ((p.mode ?? 'loop') === 'loop' && path.length > 2) segs.push([path[path.length - 1], path[0]]);
    for (const [[x1, y1], [x2, y2]] of segs) {
      const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 4;
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x1 + ((x2 - x1) * k) / Math.max(n, 1));
        const y = Math.round(y1 + ((y2 - y1) * k) / Math.max(n, 1));
        if (!walkable(x, y)) {
          fail(file, `${tag} 경로 (${x1},${y1})→(${x2},${y2}) 가 (${x},${y}) 벽/가구를 지납니다`);
          break;
        }
      }
    }
  });
  console.log(`✔ ${file} (id ${s.id}) 검사 완료`);
}

if (errors) {
  console.error(`\n스테이지 오류 ${errors}개`);
  process.exit(1);
}
console.log('\n모든 스테이지 OK');
