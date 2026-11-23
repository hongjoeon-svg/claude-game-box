import * as THREE from 'three';
import type { SignState } from './config';
import { normalDoorNumbers } from './config';
import { font } from './font';
import { LINE_NAME, STATIONS, nextStationIndex } from '../core/stations';
import type { UVRect } from './geo';

interface Cell { x: number; y: number; w: number; h: number }

const AW = 2048;
const AH = 1024;

/** 광고 0번(치과) 얼굴의 눈 위치 (셀 픽셀 좌표) — 3D 눈동자 배치에 사용 */
export const AD_EYES = [
  { x: 132, y: 150, r: 17 },
  { x: 196, y: 150, r: 17 },
];
export const AD_CELL = { w: 640, h: 320 };
export const ROUTE_LINE_COLOR = '#7b55d6';

/**
 * 객차 안 모든 정적 표지(노선도·광고·문 번호·스티커·배려석·차량 번호)를
 * 한 장의 캔버스(아틀라스)에 그린다 → 표지 전체가 드로우콜 1회.
 */
export class SignAtlas {
  readonly canvas = document.createElement('canvas');
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  readonly cells: Record<string, Cell> = {};

  constructor(maxAniso: number) {
    this.canvas.width = AW;
    this.canvas.height = AH;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = Math.min(4, maxAniso);
    const c = this.cells;
    c.route = { x: 0, y: 0, w: 1024, h: 192 };
    c.routeAlt = { x: 1024, y: 0, w: 1024, h: 192 };
    for (let i = 0; i < 3; i++) c['ad' + i] = { x: i * 640, y: 192, w: 640, h: 320 };
    for (let i = 0; i < 8; i++) c['door' + i] = { x: i * 160, y: 512, w: 160, h: 80 };
    c.sticker = { x: 1280, y: 512, w: 256, h: 128 };
    c.priority = { x: 1536, y: 512, w: 512, h: 128 };
    c.plate = { x: 0, y: 640, w: 256, h: 96 };
    c.dir = { x: 256, y: 640, w: 512, h: 96 };
    c.intercom = { x: 768, y: 640, w: 256, h: 128 };
  }

  uv(name: string): UVRect {
    const c = this.cells[name];
    const pad = 2;
    return {
      u0: (c.x + pad) / AW,
      u1: (c.x + c.w - pad) / AW,
      v1: 1 - (c.y + pad) / AH,
      v0: 1 - (c.y + c.h - pad) / AH,
    };
  }

  draw(state: SignState, count: number, terminal: boolean) {
    const g = this.ctx;
    g.fillStyle = '#000';
    g.fillRect(0, 0, AW, AH);
    this.drawRoute(this.cells.route, count, terminal, null);
    this.drawRoute(this.cells.routeAlt, count, terminal, state.routeOverride);
    this.drawAd0(this.cells.ad0);
    this.drawAd1(this.cells.ad1);
    this.drawAd2(this.cells.ad2, state.adOverride?.ad === 2 ? state.adOverride.lines : null);
    const nums = state.doorNumbers ?? normalDoorNumbers();
    for (let i = 0; i < 8; i++) this.drawDoorNumber(this.cells['door' + i], nums[i]);
    this.drawSticker(this.cells.sticker, state.mirrorStickers);
    this.drawPriority(this.cells.priority);
    this.drawPlate(this.cells.plate, state.carNumber);
    this.drawDir(this.cells.dir);
    this.drawIntercom(this.cells.intercom);
    this.texture.needsUpdate = true;
  }

  private clip(c: Cell) {
    const g = this.ctx;
    g.save();
    g.beginPath();
    g.rect(c.x, c.y, c.w, c.h);
    g.clip();
    g.translate(c.x, c.y);
  }

