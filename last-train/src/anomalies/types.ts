import type * as THREE from 'three';
import type { CarBuild } from '../car/build';
import type { CarConfig } from '../car/config';
import type { Game } from '../core/game';

export type Difficulty = 'easy' | 'normal' | 'subtle';

export interface AnomalyContext {
  game: Game;
  car: CarBuild;
  cfg: CarConfig;
  camera: THREE.PerspectiveCamera;
  rnd: () => number;
}

/**
 * 이상현상 하나 = 독립 모듈.
 *  - configure: 객차를 만들기 전에 설정을 바꾼다 (좌석 제거, 승객 추가, 표지 문구 등)
 *  - setup: 객차를 만든 직후 한 번 (조명 색, 소리 설정 등)
 *  - update: 매 프레임 (시선 추적, 연출 타이밍 등)
 * 객차는 칸마다 새로 만들어지므로 되돌리는(revert) 코드가 필요 없다.
 */
export interface Anomaly {
  id: string;
  name: string; // 도감 이름
  desc: string; // 도감 설명 (발견 후 공개)
  difficulty: Difficulty;
  jumpscare?: boolean;
  configure?(cfg: CarConfig, rnd: () => number): void;
  setup?(ctx: AnomalyContext): void;
  update?(ctx: AnomalyContext, dt: number): void;
}

/**
 * 이상현상 팩 = 노선. 기본 노선은 앱에 포함, 추가 노선은 인앱 결제(productId)로 잠금 해제.
 */
export interface AnomalyPack {
  id: string;
  name: string;
  desc: string;
  productId: string | null; // null = 기본 포함
  comingSoon?: boolean;
  anomalies: Anomaly[];
}
