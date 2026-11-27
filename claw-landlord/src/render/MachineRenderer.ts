// =====================================================================
//  기계 한 대 그리기 (캐비닛 + 내부 + 인형 + 집게 + 연출)
//  지금은 도형 플레이스홀더. 나중에 이미지로 바꿀 때 이 파일만 고치면 됩니다.
// =====================================================================
import { CONFIG } from '../config';
import type { Machine } from '../game/Machine';
import type { Effects } from '../fx/Effects';
import { drawDoll, roundRect, circle } from './drawDoll';

/** 캐비닛 여백 (기계 내부 바깥쪽) */
export const FRAME = { side: 20, top: 62, bottom: 40 };

export class MachineRenderer {
  debug = false;
  private time = 0;

  /** 캐비닛 포함 전체 크기 (기계 좌표) */
  get viewW(): number {
    return CONFIG.machine.width + FRAME.side * 2;
  }
  get viewH(): number {
    return CONFIG.machine.height + FRAME.top + FRAME.bottom;
  }

  /**
   * ctx 는 이미 (캐비닛 왼쪽 위 = 0,0) 기준으로 스케일된 상태여야 합니다.
   */
  draw(ctx: CanvasRenderingContext2D, m: Machine, fx: Effects, dt: number, title: string): void {
    this.time += dt;
    const W = m.W;
    const H = m.H;
    const C = CONFIG.machine;

    // ---------- 캐비닛 ----------
    const cabGrad = ctx.createLinearGradient(0, 0, this.viewW, 0);
    cabGrad.addColorStop(0, '#e2457f');
    cabGrad.addColorStop(0.5, '#ff6fa3');
    cabGrad.addColorStop(1, '#d93a75');
    ctx.fillStyle = cabGrad;
    roundRect(ctx, 0, 0, this.viewW, this.viewH, 22);
    ctx.fill();

    // 간판
    ctx.fillStyle = '#3a1f4d';
    roundRect(ctx, 14, 8, this.viewW - 28, FRAME.top - 16, 14);
    ctx.fill();
    // 반짝이 전구
    const bulbs = 14;
    for (let i = 0; i < bulbs; i++) {
      const x = 26 + ((this.viewW - 52) * i) / (bulbs - 1);
      const on = Math.floor(this.time * 4 + i) % 2 === 0;
      ctx.fillStyle = on ? '#fff3a3' : '#8a6a3a';
      circle(ctx, x, 13, 2.6);
      ctx.fill();
      ctx.fillStyle = on ? '#fff3a3' : '#8a6a3a';
      circle(ctx, x, FRAME.top - 13, 2.6);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 22px "Pretendard", "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = '#ffe14d';
    ctx.shadowColor = '#ff9de0';
    ctx.shadowBlur = 10;
    ctx.fillText(title, this.viewW / 2, FRAME.top / 2 + 1);
    ctx.shadowBlur = 0;

    // ---------- 기계 내부 (흔들림 적용) ----------
    const sh = fx.shakeOffset();
    ctx.save();
    ctx.translate(FRAME.side + sh.x, FRAME.top + sh.y);
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 8);
    ctx.clip();

    // 뒷판
    const back = ctx.createLinearGradient(0, 0, 0, H);
    back.addColorStop(0, '#5b3b8c');
    back.addColorStop(1, '#2e1f55');
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, W, H);
    // 하트 무늬
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 30; y < H; y += 48) {
      for (let x = ((y / 48) % 2) * 24 + 14; x < W; x += 48) {
        circle(ctx, x, y, 5);
        ctx.fill();
      }
    }

    // 배출구 구멍
    const px = m.partitionX;
    ctx.fillStyle = '#140b22';
    ctx.fillRect(C.wall, C.floorY - 6, px - C.wall - 10, H - C.floorY + 6);
    const holeGrad = ctx.createLinearGradient(0, C.floorY - 70, 0, H);
    holeGrad.addColorStop(0, 'rgba(255,225,77,0)');
    holeGrad.addColorStop(1, 'rgba(255,225,77,0.22)');
    ctx.fillStyle = holeGrad;
    ctx.fillRect(C.wall, C.floorY - 70, px - C.wall - 10, H - C.floorY + 70);
    // 바닥 (카펫)
    ctx.fillStyle = '#ff9ec4';
    ctx.fillRect(px, C.floorY, W - px, H - C.floorY);
    ctx.fillStyle = '#f57fb0';
    for (let x = px; x < W; x += 12) ctx.fillRect(x, C.floorY, 6, 4);
    // 칸막이 (투명 아크릴)
    ctx.fillStyle = 'rgba(200,235,255,0.55)';
    roundRect(ctx, px - 10, C.floorY - C.chuteWallHeight, 10, C.chuteWallHeight + 40, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 배출구 표시
    const arrowY = C.floorY - C.chuteWallHeight - 22 + Math.sin(this.time * 5) * 3;
    ctx.font = '800 13px "Pretendard", "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('배출구', m.homeX, C.floorY + 6);
    ctx.font = '900 18px sans-serif';
    ctx.fillText('▼', m.homeX, arrowY);
    // 벽
    ctx.fillStyle = '#7f5bb8';
    ctx.fillRect(0, 0, C.wall, H);
    ctx.fillRect(W - C.wall, 0, C.wall, H);

    // ---------- 인형 ----------
    const held: typeof m.dolls = [];
    for (const d of m.dolls) {
      if (d.state === 'held') {
        held.push(d);
        continue;
      }
      this.drawDollBody(ctx, d.body.position.x, d.body.position.y, d.body.angle, d.def);
    }

    // ---------- 레일 · 대차 · 줄 ----------
    const railY = C.railY;
    ctx.fillStyle = '#c8c8d8';
    ctx.fillRect(C.wall, railY - 22, W - C.wall * 2, 6);
    ctx.fillStyle = '#9a9ab0';
    ctx.fillRect(C.wall, railY - 16, W - C.wall * 2, 2);
    const tx = m.trolleyX;
    ctx.fillStyle = '#4b4b63';
    roundRect(ctx, tx - 22, railY - 30, 44, 18, 5);
    ctx.fill();
    ctx.fillStyle = '#ff5d8f';
    circle(ctx, tx, railY - 21, 3);
    ctx.fill();
    // 줄 (흔들림 따라 살짝 휨)
    const hx = m.headX;
    const hy = m.headY;
    const c = CONFIG.claw;
    ctx.strokeStyle = '#d9d9e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, railY - 12);
    ctx.quadraticCurveTo(tx + (hx - tx) * 0.3, (railY + hy) / 2, hx, hy - c.headHeight / 2);
    ctx.stroke();

    // 잡힌 인형은 집게발 뒤에
    for (const d of held) this.drawDollBody(ctx, d.body.position.x, d.body.position.y, d.body.angle, d.def);

    // ---------- 집게 ----------
    this.drawClaw(ctx, m);

    // 유리 반사
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(W * 0.55, 0);
    ctx.lineTo(W * 0.72, 0);
    ctx.lineTo(W * 0.32, H);
    ctx.lineTo(W * 0.15, H);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.moveTo(W * 0.78, 0);
    ctx.lineTo(W * 0.83, 0);
    ctx.lineTo(W * 0.43, H);
    ctx.lineTo(W * 0.38, H);
    ctx.fill();

    if (this.debug) this.drawDebug(ctx, m);

    // 연출 (기계 좌표)
    fx.draw(ctx, W);
    ctx.restore(); // clip
    ctx.restore(); // translate

    // 아래 받침 (코인 투입구 장식)
    ctx.fillStyle = '#3a1f4d';
    roundRect(ctx, this.viewW / 2 - 40, this.viewH - FRAME.bottom + 10, 80, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.font = '800 11px "Pretendard", sans-serif';
    ctx.fillText('FREE PLAY', this.viewW / 2, this.viewH - FRAME.bottom + 20);
  }

  private drawDollBody(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, def: Parameters<typeof drawDoll>[1]): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    drawDoll(ctx, def);
    ctx.restore();
  }

  private drawClaw(ctx: CanvasRenderingContext2D, m: Machine): void {
    const c = CONFIG.claw;
    const jitter = m.wobbleAmount * Math.sin(this.time * 55) * 1.2;
    const hx = m.headX + jitter;
    const hy = m.headY;

    // 집게발 (팔 + 갈고리)
    for (const p of m.prongs) {
      const g = m.prongGeometry(p, hx, hy);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#6d6d86';
      ctx.lineWidth = c.armThickness + 3;
      ctx.beginPath();
      ctx.moveTo(g.pivot.x, g.pivot.y);
      ctx.lineTo(g.elbow.x, g.elbow.y);
      ctx.lineTo(g.end.x, g.end.y);
      ctx.stroke();
      ctx.strokeStyle = '#e6e6f2';
      ctx.lineWidth = c.armThickness - 1;
      ctx.stroke();
      ctx.fillStyle = '#ff5d8f';
      circle(ctx, g.end.x, g.end.y, 3);
      ctx.fill();
    }
    // 몸통
    const bodyGrad = ctx.createLinearGradient(hx - c.headWidth / 2, 0, hx + c.headWidth / 2, 0);
    bodyGrad.addColorStop(0, '#9a9ab4');
    bodyGrad.addColorStop(0.5, '#f0f0fa');
    bodyGrad.addColorStop(1, '#8a8aa6');
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, hx - c.headWidth / 2, hy - c.headHeight / 2, c.headWidth, c.headHeight, 8);
    ctx.fill();
    ctx.strokeStyle = '#55556d';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 상태 램프
    const busy = m.state !== 'idle';
    ctx.fillStyle = busy ? (Math.floor(this.time * 8) % 2 ? '#ff5d5d' : '#7a2b2b') : '#5dff9b';
    circle(ctx, hx, hy, 3.5);
    ctx.fill();
    for (const p of m.prongs) {
      const g = m.prongGeometry(p, hx, hy);
      ctx.fillStyle = '#55556d';
      circle(ctx, g.pivot.x, g.pivot.y, 3.2);
      ctx.fill();
    }

    // 조준선 (대기 중일 때만, 아래로 점선)
    if (m.state === 'idle') {
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx, hy + c.headHeight / 2 + 4);
      ctx.lineTo(hx, CONFIG.machine.floorY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawDebug(ctx: CanvasRenderingContext2D, m: Machine): void {
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1;
    for (const b of [m.head, ...m.prongs.flatMap((p) => [p.arm, p.tip])]) {
      ctx.beginPath();
      b.vertices.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,0,0.6)';
    for (const d of m.dolls) {
      const b = d.body;
      ctx.beginPath();
      b.vertices.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`state: ${m.state}`, 18, 16);
    if (m.lastGrab) {
      const g = m.lastGrab;
      ctx.fillText(`잡힌정도 ${(g.quality * 100).toFixed(0)}%  버틸확률 ${(g.holdChance * 100).toFixed(0)}%`, 18, 30);
      ctx.fillText(`결과 ${g.willHold ? '성공' : '놓침(' + g.dropPhase + ')'}`, 18, 44);
    }
    ctx.textAlign = 'center';
  }
}