  private drawRoute(c: Cell, count: number, terminal: boolean, ov: SignState['routeOverride']) {
    const g = this.ctx;
    this.clip(c);
    g.fillStyle = '#f4f3ee';
    g.fillRect(0, 0, c.w, c.h);
    // 상단 띠
    g.fillStyle = ROUTE_LINE_COLOR;
    g.fillRect(0, 0, c.w, 34);
    g.fillStyle = '#fff';
    g.font = font(22, 800);
    g.textBaseline = 'middle';
    g.fillText(`${LINE_NAME}  노선 안내`, 16, 18);
    g.font = font(16, 500);
    g.textAlign = 'right';
    g.fillText('자정 ↔ 새벽 · 막차', c.w - 16, 18);
    g.textAlign = 'center';
    const n = STATIONS.length;
    const x0 = 56;
    const x1 = c.w - 56;
    const ly = 98;
    const next = terminal ? n - 1 : nextStationIndex(count);
    // 노선 선
    g.lineCap = 'round';
    g.lineWidth = 12;
    g.strokeStyle = '#b9b6ae';
    g.beginPath();
    g.moveTo(x0, ly);
    g.lineTo(x1, ly);
    g.stroke();
    const sx = (i: number) => x0 + ((x1 - x0) * i) / (n - 1);
    g.strokeStyle = ROUTE_LINE_COLOR;
    g.beginPath();
    g.moveTo(sx(next - 1), ly);
    g.lineTo(x1, ly);
    g.stroke();
    for (let i = 0; i < n; i++) {
      const x = sx(i);
      const passed = i < next;
      const isNext = i === next;
      g.beginPath();
      g.arc(x, ly, isNext ? 13 : 10, 0, Math.PI * 2);
      g.fillStyle = '#fff';
      g.fill();
      g.lineWidth = isNext ? 6 : 4;
      g.strokeStyle = isNext ? '#d6283a' : passed ? '#9b988f' : ROUTE_LINE_COLOR;
      g.stroke();
      const name = ov && ov.station === i ? ov.text : STATIONS[i];
      const up = i % 2 === 1;
      g.font = font(isNext ? 24 : 21, isNext ? 800 : 600);
      g.fillStyle = passed ? '#9b988f' : isNext ? '#c41f30' : '#222';
      g.fillText(name, x, up ? ly - 34 : ly + 38);
      if (isNext) {
        g.font = font(15, 700);
        g.fillStyle = '#c41f30';
        g.fillText('다음', x, up ? ly + 32 : ly - 30);
      }
    }
    g.font = font(15, 500);
    g.fillStyle = '#6a675f';
    g.textAlign = 'left';
    g.fillText('● 지나온 역은 회색으로 표시됩니다', 16, c.h - 14);
    g.restore();
    g.textAlign = 'left';
  }

  /** 치과 광고 — 얼굴의 눈동자는 3D 메시로 따로 올린다 */
  private drawAd0(c: Cell) {
    const g = this.ctx;
    this.clip(c);
    const grd = g.createLinearGradient(0, 0, c.w, c.h);
    grd.addColorStop(0, '#f7e9e4');
    grd.addColorStop(1, '#e6eef3');
    g.fillStyle = grd;
    g.fillRect(0, 0, c.w, c.h);
    // 얼굴
    const fx = 164;
    const fy = 175;
    g.fillStyle = '#3a2a22';
    g.beginPath();
    g.ellipse(fx, fy - 22, 104, 112, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillRect(fx - 104, fy - 24, 24, 120);
    g.fillRect(fx + 80, fy - 24, 24, 120);
    g.fillStyle = '#efd2bd';
    g.beginPath();
    g.ellipse(fx, fy, 84, 104, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2a22';
    g.beginPath();
    g.ellipse(fx, fy - 70, 90, 42, 0, Math.PI, Math.PI * 2);
    g.fill();
    // 눈썹
    g.strokeStyle = '#3a2a22';
    g.lineWidth = 6;
    g.lineCap = 'round';
    for (const e of AD_EYES) {
      g.beginPath();
      g.moveTo(e.x - 20, e.y - 30);
      g.quadraticCurveTo(e.x, e.y - 38, e.x + 20, e.y - 30);
      g.stroke();
    }
    // 흰자
    for (const e of AD_EYES) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(e.x, e.y, e.r + 6, e.r, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#6b4a3a';
      g.lineWidth = 2.5;
      g.stroke();
    }
    // 코, 웃는 입
    g.strokeStyle = '#c99c84';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(fx, fy - 4);
    g.lineTo(fx - 8, fy + 26);
    g.lineTo(fx + 4, fy + 28);
    g.stroke();
    g.fillStyle = '#fff';
    g.strokeStyle = '#b5524f';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(fx - 44, fy + 46);
    g.quadraticCurveTo(fx, fy + 92, fx + 44, fy + 46);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = '#ddd';
    g.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(fx + i * 11, fy + 48);
      g.lineTo(fx + i * 11, fy + 58);
      g.stroke();
    }
    // 문구
    g.fillStyle = '#1d6c8c';
    g.font = font(70, 900);
    g.fillText('미소치과', 300, 120);
    g.fillStyle = '#333';
    g.font = font(28, 600);
    g.fillText('밤 11시까지 진료합니다', 304, 172);
    g.font = font(24, 500);
    g.fillStyle = '#555';
    g.fillText('당신의 미소를 지켜보고 있습니다', 304, 214);
    g.fillStyle = '#1d6c8c';
    g.fillRect(300, 246, 300, 42);
    g.fillStyle = '#fff';
    g.font = font(24, 700);
    g.fillText('은하동역 3번 출구 앞', 316, 276);
    g.restore();
  }

  private drawAd1(c: Cell) {
    const g = this.ctx;
    this.clip(c);
    g.fillStyle = '#14203a';
    g.fillRect(0, 0, c.w, c.h);
    g.fillStyle = ROUTE_LINE_COLOR;
    g.fillRect(0, 0, 18, c.h);
    g.fillStyle = '#ffd56a';
    g.font = font(30, 800);
    g.fillText(`${LINE_NAME} 이용 안내`, 50, 64);
    g.fillStyle = '#fff';
    g.font = font(52, 900);
    g.fillText('막차는 00:40', 50, 138);
    g.font = font(26, 500);
    g.fillStyle = '#c8d2e8';
    g.fillText('이 열차는 오늘의 마지막 열차입니다.', 50, 192);
    g.fillText('주무시는 승객이 있으면 깨워 주세요.', 50, 230);
    g.font = font(20, 500);
    g.fillStyle = '#8b97b3';
    g.fillText('종착역에 도착하면 모든 승객은 내려야 합니다.', 50, 282);
    g.restore();
  }

  private drawAd2(c: Cell, override: string[] | null) {
    const g = this.ctx;
    this.clip(c);
    const grd = g.createLinearGradient(0, 0, 0, c.h);
    grd.addColorStop(0, '#f2a14a');
    grd.addColorStop(1, '#d9662e');
    g.fillStyle = grd;
    g.fillRect(0, 0, c.w, c.h);
    // 뚝배기
    g.fillStyle = '#3b2418';
    g.beginPath();
    g.ellipse(490, 210, 120, 70, 0, 0, Math.PI);
    g.fill();
    g.fillStyle = '#fff1d8';
    g.beginPath();
    g.ellipse(490, 205, 120, 26, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.75)';
    g.lineWidth = 6;
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      const x = 450 + i * 40;
      g.moveTo(x, 170);
      g.bezierCurveTo(x - 20, 140, x + 20, 120, x, 90);
      g.stroke();
    }
    const lines = override ?? ['새벽국밥', '24시 · 따뜻한 한 그릇'];
    g.fillStyle = '#fff';
    g.font = font(72, 900);
    g.fillText(lines[0], 36, 130, 360);
    g.font = font(28, 700);
    g.fillStyle = '#fff6e6';
    g.fillText(lines[1], 40, 182, 360);
    g.font = font(22, 500);
    g.fillStyle = '#4a230f';
    g.fillText('등불시장역 2번 출구', 40, 270);
    g.restore();
  }

