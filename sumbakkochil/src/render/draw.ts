// 캔버스 그리기 헬퍼
import { FONT, OUTLINE, OUTLINE_W } from './theme';

export type Ctx = CanvasRenderingContext2D;

export function rrPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 굵은 외곽선이 있는 둥근 사각형 */
export function box(
  ctx: Ctx, x: number, y: number, w: number, h: number, r: number,
  fill: string, stroke: string | null = OUTLINE, lw = OUTLINE_W,
) {
  rrPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: number;
  stroke?: string;
  strokeW?: number;
}

export function text(ctx: Ctx, s: string, x: number, y: number, o: TextOpts = {}) {
  ctx.font = `${o.weight ?? 800} ${o.size ?? 48}px ${FONT}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.baseline ?? 'middle';
  if (o.stroke) {
    ctx.lineWidth = o.strokeW ?? 10;
    ctx.strokeStyle = o.stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = o.color ?? OUTLINE;
  ctx.fillText(s, x, y);
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d', { willReadFrequently: false })!;
  return [c, ctx];
}
