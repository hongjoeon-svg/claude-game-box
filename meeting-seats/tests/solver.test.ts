import { describe, expect, it } from 'vitest';
import { countSolutions, findSolutions, isValidSolution } from '../src/core/solver';
import { growRegions, randomSolution } from '../src/core/generator';
import { mulberry32 } from '../src/core/rng';

/** 독립 검증용: 모든 순열을 다 만들어 보고 규칙 검사 (느리지만 단순) */
function bruteCount(n: number, regions: number[]): number {
  let count = 0;
  const perm: number[] = [];
  const used = new Array(n).fill(false);
  const rec = (r: number) => {
    if (r === n) { if (isValidSolution(n, regions, perm)) count++; return; }
    for (let c = 0; c < n; c++) {
      if (used[c]) continue;
      used[c] = true; perm[r] = c; rec(r + 1); used[c] = false;
    }
  };
  rec(0);
  return count;
}

// 손으로 만든 5x5 (해답 6개)
const P5 = [
  0, 0, 1, 1, 1,
  0, 0, 1, 2, 2,
  3, 0, 1, 2, 2,
  3, 3, 3, 3, 4,
  3, 3, 4, 4, 4,
];

describe('완전 탐색 솔버', () => {
  it('손으로 만든 퍼즐의 해답을 모두 찾고, 모두 규칙을 만족한다', () => {
    const sols = findSolutions(5, P5, 100);
    expect(sols.length).toBe(6);
    expect(sols).toContainEqual([0, 2, 4, 1, 3]);
    for (const s of sols) expect(isValidSolution(5, P5, s)).toBe(true);
  });

  it('행마다 한 부서면 행/열/인접 제약만 남는다: N=5 → 14, N=6 → 90 (OEIS A002464)', () => {
    const rows = (n: number) => Array.from({ length: n * n }, (_, i) => Math.floor(i / n));
    expect(countSolutions(5, rows(5), 1000)).toBe(14);
    expect(countSolutions(6, rows(6), 1000)).toBe(90);
    expect(countSolutions(7, rows(7), 10000)).toBe(646);
  });

  it('무작위 구역 200개에서 단순 전수 검사와 해답 수가 일치한다', () => {
    const rng = mulberry32(7);
    for (let k = 0; k < 200; k++) {
      const n = 5 + (k % 3);
      const regions = growRegions(n, randomSolution(n, rng), rng);
      expect(countSolutions(n, regions, 100000)).toBe(bruteCount(n, regions));
    }
  });

  it('limit 만큼만 센다', () => {
    const rows = Array.from({ length: 49 }, (_, i) => Math.floor(i / 7));
    expect(countSolutions(7, rows, 2)).toBe(2);
  });

  it('isValidSolution 이 인접·열·구역 위반을 잡는다', () => {
    const rows = Array.from({ length: 25 }, (_, i) => Math.floor(i / 5));
    expect(isValidSolution(5, rows, [0, 2, 4, 1, 3])).toBe(true);
    expect(isValidSolution(5, rows, [0, 1, 3, 2, 4])).toBe(false); // 대각 인접
    expect(isValidSolution(5, rows, [0, 2, 0, 3, 1])).toBe(false); // 같은 열
    expect(isValidSolution(5, P5, [1, 3, 0, 2, 4])).toBe(false); // (0,1)·(2,0) 둘 다 부서 0
  });
});
