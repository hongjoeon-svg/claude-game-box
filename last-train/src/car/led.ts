import * as THREE from 'three';
import { font } from './font';

/** 객차 양 끝 전광판. 왼쪽 칸에 진행도 숫자, 오른쪽에 흐르는 안내 문구 */
export class LedBoard {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  private g: CanvasRenderingContext2D;
  private mask: HTMLCanvasElement;
  private lines: string[] = [];
  private lineIdx = 0;
  private scroll = 0;
  private acc = 0;
  digit = '0';
  blackout = false;

  constructor() {
    this.canvas.width = 512;
    this.canvas.height = 64;
    this.g = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    // 도트 매트릭스 느낌을 주는 격자 마스크
    this.mask = document.createElement('canvas');
    this.mask.width = 512;
    this.mask.height = 64;
    const m = this.mask.getContext('2d')!;
    m.fillStyle = 'rgba(0,0,0,0.55)';
    for (let x = 0; x < 512; x += 3) m.fillRect(x, 0, 1, 64);
    for (let y = 0; y < 64; y += 3) m.fillRect(0, y, 512, 1);
  }

  setLines(lines: string[]) {
    this.lines = lines;
    this.lineIdx = 0;
    this.scroll = 0;
    this.redraw();
  }

  update(dt: number) {
    this.scroll += dt * 70;
    this.acc += dt;
    if (this.acc < 1 / 15) return; // 텍스처 업로드는 초당 15회로 제한
    this.acc = 0;
    this.redraw();
  }

  private redraw() {
    const g = this.g;
    g.fillStyle = '#050403';
    g.fillRect(0, 0, 512, 64);
    if (!this.blackout) {
      // 숫자 칸
      g.fillStyle = '#0d1a0d';
      g.fillRect(4, 4, 70, 56);
      g.fillStyle = '#57ff6a';
      g.font = font(54, 900);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(this.digit, 39, 35);
      g.textAlign = 'left';
      // 흐르는 문구
      const text = this.lines[this.lineIdx] ?? '';
      g.save();
      g.beginPath();
      g.rect(84, 0, 424, 64);
      g.clip();
      g.font = font(34, 800);
      g.fillStyle = '#ffae2a';
      const w = g.measureText(text).width;
      const x = 512 - this.scroll;
      g.fillText(text, x, 35);
      g.restore();
      if (x + w < 84) {
        this.scroll = 0;
        this.lineIdx = (this.lineIdx + 1) % Math.max(1, this.lines.length);
      }
    }
    g.drawImage(this.mask, 0, 0);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}
