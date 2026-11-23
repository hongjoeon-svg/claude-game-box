import { describe, expect, it } from 'vitest';
import { dailyConfig, dateKey, generateDaily, generateLevel, LEVEL_COUNT, levelConfig } from '../src/core/levels';
import { DIFFICULTY_TIER } from '../src/core/types';
import { findSolutions } from '../src/core/solver';

describe('레벨 모드', () => {
  it('1~200 레벨 전부 유일해, 설정한 크기, 결정적', () => {
    const tierMismatch: number[] = [];
    for (let L = 1; L <= LEVEL_COUNT; L++) {
      const cfg = levelConfig(L);
      const g = generateLevel(L);
      expect(g.puzzle.n).toBe(cfg.n);
      expect(findSolutions(g.puzzle.n, g.puzzle.regions, 2).length).toBe(1);
      if (g.tier !== DIFFICULTY_TIER[cfg.difficulty]) tierMismatch.push(L);
    }
    expect(tierMismatch).toEqual([]);
    expect(generateLevel(42).puzzle).toEqual(generateLevel(42).puzzle);
  }, 120_000);

  it('크기는 대체로 커진다 (첫 레벨 5, 마지막 레벨 9)', () => {
    expect(levelConfig(1).n).toBe(5);
    expect(levelConfig(200)).toEqual({ n: 9, difficulty: 'hard' });
  });
});

describe('오늘의 퍼즐', () => {
  it('같은 날짜 → 같은 퍼즐, 다른 날짜 → 다른 퍼즐', () => {
    const a = generateDaily('2026-11-23');
    const b = generateDaily('2026-11-23');
    const c = generateDaily('2026-11-24');
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.puzzle).not.toEqual(c.puzzle);
    expect(dailyConfig('2026-11-23').n).toBe(a.puzzle.n);
  });

  it('dateKey 형식', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
