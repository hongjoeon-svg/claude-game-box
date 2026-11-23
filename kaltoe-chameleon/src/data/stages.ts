import type { PropId, Strictness } from './zones';

/** 순찰자(부장님·과장님) 정의 — 좌표는 모두 타일 단위 [x, y] */
export interface PatrollerDef {
  type: 'boss' | 'manager';
  /** 머리 위에 표시할 이름 (기본: 부장님/과장님) */
  name?: string;
  /** 이동 속도 (px/초, 타일 1칸 = 30px) */
  speed: number;
  /** 시야각 (도) */
  fovDeg: number;
  /** 시야 거리 (px) */
  viewDist: number;
  /** 순찰 경로 웨이포인트 */
  path: [number, number][];
  /** loop: 마지막→처음으로 순환, pingpong: 왕복 (기본 loop) */
  mode?: 'loop' | 'pingpong';
  /** 웨이포인트마다 멈추는 시간 (ms) */
  waitMs?: number;
  /** 멈춰 있는 동안 좌우를 두리번거릴지 */
  lookAround?: boolean;
  /** 처음 시작할 웨이포인트 인덱스 */
  startIndex?: number;
  /** 기습 확인: 가끔 뒤를 휙 돌아봄 */
  surpriseCheck?: {
    minIntervalMs: number;
    maxIntervalMs: number;
    /** 돌아보기 전 경고(‼️) 표시 시간 */
    warnMs: number;
    /** 뒤돌아본 채 유지하는 시간 */
    holdMs: number;
  };
}

export interface StageDef {
  id: number;
  name: string;
  description?: string;
  /** 오후 5:55 → 6:00 까지 걸리는 실제 시간 (초) */
  timeLimitSec: number;
  /** 별 3번째 조건: 이 시간(초) 안에 클리어 */
  fastClearSec: number;
  transformCooldownMs?: number;
  strictness: Strictness;
  /** 튜토리얼용: 지금 위치에 어울리는 소품 버튼에 표시 */
  showHints?: boolean;
  /** 하단 변신 버튼 (3~5개) */
  props: PropId[];
  /** 시작 시 순서대로 보여줄 안내 문구 */
  tips?: string[];
  /** 15 x 20 문자 지도 (README 범례 참고) */
  map: string[];
  patrollers: PatrollerDef[];
}

// stages 폴더의 *.json 을 자동으로 모두 불러옵니다. 파일만 추가하면 스테이지가 늘어납니다.
const modules = import.meta.glob<{ default: StageDef }>('./stages/*.json', { eager: true });

export const STAGES: StageDef[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.id - b.id);

export function getStage(id: number): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}

export function nextStageId(id: number): number | undefined {
  const idx = STAGES.findIndex((s) => s.id === id);
  return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1].id : undefined;
}
