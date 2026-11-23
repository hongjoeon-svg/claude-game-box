import { describe, expect, it } from 'vitest';
import { generateWithDifficulty } from '../src/core/generator';
import { findConflicts, findHint, isSolved } from '../src/core/hint';
import { rngFromString } from '../src/core/rng';
import { CROSS, EMPTY, QUEEN } from '../src/core/types';

describe('힌트·검사', () => {
  const { puzzle } = generateWithDifficulty(7, 'hard', rngFromString('hint'));
  const n = puzzle.n;
  const solCell = (r: number) => r * n + puzzle.solution[r];

  it('빈 판에서 힌트를 계속 따라가면 퍼즐이 풀린다', () => {
    const board = new Array(n * n).fill(EMPTY);
    for (let k = 0; k < n; k++) {
      const h = findHint(puzzle, board);
      expect(h.kind).toBe('place');
      if (h.kind !== 'place') return;
      expect(puzzle.solution[Math.floor(h.cell / n)]).toBe(h.cell % n);
      board[h.cell] = QUEEN;
    }
    expect(isSolved(puzzle, board)).toBe(true);
    expect(findHint(puzzle, board).kind).toBe('done');
  });

  it('잘못 앉힌 사람 / 정답 칸의 X 를 먼저 알려준다', () => {
    const board = new Array(n * n).fill(EMPTY);
    const wrong = solCell(0) === 0 ? 1 : 0;
    board[wrong] = QUEEN;
    expect(findHint(puzzle, board)).toEqual({ kind: 'wrongQueen', cell: wrong });
    board[wrong] = EMPTY;
    board[solCell(2)] = CROSS;
    expect(findHint(puzzle, board)).toEqual({ kind: 'wrongCross', cell: solCell(2) });
  });

  it('충돌 칸 검출 (같은 행, 인접)', () => {
    const board = new Array(n * n).fill(EMPTY);
    board[0] = QUEEN;
    board[1] = QUEEN;
    expect([...findConflicts(puzzle, board)].sort()).toEqual([0, 1]);
    board[1] = EMPTY;
    board[n + 1] = QUEEN; // 대각 인접
    expect(findConflicts(puzzle, board).has(0)).toBe(true);
  });
});
