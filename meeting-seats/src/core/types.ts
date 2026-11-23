export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Puzzle {
  /** 격자 크기 N (5~9) */
  n: number;
  /** 길이 n*n, 각 칸의 부서(구역) 번호 0..n-1. index = row*n + col */
  regions: number[];
  /** solution[row] = 사람이 앉는 열 */
  solution: number[];
}

/** 칸 상태 */
export const EMPTY = 0;
export const CROSS = 1;
export const QUEEN = 2;
export type CellState = typeof EMPTY | typeof CROSS | typeof QUEEN;

export const DIFFICULTY_TIER: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: '쉬움', medium: '보통', hard: '어려움' };
