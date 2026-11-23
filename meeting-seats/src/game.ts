/**
 * 한 판의 상태 (DOM 과 무관). 칸 상태, 실행 취소, 자동 X, 충돌 검사.
 */
import { findConflicts, isSolved } from './core/hint';
import { CROSS, EMPTY, QUEEN, type Puzzle } from './core/types';

export interface Change {
  cell: number;
  from: number;
  to: number;
}

export class GameState {
  readonly puzzle: Puzzle;
  readonly n: number;
  board: number[];
  private undoStack: Change[][] = [];
  private pending: Change[] | null = null;
  hintsUsed = 0;

  constructor(puzzle: Puzzle, board?: number[]) {
    this.puzzle = puzzle;
    this.n = puzzle.n;
    this.board = board && board.length === puzzle.n * puzzle.n ? board.slice() : new Array(puzzle.n * puzzle.n).fill(EMPTY);
  }

  /** 사람이 앉은 칸과 같은 행/열/부서/인접인 빈칸 */
  autoCrossed(): boolean[] {
    const { n, regions } = this.puzzle;
    const out = new Array<boolean>(n * n).fill(false);
    for (let q = 0; q < n * n; q++) {
      if (this.board[q] !== QUEEN) continue;
      const qr = Math.floor(q / n);
      const qc = q % n;
      for (let i = 0; i < n * n; i++) {
        if (i === q || this.board[i] !== EMPTY) continue;
        const r = Math.floor(i / n);
        const c = i % n;
        if (r === qr || c === qc || regions[i] === regions[q] || (Math.abs(r - qr) <= 1 && Math.abs(c - qc) <= 1)) out[i] = true;
      }
    }
    return out;
  }

  /** 여러 변경을 하나의 실행 취소 단위로 묶기 시작 */
  begin(): void {
    if (!this.pending) this.pending = [];
  }

  set(cell: number, to: number): boolean {
    const from = this.board[cell];
    if (from === to) return false;
    this.board[cell] = to;
    const ch = { cell, from, to };
    if (this.pending) this.pending.push(ch);
    else this.undoStack.push([ch]);
    return true;
  }

  commit(): void {
    if (this.pending && this.pending.length) this.undoStack.push(this.pending);
    this.pending = null;
  }

  /** 탭: 빈칸 → X → 사람 → 빈칸. 자동 X 가 보이는 빈칸은 바로 사람으로. */
  tap(cell: number, autoX: boolean): number {
    const cur = this.board[cell];
    let next: number;
    if (cur === EMPTY) next = autoX && this.autoCrossed()[cell] ? QUEEN : CROSS;
    else if (cur === CROSS) next = QUEEN;
    else next = EMPTY;
    this.set(cell, next);
    return next;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  undo(): Change[] | null {
    const group = this.undoStack.pop();
    if (!group) return null;
    for (let i = group.length - 1; i >= 0; i--) this.board[group[i].cell] = group[i].from;
    return group;
  }

  /** 전체 초기화 (실행 취소 가능) */
  reset(): void {
    this.begin();
    for (let i = 0; i < this.board.length; i++) this.set(i, EMPTY);
    this.commit();
  }

  conflicts(): Set<number> {
    return findConflicts(this.puzzle, this.board);
  }

  isSolved(): boolean {
    return isSolved(this.puzzle, this.board);
  }

  queenCount(): number {
    return this.board.filter((x) => x === QUEEN).length;
  }
}
