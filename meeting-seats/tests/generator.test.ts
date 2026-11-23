import { describe, expect, it } from 'vitest';
import { generatePuzzle, generateWithDifficulty, growRegions, randomSolution } from '../src/core/generator';
import { grade } from '../src/core/logic';
import { mulberry32, rngFromString } from '../src/core/rng';
import { findSolutions, isValidSolution } from '../src/core/solver';
import type { Puzzle } from '../src/core/types';

function regionsConnected(p: Puzzle): boolean {
  const { n, regions } = p;
  for (let g = 0; g < n; g++) {
    const cells = regions.map((x, i) => (x === g ? i : -1)).filter((i) => i >= 0);
    if (!cells.length) return false;
    const seen = new Set([cells[0]]);
    const st = [cells[0]];
    while (st.length) {
      const i = st.pop()!;
      const r = Math.floor(i / n), c = i % n;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) continue;
        const j = r2 * n + c2;
        if (regions[j] === g && !seen.has(j)) { seen.add(j); st.push(j); }
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}

function checkPuzzle(p: Puzzle) {
  expect(p.regions.length).toBe(p.n * p.n);
  expect(new Set(p.regions).size).toBe(p.n);
  expect(isValidSolution(p.n, p.regions, p.solution)).toBe(true);
  const sols = findSolutions(p.n, p.regions, 2);
  expect(sols.length).toBe(1);
  expect(sols[0]).toEqual(p.solution);
  expect(regionsConnected(p)).toBe(true);
}

describe('생성기 기본 요소', () => {
  it('randomSolution 은 항상 유효한 배치', () => {
    const rng = mulberry32(1);
    for (let n = 5; n <= 9; n++) for (let k = 0; k < 20; k++) {
      const sol = randomSolution(n, rng);
      const rows = Array.from({ length: n * n }, (_, i) => Math.floor(i / n));
      expect(isValidSolution(n, rows, sol)).toBe(true);
    }
  });

  it('growRegions 는 해답 자리마다 서로 다른 부서를 갖는 연결된 구역을 만든다', () => {
    const rng = mulberry32(2);
    const sol = randomSolution(8, rng);
    const regions = growRegions(8, sol, rng);
    expect(regions.every((g) => g >= 0 && g < 8)).toBe(true);
    expect(new Set(sol.map((c, r) => regions[r * 8 + c])).size).toBe(8);
    expect(regionsConnected({ n: 8, regions, solution: sol })).toBe(true);
  });
});

describe('퍼즐 생성 (1000개 유일해 검증)', () => {
  it('N=5~9 퍼즐 1000개가 전부 유일해 + 연결된 구역 + 논리로 풀림', () => {
    const rng = mulberry32(20261123);
    let count = 0;
    for (let i = 0; i < 1000; i++) {
      const n = 5 + (i % 5);
      const p = generatePuzzle(n, rng);
      checkPuzzle(p);
      expect(grade(p).solved).toBe(true);
      count++;
    }
    expect(count).toBe(1000);
  }, 120_000);
});

describe('난이도 생성', () => {
  it('같은 시드 → 같은 퍼즐 (결정적)', () => {
    const a = generateWithDifficulty(7, 'medium', rngFromString('x'));
    const b = generateWithDifficulty(7, 'medium', rngFromString('x'));
    expect(a.puzzle).toEqual(b.puzzle);
  });

  it.each([
    [5, 'easy', 1],
    [6, 'medium', 2],
    [7, 'hard', 3],
    [8, 'easy', 1],
    [9, 'medium', 2],
    [9, 'hard', 3],
  ] as const)('N=%i %s → 논리 단계 %i', (n, diff, tier) => {
    for (let k = 0; k < 5; k++) {
      const g = generateWithDifficulty(n, diff, rngFromString(`${n}-${diff}-${k}`));
      checkPuzzle(g.puzzle);
      expect(g.tier).toBe(tier);
      expect(grade(g.puzzle).tier).toBe(tier);
    }
  }, 60_000);
});
