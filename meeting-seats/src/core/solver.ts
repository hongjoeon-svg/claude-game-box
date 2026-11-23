/**
 * 완전 탐색 솔버: 해답 개수를 센다 (limit 개까지만).
 * 행 단위 백트래킹 + 비트마스크. N ≤ 9 에서 충분히 빠르다.
 */
export function findSolutions(n: number, regions: ArrayLike<number>, limit = 2): number[][] {
  // deadByRow[r]: 모든 칸이 r행보다 위에 있는 구역들의 마스크.
  // r행에 도달했는데 그런 구역이 아직 비어 있으면 더 볼 필요가 없다.
  const maxRow = new Array(n).fill(-1);
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n);
    if (r > maxRow[regions[i]]) maxRow[regions[i]] = r;
  }
  const deadByRow = new Array(n + 1).fill(0);
  for (let r = 0; r <= n; r++) {
    for (let g = 0; g < n; g++) if (maxRow[g] < r) deadByRow[r] |= 1 << g;
  }

  const sols: number[][] = [];
  const cols = new Array<number>(n).fill(-1);
  let colMask = 0;
  let regMask = 0;

  const rec = (r: number, prev: number): void => {
    if (sols.length >= limit) return;
    if (r === n) {
      sols.push(cols.slice());
      return;
    }
    if (deadByRow[r] & ~regMask) return;
    const base = r * n;
    for (let c = 0; c < n; c++) {
      if (colMask & (1 << c)) continue;
      if (r > 0 && c >= prev - 1 && c <= prev + 1) continue;
      const g = regions[base + c];
      if (regMask & (1 << g)) continue;
      colMask |= 1 << c;
      regMask |= 1 << g;
      cols[r] = c;
      rec(r + 1, c);
      colMask &= ~(1 << c);
      regMask &= ~(1 << g);
      if (sols.length >= limit) return;
    }
  };
  rec(0, -10);
  return sols;
}

export function countSolutions(n: number, regions: ArrayLike<number>, limit = 2): number {
  return findSolutions(n, regions, limit).length;
}

/** 배치가 규칙을 모두 만족하는지 (solution[row] = col) */
export function isValidSolution(n: number, regions: ArrayLike<number>, solution: number[]): boolean {
  if (solution.length !== n) return false;
  const colSeen = new Set<number>();
  const regSeen = new Set<number>();
  for (let r = 0; r < n; r++) {
    const c = solution[r];
    if (c < 0 || c >= n || colSeen.has(c)) return false;
    colSeen.add(c);
    const g = regions[r * n + c];
    if (regSeen.has(g)) return false;
    regSeen.add(g);
    if (r > 0 && Math.abs(c - solution[r - 1]) <= 1) return false;
  }
  return true;
}
