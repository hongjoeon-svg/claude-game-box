import { describe, expect, it } from 'vitest';
import { judgeCamouflage, starsForScore, type JudgeInput } from '../src/game/camouflage';

// ── 테스트용 버퍼 만들기 ──
// 40x60 버퍼, 가운데 20x40 사각형이 캐릭터(마스크)
const W = 40;
const H = 60;
type RGB = [number, number, number];

function makeMask(): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let y = 10; y < 50; y++) for (let x = 10; x < 30; x++) m[y * W + x] = 1;
  return m;
}

function fill(fn: (x: number, y: number) => RGB): Uint8ClampedArray {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * W + x) * 4;
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
    }
  return out;
}

function coverage(v: number): Uint8Array {
  return new Uint8Array(W * H).fill(v);
}

/** 줄무늬 배경 (편의점 진열대 느낌) */
const stripes = (_x: number, y: number): RGB =>
  Math.floor(y / 6) % 2 === 0 ? [240, 120, 140] : [120, 200, 170];

function input(bg: Uint8ClampedArray, ch: Uint8ClampedArray, cov: Uint8Array, mask = makeMask()): JudgeInput {
  return { width: W, height: H, background: bg, character: ch, coverage: cov, mask };
}

describe('judgeCamouflage', () => {
  it('배경과 완전히 같은 색으로 칠하면 100점 근처', () => {
    const bg = fill(stripes);
    const r = judgeCamouflage(input(bg, bg, coverage(255)));
    expect(r.score).toBeGreaterThanOrEqual(98);
    expect(r.meanDeltaE).toBeCloseTo(0, 5);
  });

  it('흰색 그대로(칠 안 함)면 낮은 점수', () => {
    const bg = fill(stripes);
    const white = fill(() => [255, 255, 255]);
    const r = judgeCamouflage(input(bg, white, coverage(0)));
    expect(r.score).toBeLessThan(25);
    expect(r.paintedRatio).toBe(0);
  });

  it('단색 배경에 같은 단색이면 만점, 흰색이면 낮은 점수', () => {
    const green = fill(() => [90, 170, 110]);
    const white = fill(() => [255, 255, 255]);
    expect(judgeCamouflage(input(green, green, coverage(255))).score).toBe(100);
    expect(judgeCamouflage(input(green, white, coverage(0))).score).toBeLessThan(20);
  });

  it('줄무늬 배경을 평균색 하나로 칠하면 중간 점수', () => {
    // 파스텔 줄무늬(실제 맵 수준의 대비)
    const soft = (_x: number, y: number): RGB =>
      Math.floor(y / 6) % 2 === 0 ? [245, 185, 195] : [185, 225, 205];
    const bg = fill(soft);
    const avg = fill(() => [215, 205, 200]);
    const r = judgeCamouflage(input(bg, avg, coverage(255)));
    expect(r.score).toBeGreaterThan(25);
    expect(r.score).toBeLessThan(85);
  });

  it('많이 칠할수록(정확한 색으로) 점수가 오른다', () => {
    const bg = fill(stripes);
    const scores = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
      const limitY = 10 + Math.round(40 * frac);
      const ch = fill((x, y) => (y < limitY ? stripes(x, y) : [255, 255, 255]));
      const cov = new Uint8Array(W * H);
      for (let y = 0; y < limitY; y++) for (let x = 0; x < W; x++) cov[y * W + x] = 255;
      return judgeCamouflage(input(bg, ch, cov)).score;
    });
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });

  it('안쪽은 완벽해도 테두리만 튀면 윤곽 점수가 깎인다', () => {
    const green = fill(() => [90, 170, 110]);
    const mask = makeMask();
    // 마스크 경계(가장자리 1픽셀)만 빨갛게
    const ch = fill((x, y) =>
      x === 10 || x === 29 || y === 10 || y === 49 ? [230, 40, 40] : [90, 170, 110],
    );
    const r = judgeCamouflage(input(green, ch, coverage(255), mask));
    expect(r.edgeScore).toBeLessThan(0.3);
    expect(r.colorScore).toBeGreaterThan(r.edgeScore);
  });

  it('배경에 원래 있던 경계는 감점하지 않는다', () => {
    // 마스크 경계와 딱 겹치는 위치에 배경 색이 바뀌어도, 캐릭터가 배경을 그대로 따라 칠했으면 만점
    const bg = fill((x) => (x < 10 ? [40, 60, 200] : [250, 220, 90]));
    const r = judgeCamouflage(input(bg, bg, coverage(255)));
    expect(r.edgeScore).toBe(1);
  });

  it('흰 배경이어도 칠 안 했으면 낮은 점수, 흰색으로 칠했으면 높은 점수', () => {
    const white = fill(() => [255, 255, 255]);
    expect(judgeCamouflage(input(white, white, coverage(0))).score).toBeLessThan(15);
    expect(judgeCamouflage(input(white, white, coverage(255))).score).toBe(100);
  });

  it('히트맵은 마스크 밖이 0, 흰 캐릭터면 안쪽이 높다', () => {
    const bg = fill(stripes);
    const white = fill(() => [255, 255, 255]);
    const r = judgeCamouflage(input(bg, white, coverage(0)));
    expect(r.heat[0]).toBe(0);
    expect(r.heat[30 * W + 20]).toBeGreaterThan(0.5);
  });

  it('마스크가 비어 있으면 0점', () => {
    const bg = fill(stripes);
    const r = judgeCamouflage(input(bg, bg, coverage(255), new Uint8Array(W * H)));
    expect(r.score).toBe(0);
  });
});

describe('starsForScore', () => {
  it('구간별 별 개수', () => {
    expect(starsForScore(10)).toBe(0);
    expect(starsForScore(40)).toBe(1);
    expect(starsForScore(70)).toBe(2);
    expect(starsForScore(90)).toBe(3);
  });
});
