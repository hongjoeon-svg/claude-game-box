import { describe, expect, it } from 'vitest';
import { deltaE76, hexToRgb, rgbToHex, rgbToLab } from '../src/game/color';

describe('rgbToLab', () => {
  it('흰색은 L=100, a=b=0', () => {
    const [l, a, b] = rgbToLab(255, 255, 255);
    expect(l).toBeCloseTo(100, 1);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });
  it('검정은 L=0', () => {
    expect(rgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 3);
  });
  it('순수 빨강은 알려진 Lab 값과 일치', () => {
    const [l, a, b] = rgbToLab(255, 0, 0);
    expect(l).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 0);
    expect(b).toBeCloseTo(67.2, 0);
  });
});

describe('deltaE76', () => {
  it('같은 색이면 0', () => {
    expect(deltaE76(50, 10, -10, 50, 10, -10)).toBe(0);
  });
  it('흰색과 검정은 100', () => {
    expect(deltaE76(100, 0, 0, 0, 0, 0)).toBe(100);
  });
});

describe('hex 변환', () => {
  it('왕복 변환', () => {
    expect(rgbToHex(...hexToRgb('#a1b2c3'))).toBe('#a1b2c3');
  });
});
