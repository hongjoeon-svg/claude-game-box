// ─────────────────────────────────────────────────────────────
// 화면 스케일링: 기준 해상도 1080x1920(9:16)을 화면에 맞춰 축소/확대.
// 레티나 대응으로 devicePixelRatio 만큼 실제 픽셀을 늘림.
// ─────────────────────────────────────────────────────────────
export const W = 1080;
export const H = 1920;

export class Screen {
  readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  private dpr = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.scale = Math.min(vw / W, vh / H);
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = Math.floor(W * this.scale);
    const cssH = Math.floor(H * this.scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
  }

  /** 매 프레임 시작 시 논리 좌표계로 변환 설정 */
  begin() {
    const k = (this.canvas.width / W);
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  /** 화면(client) 좌표 → 논리 좌표 */
  toLogical(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }
}