  private drawDoorNumber(c: Cell, text: string) {
    const g = this.ctx;
    this.clip(c);
    g.fillStyle = '#1f5b45';
    g.fillRect(0, 0, c.w, c.h);
    g.fillStyle = '#fff';
    g.font = font(54, 800);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.w / 2, c.h / 2 + 3);
    g.restore();
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  private drawSticker(c: Cell, mirror: boolean) {
    const g = this.ctx;
    this.clip(c);
    if (mirror) {
      g.translate(c.w, 0);
      g.scale(-1, 1);
    }
    g.fillStyle = '#f2c230';
    g.fillRect(0, 0, c.w, c.h);
    g.fillStyle = '#1a1a1a';
    g.fillRect(6, 6, c.w - 12, 4);
    g.fillRect(6, c.h - 10, c.w - 12, 4);
    g.font = font(36, 900);
    g.textAlign = 'center';
    g.fillText('기대지 마세요', c.w / 2, 60);
    g.font = font(24, 700);
    g.fillText('문에 손 끼임 주의', c.w / 2, 98);
    g.restore();
    g.textAlign = 'left';
  }

  private drawPriority(c: Cell) {
    const g = this.ctx;
    this.clip(c);
    g.fillStyle = '#e46a7c';
    g.fillRect(0, 0, c.w, c.h);
    g.fillStyle = '#fff';
    g.font = font(40, 800);
    g.textAlign = 'center';
    g.fillText('노약자 · 장애인 · 임산부', c.w / 2, 58);
    g.font = font(30, 700);
    g.fillText('배려석', c.w / 2, 100);
    g.restore();
    g.textAlign = 'left';
  }

  private drawPlate(c: Cell, num: string) {
    const g = this.ctx;
    this.clip(c);
    g.fillStyle = '#c9ccd0';
    g.fillRect(0, 0, c.w, c.h);
    g.fillStyle = '#222';
    g.font = font(62, 800);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(num, c.w / 2, c.h / 2 + 3);
    g.restore();
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  private drawDir(c: Cell) {
    const g = this.ctx;
    this.clip(c);
    g.fillStyle = '#20242a';
    g.fillRect(0, 0, c.w, c.h);
    g.fillStyle = '#e8e8e8';
    g.font = font(40, 700);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('연결 통로 · 비상시 이용', c.w / 2, c.h / 2 + 2);
    g.restore();
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  private drawIntercom(c: Cell) {
    const g = this.ctx;
    this.clip(c);
    g.fillStyle = '#d8312d';
    g.fillRect(0, 0, c.w, c.h);
    g.fillStyle = '#fff';
    g.font = font(34, 800);
    g.textAlign = 'center';
    g.fillText('비상 인터폰', c.w / 2, 56);
    g.font = font(22, 600);
    g.fillText('버튼을 누르고 말하세요', c.w / 2, 98);
    g.restore();
    g.textAlign = 'left';
  }
}
