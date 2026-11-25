/**
 * 힌트: 플레이어의 현재 판을 보고 다음에 할 일을 알려준다.
 *  1) 잘못 앉힌 사람이 있으면 그 칸
 *  2) 정답 자리에 X 를 쳤으면 그 칸
 *  3) 아니면 논리 솔버로 다음에 확정되는 자리를 찾아 알려준다
 */
import { makeCtx, nextStep, placeQueen } from './logic';
import { CROSS, EMPTY, QUEEN, type Puzzle } from './types';

export type Hint =
  | { kind: 'wrongQueen'; cell: number }
  | { kind: 'wrongCross'; cell: number }
  | { kind: 'place'; cell: number; tier: number }
  | { kind: 'done' };

export function findHint(puzzle: Puzzle, board: ArrayLike<number>): Hint {
  const { n, solution } = puzzle;
  const isSol = (i: number) => solution[Math.floor(i / n)] === i % n;
  for (let i = 0; i < n * n; i++) if (board[i] === QUEEN && !isSol(i)) return { kind: 'wrongQueen', cell: i };
  for (let i = 0; i < n * n; i++) if (board[i] === CROSS && isSol(i)) return { kind: 'wrongCross', cell: i };

  const ctx = makeCtx(n, puzzle.regions);
  const s = new Int8Array(n * n);
  for (let i = 0; i < n * n; i++) if (board[i] === CROSS) s[i] = CROSS;
  for (let i = 0; i < n * n; i++) if (board[i] === QUEEN) placeQueen(ctx, s, i);
  const missing = () => {
    for (let r = 0; r < n; r++) {
      const i = r * n + solution[r];
      if (board[i] !== QUEEN) return i;
    }
    return -1;
  };
  if (missing() === -1) return { kind: 'done' };

  let tier = 0;
  for (let guard = 0; guard < 500; guard++) {
    // 판 위의 X 덕분에 이미 확정된 (그러나 아직 안 앉힌) 자리
    const st = nextStep(ctx, s, 3);
    if (!st) break;
    tier = Math.max(tier, st.tier);
    if (st.placed !== undefined && board[st.placed] !== QUEEN) {
      return { kind: 'place', cell: st.placed, tier };
    }
  }
  return { kind: 'place', cell: missing(), tier: 4 };
}

/** 같은 행/열/부서 두 명 이상, 혹은 인접 → 그 칸들 */
export function findConflicts(puzzle: Puzzle, board: ArrayLike<number>): Set<number> {
  const { n, regions } = puzzle;
  const bad = new Set<number>();
  const queens: number[] = [];
  for (let i = 0; i < n * n; i++) if (board[i] === QUEEN) queens.push(i);
  for (let a = 0; a < queens.length; a++) {
    for (let b = a + 1; b < queens.length; b++) {
      const i = queens[a];
      const j = queens[b];
      const ri = Math.floor(i / n), ci = i % n, rj = Math.floor(j / n), cj = j % n;
      if (ri === rj || ci === cj || regions[i] === regions[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  return bad;
}

/** 사람도 없고 빈칸도 없는 (전부 X 인) 행/열/부서의 칸들 — 막힌 줄 표시용 */
export function findBlockedUnits(puzzle: Puzzle, board: ArrayLike<number>, autoX?: ArrayLike<boolean>): Set<number> {
  const { n } = puzzle;
  const ctx = makeCtx(n, puzzle.regions);
  const out = new Set<number>();
  for (const u of ctx.units) {
    let open = false;
    for (const c of u) {
      if (board[c] === QUEEN || (board[c] === EMPTY && !(autoX && autoX[c]))) { open = true; break; }
    }
    if (!open) for (const c of u) out.add(c);
  }
  return out;
}

export function isSolved(puzzle: Puzzle, board: ArrayLike<number>): boolean {
  const { n, solution } = puzzle;
  let q = 0;
  for (let i = 0; i < n * n; i++) if (board[i] === QUEEN) q++;
  if (q !== n) return false;
  for (let r = 0; r < n; r++) if (board[r * n + solution[r]] !== QUEEN) return false;
  return true;
}
