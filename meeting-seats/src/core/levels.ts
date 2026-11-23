/** 레벨 모드(1~200)와 오늘의 퍼즐: 시드 고정 생성 */
import { generateWithDifficulty, type GeneratedPuzzle } from './generator';
import { rngFromString } from './rng';
import type { Difficulty } from './types';

export const LEVEL_COUNT = 200;

export interface LevelConfig {
  n: number;
  difficulty: Difficulty;
}

/** 레벨 번호 → 크기·난이도. 갈수록 어려워진다. */
export function levelConfig(level: number): LevelConfig {
  const L = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(level)));
  if (L <= 6) return { n: 5, difficulty: 'easy' };
  if (L <= 12) return { n: 5, difficulty: 'medium' };
  if (L <= 20) return { n: 6, difficulty: 'easy' };
  if (L <= 32) return { n: 6, difficulty: 'medium' };
  if (L <= 40) return { n: 7, difficulty: 'easy' };
  if (L <= 60) return { n: 7, difficulty: 'medium' };
  if (L <= 70) return { n: 6, difficulty: L % 2 ? 'hard' : 'medium' };
  if (L <= 80) return { n: 8, difficulty: 'easy' };
  if (L <= 100) return { n: 8, difficulty: 'medium' };
  if (L <= 115) return { n: 7, difficulty: 'hard' };
  if (L <= 130) return { n: 9, difficulty: L % 3 === 0 ? 'easy' : 'medium' };
  if (L <= 150) return { n: 8, difficulty: L % 2 ? 'hard' : 'medium' };
  if (L <= 170) return { n: 9, difficulty: L % 2 ? 'hard' : 'medium' };
  return { n: 9, difficulty: 'hard' };
}

export function levelSeed(level: number): string {
  return `meeting-seats/level/${level}`;
}

export function generateLevel(level: number): GeneratedPuzzle {
  const { n, difficulty } = levelConfig(level);
  return generateWithDifficulty(n, difficulty, rngFromString(levelSeed(level)));
}

/** 로컬 날짜 YYYY-MM-DD */
export function dateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 요일별 오늘의 퍼즐: 월요일 가볍게 → 주말 어렵게 */
export function dailyConfig(key: string): LevelConfig {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=일
  const table: LevelConfig[] = [
    { n: 9, difficulty: 'hard' }, // 일
    { n: 6, difficulty: 'medium' }, // 월
    { n: 7, difficulty: 'medium' }, // 화
    { n: 7, difficulty: 'hard' }, // 수
    { n: 8, difficulty: 'medium' }, // 목
    { n: 8, difficulty: 'hard' }, // 금
    { n: 9, difficulty: 'medium' }, // 토
  ];
  return table[dow];
}

export function generateDaily(key: string): GeneratedPuzzle {
  const { n, difficulty } = dailyConfig(key);
  return generateWithDifficulty(n, difficulty, rngFromString(`meeting-seats/daily/${key}`));
}
