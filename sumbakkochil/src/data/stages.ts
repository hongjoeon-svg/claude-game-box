// 스테이지 데이터 — JSON과 같은 모양의 평범한 객체 배열.
// 새 스테이지는 이 배열에 항목을 추가하기만 하면 됩니다.

export type MapId = 'store' | 'office' | 'subway';

export interface StageDef {
  id: string;
  mapId: MapId;
  /** 맵 안에서의 순번 (1~5) */
  index: number;
  name: string;
  /** 배경 무늬 복잡도 1~5 */
  detail: number;
  /** 맵을 그릴 때 쓰는 난수 시드 */
  seed: number;
  /** 배치 단계 시간(초) */
  placeTime: number;
  /** 칠하기 단계 시간(초) 30 → 20 */
  paintTime: number;
  /** 술래 단계 시간(초) — Phase 2부터 사용 */
  seekTime: number;
  /** 술래 이동 속도 배율 — Phase 2 */
  seekerSpeed: number;
  /** 시야 콘 각도(도) — Phase 2 */
  coneAngle: number;
  /** 의심 게이지 난이도 계수 — Phase 2 */
  difficulty: number;
}

export const STAGES: StageDef[] = [
  {
    id: 'store-1', mapId: 'store', index: 1, name: '야간 알바의 시작',
    detail: 1, seed: 1101,
    placeTime: 5, paintTime: 30, seekTime: 15,
    seekerSpeed: 1, coneAngle: 40, difficulty: 1,
  },
];

export function getStage(id: string): StageDef {
  const s = STAGES.find((st) => st.id === id);
  if (!s) throw new Error(`스테이지 없음: ${id}`);
  return s;
}
