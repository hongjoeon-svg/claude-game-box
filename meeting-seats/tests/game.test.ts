import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/game';
import { generateLevel } from '../src/core/levels';
import { CROSS, EMPTY, QUEEN } from '../src/core/types';
import { isAdFree, setAdFree, showInterstitial, showRewardedAd, shouldShowInterstitial } from '../src/ads';
import { starsForHints } from '../src/screens/gameScreen';

describe('GameState', () => {
  const { puzzle } = generateLevel(30);
  const n = puzzle.n;

  it('탭 순환: 빈칸 → X → 사람 → 빈칸', () => {
    const g = new GameState(puzzle);
    expect(g.tap(0, false)).toBe(CROSS);
    expect(g.tap(0, false)).toBe(QUEEN);
    expect(g.tap(0, false)).toBe(EMPTY);
  });

  it('자동 X 가 보이는 빈칸은 탭 한 번에 사람', () => {
    const g = new GameState(puzzle);
    g.tap(0, true); g.tap(0, true); // (0,0) 사람
    expect(g.autoCrossed()[1]).toBe(true);
    expect(g.autoCrossed()[n + 1]).toBe(true);
    expect(g.tap(1, true)).toBe(QUEEN);
    expect(g.conflicts().has(0)).toBe(true);
  });

  it('묶음 실행 취소와 초기화 되돌리기', () => {
    const g = new GameState(puzzle);
    g.begin(); g.set(0, CROSS); g.set(1, CROSS); g.set(2, CROSS); g.commit();
    g.tap(5, false);
    g.undo();
    expect(g.board[5]).toBe(EMPTY);
    expect(g.board.slice(0, 3)).toEqual([CROSS, CROSS, CROSS]);
    g.reset();
    expect(g.board.every((v) => v === EMPTY)).toBe(true);
    g.undo();
    expect(g.board.slice(0, 3)).toEqual([CROSS, CROSS, CROSS]);
    g.undo();
    expect(g.canUndo()).toBe(false);
  });

  it('정답 배치면 isSolved', () => {
    const g = new GameState(puzzle);
    puzzle.solution.forEach((c, r) => g.set(r * n + c, QUEEN));
    expect(g.isSolved()).toBe(true);
    expect(g.conflicts().size).toBe(0);
  });

  it('별: 힌트 0 → 3개, 1 → 2개, 2+ → 1개', () => {
    expect([0, 1, 2, 5].map(starsForHints)).toEqual([3, 2, 1, 1]);
  });
});

describe('광고 자리', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    };
  });

  it('광고 제거 플래그', async () => {
    expect(isAdFree()).toBe(false);
    setAdFree(true);
    expect(isAdFree()).toBe(true);
    expect(await showRewardedAd('hint')).toBe(true);
    await expect(showInterstitial('gap')).resolves.toBeUndefined();
  });

  it('전면 광고는 레벨 5 이후 3클리어마다', () => {
    expect(shouldShowInterstitial(3, 3)).toBe(false);
    expect(shouldShowInterstitial(10, 9)).toBe(true);
    expect(shouldShowInterstitial(10, 10)).toBe(false);
  });
});
