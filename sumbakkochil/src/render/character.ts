// ─────────────────────────────────────────────────────────────
// 캐릭터 실루엣: 둥근 젤리 같은 단순한 사람 모양.
// 모든 좌표는 "캐릭터 박스"(BOX_W x BOX_H, 맵 픽셀 단위) 기준.
// 실루엣은 Path2D 하나로 만들어 마스크/클리핑/판정에 그대로 씁니다.
// ─────────────────────────────────────────────────────────────
import { makeCanvas } from './draw';
import { OUTLINE } from './theme';

export const BOX_W = 240;
export const BOX_H = 420;

export type PoseId = 'stand' | 'crouch' | 'wall';

export interface Pose {
  id: PoseId;
  name: string;
  path: Path2D;
  /** 칠하기 클리핑용 (살짝 부풀린 실루엣) */
  paintClip: Path2D;
  /** 눈 위치 (배치 단계에서만 그림) */
  eyes: [number, number, number, number];
}

/** 두 점을 잇는 캡슐(둥근 막대) — 팔다리용. 시계 방향으로 그려 합집합이 깨지지 않게 함 */
function capsule(p: Path2D, x1: number, y1: number, x2: number, y2: number, r: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  p.moveTo(x1 + Math.cos(ang + Math.PI / 2) * r, y1 + Math.sin(ang + Math.PI / 2) * r);
  p.arc(x1, y1, r, ang + Math.PI / 2, ang - Math.PI / 2);
  p.arc(x2, y2, r, ang - Math.PI / 2, ang + Math.PI / 2);
  p.closePath();
}

/** 둥근 사각형 서브패스 (시계 방향) */
function roundRect(p: Path2D, x: number, y: number, w: number, h: number, r: number) {
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
}

function circle(p: Path2D, x: number, y: number, r: number) {
  p.moveTo(x + r, y);
  p.arc(x, y, r, 0, Math.PI * 2);
  p.closePath();
}

/** g: 바깥으로 부풀리는 양(px). 칠하기 클리핑용으로 살짝 큰 실루엣이 필요해서 파라미터화 */
function standPath(g = 0): Path2D {
  const p = new Path2D();
  circle(p, 120, 82, 68 + g); // 큰 머리
  roundRect(p, 44 - g, 128 - g, 152 + g * 2, 206 + g * 2, 72 + g); // 젤리 몸통
  capsule(p, 62, 180, 30, 292, 25 + g); // 왼팔
  capsule(p, 178, 180, 210, 292, 25 + g); // 오른팔
  capsule(p, 92, 320, 88, 392, 28 + g); // 왼다리
  capsule(p, 148, 320, 152, 392, 28 + g); // 오른다리
  return p;
}

/**
 * 칠하기 클리핑은 실제 실루엣보다 CLIP_GROW 만큼 크게 잡고,
 * 화면에 그릴 때 정확한 실루엣으로 한 번 더 잘라냄.
 * (정확한 실루엣으로 바로 클리핑하면 안티앨리어싱 때문에 테두리에 흰 띠가 남음)
 */
const CLIP_GROW = 3;

// Phase 3에서 웅크리기/벽에 붙기 포즈를 추가합니다.
export const POSES: Record<'stand', Pose> = {
  stand: { id: 'stand', name: '서기', path: standPath(), paintClip: standPath(CLIP_GROW), eyes: [96, 78, 144, 78] },
};

/** 실루엣 흰 바탕 (칠하기 전 상태) — scale배 해상도 */
export function renderWhiteBase(pose: Pose, scale: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(BOX_W * scale, BOX_H * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fill(pose.path);
  return c;
}

/**
 * 실루엣 바깥쪽 외곽선만 남긴 캔버스.
 * 패스를 굵게 stroke 한 뒤 안쪽을 지워서, 팔/몸이 겹치는 부분의 내부 선이 안 보이게 함.
 * 박스 밖으로 pad 만큼 여유를 둠.
 */
export function renderOutline(pose: Pose, scale: number, width: number, pad: number, color = OUTLINE) {
  const [c, ctx] = makeCanvas((BOX_W + pad * 2) * scale, (BOX_H + pad * 2) * scale);
  ctx.scale(scale, scale);
  ctx.translate(pad, pad);
  ctx.lineJoin = 'round';
  ctx.lineWidth = width * 2;
  ctx.strokeStyle = color;
  ctx.stroke(pose.path);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(pose.path);
  return c;
}

/**
 * 화면 표시용 캐릭터 합성: 흰 바탕 + 칠 레이어를 정확한 실루엣으로 잘라냄.
 * out 캔버스는 칠 레이어와 같은 크기여야 함.
 */
export function composeCharacter(out: HTMLCanvasElement, pose: Pose, paint: HTMLCanvasElement, scale: number) {
  const ctx = out.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, out.width, out.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(paint, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fill(pose.path);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}
