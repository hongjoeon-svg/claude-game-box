// ─────────────────────────────────────────────────────────────
// 실행취소 (최대 20단계)
// 획 하나마다 전체 캔버스를 복사하면 메모리가 커지므로(아이폰 고려),
// "획 직전 상태" 사본을 하나 유지하고, 획이 끝나면 바뀐 영역(bounds)만 잘라 저장합니다.
// ─────────────────────────────────────────────────────────────
export interface Rect { x: number; y: number; w: number; h: number }

interface Entry { rect: Rect; before: ImageData }

export class UndoStack {
  private stack: Entry[] = [];
  private snapshot: HTMLCanvasElement;
  private snapCtx: CanvasRenderingContext2D;

  constructor(private target: HTMLCanvasElement, private max = 20) {
    this.snapshot = document.createElement('canvas');
    this.snapshot.width = target.width;
    this.snapshot.height = target.height;
    this.snapCtx = this.snapshot.getContext('2d', { willReadFrequently: true })!;
    this.sync();
  }

  get size() { return this.stack.length; }

  /** 획이 끝났을 때 호출: rect 영역의 "획 이전" 픽셀을 저장하고 사본을 갱신 */
  commit(rect: Rect) {
    const r = this.clampRect(rect);
    if (r.w <= 0 || r.h <= 0) return;
    const before = this.snapCtx.getImageData(r.x, r.y, r.w, r.h);
    this.stack.push({ rect: r, before });
    if (this.stack.length > this.max) this.stack.shift();
    // 사본에 현재 상태 반영
    this.snapCtx.clearRect(r.x, r.y, r.w, r.h);
    this.snapCtx.drawImage(this.target, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  }

  undo(): boolean {
    const e = this.stack.pop();
    if (!e) return false;
    const ctx = this.target.getContext('2d')!;
    ctx.putImageData(e.before, e.rect.x, e.rect.y);
    this.snapCtx.putImageData(e.before, e.rect.x, e.rect.y);
    return true;
  }

  clear() {
    this.stack = [];
    this.sync();
  }

  private sync() {
    this.snapCtx.clearRect(0, 0, this.snapshot.width, this.snapshot.height);
    this.snapCtx.drawImage(this.target, 0, 0);
  }

  private clampRect(r: Rect): Rect {
    const x = Math.max(0, Math.floor(r.x));
    const y = Math.max(0, Math.floor(r.y));
    const x2 = Math.min(this.target.width, Math.ceil(r.x + r.w));
    const y2 = Math.min(this.target.height, Math.ceil(r.y + r.h));
    return { x, y, w: x2 - x, h: y2 - y };
  }
}
