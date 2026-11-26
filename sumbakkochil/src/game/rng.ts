// 시드 고정 난수 (mulberry32). 같은 시드면 맵이 매번 똑같이 그려져야
// 1:1 판정용 맵과 확대 화면용 맵이 픽셀 단위로 일치합니다.
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
export const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
