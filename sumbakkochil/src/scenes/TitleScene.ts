// 타이틀 화면
import { STAGES } from '../data/stages';
import { BOX_H, BOX_W, POSES, renderOutline, renderWhiteBase } from '../render/character';
import { makeCanvas, text, type Ctx } from '../render/draw';
import { renderMap } from '../render/maps';
import { C, OUTLINE } from '../render/theme';
import { getSave } from '../storage/storage';
import { Button, ButtonGroup, type Pt } from '../ui/button';
import { GameScene } from './GameScene';
import type { Scene, SceneHost } from './scene';

export class TitleScene implements Scene {
  private t = 0;
  private bg: HTMLCanvasElement;
  private mascot: HTMLCanvasElement;
  private outline: HTMLCanvasElement;
  private buttons = new ButtonGroup();

  constructor(private host: SceneHost) {
    const st = STAGES[0];
    this.bg = renderMap(st.mapId, st.detail, st.seed);
    // 마스코트: 반쯤 칠하다 만 젤리 (줄무늬로 반만 위장)
    const pose = POSES.stand;
    const [m, ctx] = makeCanvas(BOX_W, BOX_H);
    ctx.drawImage(renderWhiteBase(pose, 1), 0, 0);
    ctx.save();
    ctx.clip(pose.path);
    const cols = [C.pink, C.mint, C.yellow];
    for (let y = 0, i = 0; y < BOX_H * 0.55; y += 40, i++) {
      ctx.fillStyle = cols[i % 3];
      ctx.fillRect(BOX_W / 2, y, BOX_W / 2, 40);
    }
    ctx.restore();
    this.mascot = m;
    this.outline = renderOutline(pose, 1, 6, 10);

    this.buttons.add(new Button(240, 1500, 600, 150, '시작하기', () => {
      this.host.go(new GameScene(this.host, STAGES[0]));
    }, { fill: C.mint, size: 60 }));
  }

  update(dt: number) { this.t += dt; }

  render(ctx: Ctx) {
    ctx.drawImage(this.bg, 0, 0);
    ctx.fillStyle = 'rgba(255,246,232,0.82)';
    ctx.fillRect(0, 0, 1080, 1920);

    const wob = Math.sin(this.t * 2) * 0.03;
    ctx.save();
    ctx.translate(540, 380);
    ctx.rotate(wob);
    text(ctx, '숨바꼭칠', 0, 0, { size: 170, color: C.pink, stroke: OUTLINE, strokeW: 22 });
    ctx.restore();
    text(ctx, '몸에 색을 칠해서 배경에 숨어라!', 540, 540, { size: 44 });

    // 마스코트
    const bob = Math.sin(this.t * 3) * 10;
    const x = 540 - BOX_W / 2;
    const y = 760 + bob;
    ctx.fillStyle = 'rgba(43,36,64,0.2)';
    ctx.beginPath();
    ctx.ellipse(540, 760 + BOX_H - 4, 100, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(this.mascot, x, y);
    ctx.drawImage(this.outline, x - 10, y - 10);
    ctx.fillStyle = OUTLINE;
    const [ex1, ey1, ex2, ey2] = POSES.stand.eyes;
    ctx.beginPath(); ctx.ellipse(x + ex1, y + ey1, 9, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + ex2, y + ey2, 9, 13, 0, 0, Math.PI * 2); ctx.fill();
    text(ctx, '반만 숨음…', 540 + 200, 800 + bob, { size: 34, color: '#7a6f94' });

    this.buttons.draw(ctx);
    const best = getSave().best[STAGES[0].id];
    if (best !== undefined) text(ctx, `편의점 1 최고 점수: ${best}점`, 540, 1720, { size: 34, weight: 700 });
    text(ctx, 'Phase 1 프로토타입', 540, 1860, { size: 26, weight: 600, color: '#9a90b0' });
  }

  pointerDown(p: Pt) { this.buttons.down(p); }
  pointerMove(p: Pt) { this.buttons.move(p); }
  pointerUp(p: Pt) { this.buttons.up(p); }
}
