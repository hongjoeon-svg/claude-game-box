/**
 * 퍼즐 생성기
 *  1) 규칙을 만족하는 무작위 배치(해답)를 만든다
 *  2) 해답의 각 사람 자리를 씨앗으로 부서 구역을 무작위 성장시킨다
 *  3) 완전 탐색으로 해답이 둘 이상이면, 다른 해답의 자리 하나를 이웃 부서로 넘겨
 *     그 해답을 깨뜨린다 (구역 연결성 유지). 유일해가 될 때까지 반복
 *  4) 논리 솔버로 난이도 단계를 매기고, 목표 난이도와 맞을 때까지 다시 만든다
 */
import { grade } from './logic';
import { type Rng, randInt, shuffle } from './rng';
import { findSolutions } from './solver';
import { DIFFICULTY_TIER, type Difficulty, type Puzzle } from './types';

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function randomSolution(n: number, rng: Rng): number[] {
  const sol: number[] = [];
  const used = new Array(n).fill(false);
  const rec = (r: number): boolean => {
    if (r === n) return true;
    const order = shuffle(rng, Array.from({ length: n }, (_, i) => i));
    for (const c of order) {
      if (used[c]) continue;
      if (r > 0 && Math.abs(c - sol[r - 1]) <= 1) continue;
      used[c] = true;
      sol[r] = c;
      if (rec(r + 1)) return true;
      used[c] = false;
    }
    return false;
  };
  if (!rec(0)) throw new Error(`no arrangement for n=${n}`);
  return sol.slice(0, n);
}

/** 해답 자리에서 출발해 구역을 성장시킨다 */
export function growRegions(n: number, sol: number[], rng: Rng): number[] {
  const nn = n * n;
  const regions = new Array<number>(nn).fill(-1);
  for (let r = 0; r < n; r++) regions[r * n + sol[r]] = r;
  // 구역마다 성장 속도를 달리해서 크고 작은 부서가 섞이게 한다
  const weight = Array.from({ length: n }, () => 0.25 + rng() * rng() * 3);
  let left = nn - n;
  while (left > 0) {
    // 각 구역의 경계 후보
    const fronts: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < nn; i++) {
      if (regions[i] !== -1) continue;
      const r = Math.floor(i / n);
      const c = i % n;
      for (const [dr, dc] of DIRS) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) continue;
        const g = regions[r2 * n + c2];
        if (g !== -1) fronts[g].push(i);
      }
    }
    let total = 0;
    for (let g = 0; g < n; g++) if (fronts[g].length) total += weight[g];
    let pick = rng() * total;
    let g = 0;
    for (; g < n; g++) {
      if (!fronts[g].length) continue;
      pick -= weight[g];
      if (pick <= 0) break;
    }
    if (g >= n) g = fronts.findIndex((f) => f.length > 0);
    const f = fronts[g];
    const cell = f[randInt(rng, f.length)];
    regions[cell] = g;
    left--;
  }
  return regions;
}

/** cell 을 빼도 그 구역이 여전히 연결돼 있는지 */
function staysConnected(n: number, regions: number[], cell: number): boolean {
  const g = regions[cell];
  const cells: number[] = [];
  for (let i = 0; i < regions.length; i++) if (regions[i] === g && i !== cell) cells.push(i);
  if (cells.length === 0) return false;
  const seen = new Set<number>([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [dr, dc] of DIRS) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) continue;
      const j = r2 * n + c2;
      if (j === cell || regions[j] !== g || seen.has(j)) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  return seen.size === cells.length;
}

/**
 * 해답이 유일해질 때까지 구역 경계를 고친다. 성공하면 true.
 * 원래 해답의 자리 칸은 절대 옮기지 않으므로 원래 해답은 계속 유효하다.
 */
export function makeUnique(n: number, regions: number[], sol: number[], rng: Rng, maxIter = 200): boolean {
  const solCells = new Set(sol.map((c, r) => r * n + c));
  for (let iter = 0; iter < maxIter; iter++) {
    const sols = findSolutions(n, regions, 2);
    if (sols.length === 1) return true;
    const alt = sols.find((s) => s.some((c, r) => c !== sol[r]));
    if (!alt) return false;
    // 다른 해답의 자리 중 원래 해답과 겹치지 않는 칸들
    const targets = shuffle(
      rng,
      alt.map((c, r) => r * n + c).filter((i) => !solCells.has(i)),
    );
    let moved = false;
    for (const cell of targets) {
      if (!staysConnected(n, regions, cell)) continue;
      const r = Math.floor(cell / n);
      const c = cell % n;
      const options: number[] = [];
      for (const [dr, dc] of DIRS) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) continue;
        const g = regions[r2 * n + c2];
        if (g !== regions[cell] && !options.includes(g)) options.push(g);
      }
      if (!options.length) continue;
      regions[cell] = options[randInt(rng, options.length)];
      moved = true;
      break;
    }
    if (!moved) return false;
  }
  return findSolutions(n, regions, 2).length === 1;
}

/** 부서 번호를 위→아래, 왼→오른 순서로 처음 나오는 순서대로 다시 매긴다 (보기 좋게) */
function normalize(n: number, regions: number[], sol: number[]): Puzzle {
  const map = new Map<number, number>();
  const out = regions.map((g) => {
    if (!map.has(g)) map.set(g, map.size);
    return map.get(g)!;
  });
  return { n, regions: out, solution: sol.slice() };
}

/** 유일해 퍼즐 하나 (난이도 무관) */
export function generatePuzzle(n: number, rng: Rng): Puzzle {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const sol = randomSolution(n, rng);
    const regions = growRegions(n, sol, rng);
    if (makeUnique(n, regions, sol, rng)) return normalize(n, regions, sol);
  }
  throw new Error(`failed to generate n=${n}`);
}

export interface GeneratedPuzzle {
  puzzle: Puzzle;
  /** 논리 솔버 단계 1~3 */
  tier: number;
  difficulty: Difficulty;
  attempts: number;
}

export function tierToDifficulty(tier: number): Difficulty {
  return tier <= 1 ? 'easy' : tier === 2 ? 'medium' : 'hard';
}

/**
 * 목표 난이도에 맞는 유일해 퍼즐. 논리로 풀리지 않는(4단계) 퍼즐은 항상 버린다.
 * maxAttempts 안에 정확히 맞는 게 없으면 목표에 가장 가까운 것을 돌려준다.
 */
export function generateWithDifficulty(
  n: number,
  difficulty: Difficulty,
  rng: Rng,
  maxAttempts = 400,
): GeneratedPuzzle {
  const want = DIFFICULTY_TIER[difficulty];
  let best: { puzzle: Puzzle; tier: number } | null = null;
  for (let attempt = 1; attempt <= maxAttempts * 4; attempt++) {
    if (attempt > maxAttempts && best) break;
    const puzzle = generatePuzzle(n, rng);
    const g = grade(puzzle);
    if (!g.solved) continue;
    if (g.tier === want) return { puzzle, tier: g.tier, difficulty: tierToDifficulty(g.tier), attempts: attempt };
    if (!best || Math.abs(g.tier - want) < Math.abs(best.tier - want)) best = { puzzle, tier: g.tier };
  }
  if (!best) throw new Error(`failed to generate graded puzzle n=${n}`);
  return { puzzle: best!.puzzle, tier: best!.tier, difficulty: tierToDifficulty(best!.tier), attempts: maxAttempts };
}
