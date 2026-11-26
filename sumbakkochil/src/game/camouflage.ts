// ─────────────────────────────────────────────────────────────
// 위장 판정 (순수 함수, 브라우저 API 없음 → Vitest로 테스트)
//
// 입력은 모두 "판정 해상도"(맵의 1/4)로 줄인 같은 크기의 버퍼입니다.
//   background : 캐릭터 뒤에 가려진 배경 RGBA
//   character  : 플레이어가 칠한 캐릭터 RGBA (칠 안 한 곳은 흰색)
//   coverage   : 칠한 정도 0~255 (칠 레이어의 알파값)
//   mask       : 캐릭터 실루엣 1 / 바깥 0
//
// 점수 구성 (spec)
//   a) 색 차이   60% : 마스크 안 픽셀별 ΔE(캐릭터, 배경) 평균
//   b) 윤곽 대비 30% : 경계 안쪽 캐릭터 색 vs 경계 바깥 배경 색의 "추가로 생긴" 대비
//   c) 칠한 면적 10% : 칠 안 한 흰 영역이 많을수록 감점
// ─────────────────────────────────────────────────────────────
import { deltaE76, rgbaToLabBuffer } from './color';

export interface JudgeInput {
  width: number;
  height: number;
  background: ArrayLike<number>;
  character: ArrayLike<number>;
  coverage: ArrayLike<number>;
  mask: ArrayLike<number>;
}

export interface JudgeResult {
  /** 최종 위장 점수 0~100 (정수) */
  score: number;
  /** 각 항목 0~1 */
  colorScore: number;
  edgeScore: number;
  paintedRatio: number;
  /** 원시값 (디버그/튜닝용) */
  meanDeltaE: number;
  meanEdgeDelta: number;
  /** 픽셀별 "티 나는 정도" 0~1, 마스크 밖은 0 (결과 화면 히트맵용) */
  heat: Float32Array;
  width: number;
  height: number;
}

export const WEIGHTS = { color: 0.6, edge: 0.3, coverage: 0.1 } as const;

/** 이 이하의 ΔE는 "눈으로 구분 불가"로 보고 감점하지 않음 */
export const DE_FREE = 2.3;
/** 평균 ΔE가 이 값이면 색 점수 0 */
export const DE_ZERO = 50;
/** 경계에서 추가된 평균 대비가 이 값이면 윤곽 점수 0 */
export const EDGE_ZERO = 40;
/** 이 알파 이상이면 "칠한 픽셀"로 침 */
export const PAINTED_ALPHA = 128;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 원시 차이값 → 0~1 점수 (DE_FREE 이하 만점, zero 이상 0점, 사이는 선형) */
function toScore(value: number, zero: number): number {
  return clamp01(1 - (value - DE_FREE) / (zero - DE_FREE));
}

export function judgeCamouflage(input: JudgeInput): JudgeResult {
  const { width: w, height: h, mask, coverage } = input;
  const n = w * h;
  const bgLab = rgbaToLabBuffer(input.background, n);
  const chLab = rgbaToLabBuffer(input.character, n);
  const heat = new Float32Array(n);

  // 픽셀별 색 차이 (heat 계산에도 재사용)
  const pixelDE = new Float32Array(n);
  let maskCount = 0;
  let deSum = 0;
  let paintedCount = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    maskCount++;
    const de = deltaE76(
      chLab[i * 3], chLab[i * 3 + 1], chLab[i * 3 + 2],
      bgLab[i * 3], bgLab[i * 3 + 1], bgLab[i * 3 + 2],
    );
    // 칠 안 한 흰 픽셀은 파스텔 배경과 우연히 비슷해도 "최대로 티 남"으로 취급
    // (흰 맵이 아닌 한 흰 몸은 언제나 들킨다는 게임 규칙)
    const painted = coverage[i] >= PAINTED_ALPHA;
    const d = painted ? de : Math.max(de, DE_ZERO);
    pixelDE[i] = d;
    deSum += d;
    if (painted) paintedCount++;
  }

  if (maskCount === 0) {
    return {
      score: 0, colorScore: 0, edgeScore: 0, paintedRatio: 0,
      meanDeltaE: 0, meanEdgeDelta: 0, heat, width: w, height: h,
    };
  }

  // 윤곽 대비: 마스크 안쪽 픽셀 중 상하좌우에 바깥 픽셀이 있는 "경계 픽셀"만 검사.
  // 배경 자체에 원래 있던 대비(bg안 vs bg밖)는 빼고, 캐릭터 때문에 "새로 생긴" 대비만 감점.
  const pixelEdge = new Float32Array(n);
  let edgeSum = 0;
  let edgeCount = 0;
  const NX = [1, -1, 0, 0];
  const NY = [0, 0, 1, -1];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let sum = 0;
      let cnt = 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + NX[k];
        const ny = y + NY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; // 버퍼 밖은 비교 불가 → 건너뜀
        const j = ny * w + nx;
        if (mask[j]) continue;
        const withChar = deltaE76(
          chLab[i * 3], chLab[i * 3 + 1], chLab[i * 3 + 2],
          bgLab[j * 3], bgLab[j * 3 + 1], bgLab[j * 3 + 2],
        );
        const original = deltaE76(
          bgLab[i * 3], bgLab[i * 3 + 1], bgLab[i * 3 + 2],
          bgLab[j * 3], bgLab[j * 3 + 1], bgLab[j * 3 + 2],
        );
        sum += Math.max(0, withChar - original);
        cnt++;
      }
      if (cnt > 0) {
        // 칠 안 한 경계 = 흰 테두리가 그대로 보임 → 최대 감점
        const e = coverage[i] >= PAINTED_ALPHA ? sum / cnt : Math.max(sum / cnt, EDGE_ZERO);
        pixelEdge[i] = e;
        edgeSum += e;
        edgeCount++;
      }
    }
  }

  const meanDeltaE = deSum / maskCount;
  const meanEdgeDelta = edgeCount > 0 ? edgeSum / edgeCount : 0;
  const colorScore = toScore(meanDeltaE, DE_ZERO);
  const edgeScore = toScore(meanEdgeDelta, EDGE_ZERO);
  const paintedRatio = paintedCount / maskCount;

  const raw =
    WEIGHTS.color * colorScore + WEIGHTS.edge * edgeScore + WEIGHTS.coverage * paintedRatio;
  const score = Math.round(clamp01(raw) * 100);

  // 히트맵: 픽셀별 (a)+(b) 를 0~1로
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    heat[i] = clamp01(
      Math.max(0, pixelDE[i] - DE_FREE) / DE_ZERO + pixelEdge[i] / EDGE_ZERO,
    );
  }

  return {
    score, colorScore, edgeScore, paintedRatio,
    meanDeltaE, meanEdgeDelta, heat, width: w, height: h,
  };
}

/** 점수 → 별 개수 (0~3) */
export function starsForScore(score: number): number {
  if (score >= 85) return 3;
  if (score >= 65) return 2;
  if (score >= 40) return 1;
  return 0;
}
