// 객차 치수(미터). z 축: 앞(진행 방향) = -z, 뒤 = +z. x 축: 왼쪽 = -x, 오른쪽 = +x.
export const HALF_W = 1.5; // 내벽까지 반폭
export const WALL_TOP = 2.0; // 수직 벽 끝, 여기서부터 경사진 천장 코브
export const CEIL = 2.36;
export const COVE_X = 1.18; // 코브가 천장과 만나는 x
export const DOOR_W = 1.3;
export const DOOR_H = 1.85;
export const END_DOOR_W = 0.86;
export const WIN_BOTTOM = 0.95;
export const WIN_TOP = 1.78;
export const SEAT_H = 0.45;
export const SEAT_FRONT = 1.0; // 의자 앞 모서리 x
export const BAR_X = 0.98; // 손잡이 봉 x
export const BAR_Y = 1.95;
export const BASE_LENGTH = 18;
export const EYE_HEIGHT = 1.58;
export const AISLE_HALF = 0.78; // 플레이어가 걸을 수 있는 통로 반폭

export function doorZs(length: number): number[] {
  return [-0.375, -0.125, 0.125, 0.375].map((f) => f * length);
}

export interface Bench {
  id: number; // side*5 + seg
  side: -1 | 1;
  seg: number; // 0 앞 끝(배려석) 1~3 긴 의자 4 뒤 끝(배려석)
  z0: number;
  z1: number;
  seats: number;
  priority: boolean;
}

/** 객차 길이로부터 의자 구간 계산 (길어지는 이상현상은 의자 칸 수가 늘어남) */
export function benches(length: number): Bench[] {
  const dz = doorZs(length);
  const half = length / 2;
  const gap = DOOR_W / 2 + 0.22;
  const ranges: [number, number][] = [
    [-half + 0.18, dz[0] - gap],
    [dz[0] + gap, dz[1] - gap],
    [dz[1] + gap, dz[2] - gap],
    [dz[2] + gap, dz[3] - gap],
    [dz[3] + gap, half - 0.18],
  ];
  const out: Bench[] = [];
  for (const side of [-1, 1] as const) {
    ranges.forEach(([z0, z1], seg) => {
      const len = z1 - z0;
      const priority = seg === 0 || seg === 4;
      out.push({
        id: (side < 0 ? 0 : 5) + seg,
        side,
        seg,
        z0,
        z1,
        seats: Math.max(2, Math.round(len / (priority ? 0.45 : 0.43))),
        priority,
      });
    });
  }
  return out;
}

export function seatPos(b: Bench, slot: number): { x: number; z: number } {
  const w = (b.z1 - b.z0) / b.seats;
  return { x: b.side * (HALF_W - 0.27), z: b.z0 + w * (slot + 0.5) };
}
