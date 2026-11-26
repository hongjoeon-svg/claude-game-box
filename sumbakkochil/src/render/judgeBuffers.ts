// ─────────────────────────────────────────────────────────────
// 캔버스 → 판정용 버퍼 추출 (브라우저 전용 부분)
// 성능을 위해 맵의 1/4 해상도로 줄여서 순수 함수 judgeCamouflage()에 넘깁니다.
// 경계 바깥 비교를 위해 캐릭터 박스 둘레에 MARGIN 픽셀 여유를 둡니다.
// ─────────────────────────────────────────────────────────────
import type { JudgeInput } from '../game/camouflage';
import { BOX_H, BOX_W, type Pose } from './character';
import { makeCanvas } from './draw';

export const JUDGE_SCALE = 0.25;
/** 판정 해상도 기준 여유 픽셀 */
export const JUDGE_MARGIN = 3;
/** 맵 좌표 기준 여유 (배치 가능 범위 계산에 사용) */
export const JUDGE_MARGIN_MAP = JUDGE_MARGIN / JUDGE_SCALE;

/** 큰 이미지를 한 번에 1/8로 줄이면 픽셀이 건너뛰어져 지글거리므로 절반씩 단계적으로 축소 */
function downscale(
  src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number,
  tw: number, th: number,
): HTMLCanvasElement {
  let cur: CanvasImageSource = src;
  let cx = sx, cy = sy, cw = sw, ch = sh;
  while (cw / 2 >= tw && ch / 2 >= th) {
    const [c, ctx] = makeCanvas(Math.ceil(cw / 2), Math.ceil(ch / 2));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, cx, cy, cw, ch, 0, 0, c.width, c.height);
    cur = c; cx = 0; cy = 0; cw = c.width; ch = c.height;
  }
  const [out, octx] = makeCanvas(tw, th);
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(cur, cx, cy, cw, ch, 0, 0, tw, th);
  return out;
}

function pixels(c: HTMLCanvasElement): Uint8ClampedArray {
  return c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
}

/**
 * @param map       1:1 맵 캔버스
 * @param pose      현재 포즈
 * @param charX/Y   캐릭터 박스 좌상단 (맵 좌표)
 * @param paint     칠 레이어 캔버스 (BOX * paintScale 크기, 마스크 밖은 투명)
 */
export function buildJudgeInput(
  map: HTMLCanvasElement, pose: Pose, charX: number, charY: number, paint: HTMLCanvasElement,
): JudgeInput {
  const S = JUDGE_SCALE;
  const M = JUDGE_MARGIN;
  const bw = Math.round(BOX_W * S);
  const bh = Math.round(BOX_H * S);
  const w = bw + M * 2;
  const h = bh + M * 2;

  // 1) 배경: 박스+여유 영역을 잘라 축소
  const bgC = downscale(map, charX - M / S, charY - M / S, w / S, h / S, w, h);

  // 2) 칠 레이어를 박스 크기(판정 해상도)로 축소 → 알파 = 칠한 정도
  const paintSmall = downscale(paint, 0, 0, paint.width, paint.height, bw, bh);

  // 3) 마스크: 실루엣을 판정 해상도로 그려 알파 50% 이상만 1
  const [maskC, mctx] = makeCanvas(w, h);
  mctx.setTransform(S, 0, 0, S, M, M);
  mctx.fill(pose.path);

  // 4) 캐릭터 최종 색 = 흰 실루엣 위에 칠 레이어
  const [chC, cctx] = makeCanvas(w, h);
  cctx.setTransform(S, 0, 0, S, M, M);
  cctx.fillStyle = '#fff';
  cctx.fill(pose.path);
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.drawImage(paintSmall, M, M);

  const [covC, covCtx] = makeCanvas(w, h);
  covCtx.drawImage(paintSmall, M, M);

  const maskPx = pixels(maskC);
  const covPx = pixels(covC);
  const n = w * h;
  const mask = new Uint8Array(n);
  const coverage = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    mask[i] = maskPx[i * 4 + 3] >= 128 ? 1 : 0;
    coverage[i] = covPx[i * 4 + 3];
  }
  return { width: w, height: h, background: pixels(bgC), character: pixels(chC), coverage, mask };
}
