export type Pose = 'phone' | 'sleep' | 'straight' | 'stand';

export interface PassengerSpec {
  key: string;
  bench: number; // 앉은 의자 id (stand 이면 무시)
  slot: number;
  pose: Pose;
  coat: number;
  pants: number;
  hair: number;
  /** 서 있는 경우 위치/방향 */
  x?: number;
  z?: number;
  yaw?: number;
}

export interface SignState {
  routeOverride: { panel: number; station: number; text: string } | null;
  doorNumbers: string[] | null; // 8개 (왼쪽 앞→뒤 4, 오른쪽 앞→뒤 4). null = 정상
  adOverride: { ad: number; lines: string[] } | null;
  mirrorStickers: boolean;
  carNumber: string;
}

export interface CarConfig {
  length: number;
  count: number;
  passengers: PassengerSpec[];
  missingBench: number | null;
  oddSeat: { bench: number; slot: number } | null;
  bentPole: number | null;
  signs: SignState;
  terminal: boolean;
}

export const BASE_PASSENGERS: PassengerSpec[] = [
  { key: 'a', bench: 2, slot: 2, pose: 'phone', coat: 0x2f343d, pants: 0x1f2026, hair: 0x18181a },
  { key: 'b', bench: 6, slot: 4, pose: 'sleep', coat: 0x463a33, pants: 0x25252b, hair: 0x2a211c },
  { key: 'c', bench: 8, slot: 1, pose: 'straight', coat: 0x2c3a35, pants: 0x2a2a30, hair: 0x121214 },
];

export function baseConfig(count: number, length: number): CarConfig {
  return {
    length,
    count,
    passengers: BASE_PASSENGERS.map((p) => ({ ...p })),
    missingBench: null,
    oddSeat: null,
    bentPole: null,
    signs: { routeOverride: null, doorNumbers: null, adOverride: null, mirrorStickers: false, carNumber: '4012' },
    terminal: false,
  };
}

export function normalDoorNumbers(): string[] {
  return ['4-1', '4-2', '4-3', '4-4', '4-1', '4-2', '4-3', '4-4'];
}
