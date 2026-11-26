// ─────────────────────────────────────────────────────────────
// 게임 한 판: 배치(5초) → 칠하기(30초) → (Phase 2: 술래) → 결과
// ─────────────────────────────────────────────────────────────
import type { StageDef } from '../data/stages';
import { judgeCamouflage, starsForScore, type JudgeResult } from '../game/camouflage';
import { rgbToHex } from '../game/color';
import { UndoStack } from '../game/undo';
import { BOX_H, BOX_W, composeCharacter, POSES, renderOutline, type Pose } from '../render/character';
import { box, makeCanvas, text, type Ctx } from '../render/draw';
import { buildJudgeInput, JUDGE_MARGIN_MAP } from '../render/judgeBuffers';
import { drawMap, MAP_H, MAP_NAMES, MAP_W, renderMap } from '../render/maps';
import { C, OUTLINE } from '../render/theme';
import { getSave, recordScore } from '../storage/storage';
import { Button, ButtonGroup, type Pt } from '../ui/button';
import { drawHint, drawHud, HUD_H } from '../ui/hud';
import type { Scene, SceneHost } from './scene';
import { TitleScene } from './TitleScene';

type Phase = 'place' | 'paint' | 'judging' | 'result';
type Tool = 'brush' | 'picker';

/** 칠 레이어 해상도 배율 (맵 1px = 칠 2px → 확대 화면에서도 부드럽게) */
const PS = 2;
/** 칠하기 화면의 확대 뷰 영역 */
const VP = { x: 0, y: HUD_H, w: 1080, h: 1500 - HUD_H };
/** 브러시 지름 (맵 px) — 소/중/대 */
const BRUSH = [10, 22, 40];
const MAX_RECENT = 5;

/** 배치 가능한 캐릭터 박스 좌상단 범위 (판정용 여유 + HUD/버튼 피하기) */
const PLACE = {
  minX: JUDGE_MARGIN_MAP,
  maxX: MAP_W - BOX_W - JUDGE_MARGIN_MAP,
  minY: HUD_H + 10,
  maxY: MAP_H - BOX_H - 210,
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** 점수대별 B급 한 줄평 */
function commentFor(score: number, paintedRatio: number): string {
  if (paintedRatio < 0.5) return '하얗게 빛나는 중… 눈부셔요 ✨';
  if (score >= 90) return '술래: …여기 아무도 없는데? (있음)';
  if (score >= 75) return '눈 크게 떠야 보여요. 프로 위장러!';
  if (score >= 55) return '음… 저 진열대 좀 수상한데?';
  if (score >= 35) return '어… 저 과자 봉지 사람인데요?';
  return '색이 완전 딴판이에요! 스포이드를 써 봐요';
}

export class GameScene implements Scene {
  private phase: Phase = 'place';
  private timeLeft = 0;
  private t = 0; // 연출용 누적 시간

  // 맵/캐릭터
  private map: HTMLCanvasElement;
  private mapData: ImageData;
  private pose: Pose = POSES.stand;
  private charX = (MAP_W - BOX_W) / 2;
  private charY = 900;
  /** 화면 표시용 합성 캐릭터 (칠이 바뀔 때만 다시 합성) */
  private charImg: HTMLCanvasElement;
  private charDirty = true;
  private outline: HTMLCanvasElement;
  private readonly OUTLINE_PAD = 10;

  // 배치 단계
  private dragOffset: Pt | null = null;

  // 칠하기 단계
  private paint: HTMLCanvasElement;
  private paintCtx: CanvasRenderingContext2D;
  private undo: UndoStack;
  private tool: Tool = 'brush';
  private brushIdx = 1;
  private color = '#ffb3c7';
  private recent: string[] = [];
  private stroke: { last: Pt; minX: number; minY: number; maxX: number; maxY: number } | null = null;
  private pickerDown = false;
  private zoom = 1;
  private viewCX = 0;
  private viewCY = 0;
  private zoomBg: HTMLCanvasElement | null = null;
  /** 안내 말풍선 남은 표시 시간 (칠하기 화면을 가리지 않게 잠깐만) */
  private hintT = 0;
  private pops: { x: number; y: number; color: string; t: number }[] = [];

  // 결과
  private result: JudgeResult | null = null;
  private stars = 0;
  private isBest = false;
  private preview: HTMLCanvasElement | null = null;
  private previewOutline: HTMLCanvasElement | null = null;
  private revealing = false;
  private resultT = 0;

  private buttons: ButtonGroup;
  private placeButtons = new ButtonGroup();
  private paintButtons = new ButtonGroup();
  private resultButtons = new ButtonGroup();
  private toolButtons: Record<Tool, Button>;
  private sizeButtons: Button[] = [];
  private recentButtons: Button[] = [];
  private undoButton: Button;

  constructor(private host: SceneHost, private stage: StageDef) {
    this.map = renderMap(stage.mapId, stage.detail, stage.seed);
    this.mapData = this.map.getContext('2d')!.getImageData(0, 0, MAP_W, MAP_H);
    this.outline = renderOutline(this.pose, PS, 5, this.OUTLINE_PAD);
    [this.paint, this.paintCtx] = makeCanvas(BOX_W * PS, BOX_H * PS);
    [this.charImg] = makeCanvas(BOX_W * PS, BOX_H * PS);
    this.undo = new UndoStack(this.paint, 20);
    this.timeLeft = stage.placeTime;

    // ── 배치 단계 버튼 ──
    this.placeButtons.add(new Button(240, 1745, 600, 130, '여기 숨을래!', () => this.startPaint(), { fill: C.mint, size: 54 }));

    // ── 칠하기 단계 버튼 ──
    const pb = this.paintButtons;
    this.toolButtons = {
      brush: pb.add(new Button(30, 1530, 250, 124, '🖌 브러시', () => this.setTool('brush'), { size: 40 })),
      picker: pb.add(new Button(296, 1530, 250, 124, '💧 스포이드', () => this.setTool('picker'), { size: 40 })),
    };
    this.undoButton = pb.add(new Button(562, 1530, 230, 124, '↩ 취소', () => this.doUndo(), { size: 40 }));
    BRUSH.forEach((d, i) => {
      this.sizeButtons.push(pb.add(new Button(30 + i * 118, 1688, 104, 100, '', () => { this.brushIdx = i; this.setTool('brush'); }, {
        drawContent: (ctx, b) => {
          ctx.beginPath();
          ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 6 + d * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = OUTLINE;
          ctx.fill();
        },
      })));
    });
    for (let i = 0; i < MAX_RECENT; i++) {
      this.recentButtons.push(pb.add(new Button(400 + i * 128, 1688, 112, 100, '', () => {
        const c = this.recent[i];
        if (c) { this.color = c; this.setTool('brush'); }
      }, {
        radius: 50,
        drawContent: (ctx, b) => {
          const c = this.recent[i];
          if (!c) { text(ctx, '·', b.x + b.w / 2, b.y + b.h / 2, { size: 40, color: C.gray }); return; }
          box(ctx, b.x + 14, b.y + 14, b.w - 28, b.h - 28, 36, c, OUTLINE, 4);
        },
      })));
    }
    pb.add(new Button(180, 1818, 720, 92, '다 칠했어! 끝내기', () => this.finishPaint(), { fill: C.mint, size: 44 }));

    // ── 결과 버튼 ──
    this.resultButtons.add(new Button(70, 1760, 440, 120, '다시하기', () => this.host.go(new GameScene(this.host, this.stage)), { fill: C.yellow, size: 48 }));
    this.resultButtons.add(new Button(570, 1760, 440, 120, '처음으로', () => this.host.go(new TitleScene(this.host)), { size: 48 }));

    this.buttons = this.placeButtons;
    this.setTool('brush');
  }

  // ════════════════ 단계 전환 ════════════════

  private startPaint() {
    if (this.phase !== 'place') return;
    this.phase = 'paint';
    this.dragOffset = null;
    this.timeLeft = this.stage.paintTime;
    this.buttons = this.paintButtons;
    this.hintT = 4;
    // 캐릭터가 뷰에 꽉 차게 확대
    this.zoom = Math.min(VP.w / (BOX_W + 160), VP.h / (BOX_H + 100));
    this.viewCX = this.charX + BOX_W / 2;
    this.viewCY = this.charY + BOX_H / 2;
    // 확대 화면용 배경을 벡터로 다시 그려 선명하게 (같은 시드 → 같은 그림)
    const k = this.host.pixelScale();
    const [bg, ctx] = makeCanvas(VP.w * k, VP.h * k);
    ctx.fillStyle = '#3a3150';
    ctx.fillRect(0, 0, bg.width, bg.height);
    ctx.scale(k, k);
    this.applyViewTransform(ctx, 0, 0);
    ctx.beginPath();
    ctx.rect(0, 0, MAP_W, MAP_H);
    ctx.clip();
    drawMap(ctx, this.stage.mapId, this.stage.detail, this.stage.seed);
    this.zoomBg = bg;
  }

  private finishPaint() {
    if (this.phase !== 'paint') return;
    this.endStroke();
    this.phase = 'judging';
    this.resultT = 0;
    // 판정은 칠하기 종료 시 딱 한 번 (술래 단계는 이 캐시된 점수를 사용 예정)
    const input = buildJudgeInput(this.map, this.pose, this.charX, this.charY, this.paint);
    this.result = judgeCamouflage(input);
    this.stars = starsForScore(this.result.score);
    this.buildPreview();
    void recordScore(this.stage.id, this.result.score).then((best) => { this.isBest = best; });
  }

  private showResult() {
    this.phase = 'result';
    this.resultT = 0;
    this.buttons = this.resultButtons;
  }

  // ════════════════ 칠하기 도구 ════════════════

  private setTool(t: Tool) {
    if (t !== this.tool) this.hintT = 2.5;
    this.tool = t;
    this.toolButtons.brush.selected = t === 'brush';
    this.toolButtons.picker.selected = t === 'picker';
    this.sizeButtons.forEach((b, i) => (b.selected = t === 'brush' && i === this.brushIdx));
  }

  private doUndo() {
    this.endStroke();
    if (this.undo.undo()) this.charDirty = true;
  }

  /** 맵 좌표 → 확대 화면 좌표 변환을 ctx에 적용 (ox, oy = 뷰포트 좌상단) */
  private applyViewTransform(ctx: Ctx, ox: number, oy: number) {
    ctx.translate(ox + VP.w / 2, oy + VP.h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.viewCX, -this.viewCY);
  }

  private screenToMap(p: Pt): Pt {
    return {
      x: this.viewCX + (p.x - (VP.x + VP.w / 2)) / this.zoom,
      y: this.viewCY + (p.y - (VP.y + VP.h / 2)) / this.zoom,
    };
  }

  private inViewport(p: Pt) {
    return p.x >= VP.x && p.x < VP.x + VP.w && p.y >= VP.y && p.y < VP.y + VP.h;
  }

  private beginStroke(mp: Pt) {
    const lx = mp.x - this.charX;
    const ly = mp.y - this.charY;
    const ctx = this.paintCtx;
    ctx.save();
    // 박스 좌표계로 그리고, 실루엣 밖은 클리핑 → 캐릭터 밖으로는 절대 안 칠해짐
    ctx.setTransform(PS, 0, 0, PS, 0, 0);
    ctx.clip(this.pose.paintClip);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = BRUSH[this.brushIdx];
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(lx, ly, BRUSH[this.brushIdx] / 2, 0, Math.PI * 2);
    ctx.fill();
    this.charDirty = true;
    this.stroke = { last: { x: lx, y: ly }, minX: lx, minY: ly, maxX: lx, maxY: ly };
  }

  /** 이전 점과 새 점을 선으로 이어서 빠르게 그어도 점선처럼 끊기지 않게 함 */
  private extendStroke(mp: Pt) {
    const s = this.stroke;
    if (!s) return;
    const lx = mp.x - this.charX;
    const ly = mp.y - this.charY;
    const ctx = this.paintCtx;
    ctx.beginPath();
    ctx.moveTo(s.last.x, s.last.y);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    this.charDirty = true;
    s.last = { x: lx, y: ly };
    s.minX = Math.min(s.minX, lx); s.minY = Math.min(s.minY, ly);
    s.maxX = Math.max(s.maxX, lx); s.maxY = Math.max(s.maxY, ly);
  }

  private endStroke() {
    const s = this.stroke;
    if (!s) return;
    this.paintCtx.restore();
    this.stroke = null;
    const pad = BRUSH[this.brushIdx] / 2 + 2;
    this.undo.commit({
      x: (s.minX - pad) * PS, y: (s.minY - pad) * PS,
      w: (s.maxX - s.minX + pad * 2) * PS, h: (s.maxY - s.minY + pad * 2) * PS,
    });
  }

  /** 스포이드: 캐릭터 위 칠한 곳이면 그 색, 아니면 배경 맵 색 */
  private pickColor(mp: Pt) {
    const mx = Math.floor(mp.x);
    const my = Math.floor(mp.y);
    if (mx < 0 || my < 0 || mx >= MAP_W || my >= MAP_H) return;
    let rgb: [number, number, number] | null = null;
    const lx = Math.floor((mp.x - this.charX) * PS);
    const ly = Math.floor((mp.y - this.charY) * PS);
    if (lx >= 0 && ly >= 0 && lx < this.paint.width && ly < this.paint.height) {
      const d = this.paintCtx.getImageData(lx, ly, 1, 1).data;
      if (d[3] > 200) rgb = [d[0], d[1], d[2]];
    }
    if (!rgb) {
      const i = (my * MAP_W + mx) * 4;
      const d = this.mapData.data;
      rgb = [d[i], d[i + 1], d[i + 2]];
    }
    this.color = rgbToHex(...rgb);
    this.recent = [this.color, ...this.recent.filter((c) => c !== this.color)].slice(0, MAX_RECENT);
    this.pops.push({ x: mp.x, y: mp.y, color: this.color, t: 0 });
    this.setTool('brush');
  }

  // ════════════════ 입력 ════════════════

  pointerDown(p: Pt) {
    if (this.buttons.down(p)) return;
    if (this.phase === 'place') {
      const inBox = p.x >= this.charX && p.x <= this.charX + BOX_W && p.y >= this.charY && p.y <= this.charY + BOX_H;
      if (!inBox) {
        // 빈 곳을 누르면 그 위치로 순간이동 후 바로 드래그
        this.moveCharTo(p.x - BOX_W / 2, p.y - BOX_H / 2);
      }
      this.dragOffset = { x: p.x - this.charX, y: p.y - this.charY };
    } else if (this.phase === 'paint' && this.inViewport(p)) {
      const mp = this.screenToMap(p);
      if (this.tool === 'brush') this.beginStroke(mp);
      else this.pickerDown = true;
    } else if (this.phase === 'result' && this.previewRect && this.hit(this.previewRect, p)) {
      this.revealing = true;
    }
  }

  pointerMove(p: Pt, pts: Pt[]) {
    this.buttons.move(p);
    if (this.phase === 'place' && this.dragOffset) {
      this.moveCharTo(p.x - this.dragOffset.x, p.y - this.dragOffset.y);
    } else if (this.phase === 'paint' && this.stroke) {
      for (const q of pts) this.extendStroke(this.screenToMap(q));
    }
  }

  pointerUp(p: Pt) {
    this.buttons.up(p);
    this.dragOffset = null;
    this.revealing = false;
    if (this.phase === 'paint') {
      if (this.stroke) this.endStroke();
      if (this.pickerDown && this.inViewport(p)) this.pickColor(this.screenToMap(p));
      this.pickerDown = false;
    }
  }

  private moveCharTo(x: number, y: number) {
    this.charX = clamp(x, PLACE.minX, PLACE.maxX);
    this.charY = clamp(y, PLACE.minY, PLACE.maxY);
  }

  private hit(r: { x: number; y: number; w: number; h: number }, p: Pt) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  // ════════════════ 업데이트 ════════════════

  update(dt: number) {
    this.t += dt;
    this.hintT = Math.max(0, this.hintT - dt);
    for (const pop of this.pops) pop.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.6);
    this.undoButton.enabled = this.undo.size > 0;

    if (this.phase === 'place' || this.phase === 'paint') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        if (this.phase === 'place') this.startPaint();
        else this.finishPaint();
      }
    } else if (this.phase === 'judging') {
      this.resultT += dt;
      if (this.resultT > 1.1) this.showResult();
    } else if (this.phase === 'result') {
      this.resultT += dt;
    }
  }

  // ════════════════ 그리기 ════════════════

  render(ctx: Ctx) {
    if (this.phase === 'place') this.renderPlace(ctx);
    else if (this.phase === 'paint') this.renderPaint(ctx);
    else if (this.phase === 'judging') this.renderJudging(ctx);
    else this.renderResult(ctx);
  }

  private stageLabel() {
    return `${MAP_NAMES[this.stage.mapId]} ${this.stage.index} · ${this.stage.name}`;
  }

  private drawCharacter(ctx: Ctx, x: number, y: number, outlineAlpha: number) {
    if (this.charDirty) {
      composeCharacter(this.charImg, this.pose, this.paint, PS);
      this.charDirty = false;
    }
    ctx.drawImage(this.charImg, x, y, BOX_W, BOX_H);
    if (outlineAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = outlineAlpha;
      const pad = this.OUTLINE_PAD;
      ctx.drawImage(this.outline, x - pad, y - pad, BOX_W + pad * 2, BOX_H + pad * 2);
      ctx.restore();
    }
  }

  private renderPlace(ctx: Ctx) {
    ctx.drawImage(this.map, 0, 0);
    const dragging = !!this.dragOffset;
    const x = this.charX;
    const y = this.charY;
    // 그림자 + 들어올림 연출
    ctx.fillStyle = 'rgba(43,36,64,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + BOX_W / 2, y + BOX_H - 6, 90, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    const lift = dragging ? -24 : Math.sin(this.t * 4) * 6;
    const squash = dragging ? 1 : 1 + Math.sin(this.t * 4) * 0.02;
    ctx.save();
    ctx.translate(x + BOX_W / 2, y + BOX_H);
    ctx.scale(1 / squash, squash);
    ctx.translate(-BOX_W / 2, -BOX_H + lift);
    this.drawCharacter(ctx, 0, 0, 1);
    // 눈 (배치 단계에서만)
    const [ex1, ey1, ex2, ey2] = this.pose.eyes;
    const blink = Math.sin(this.t * 2.3) > 0.97 ? 0.15 : 1;
    ctx.fillStyle = OUTLINE;
    for (const [ex, ey] of [[ex1, ey1], [ex2, ey2]]) {
      ctx.beginPath();
      ctx.ellipse(ex, ey, 9, 13 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawHud(ctx, this.stageLabel(), '숨을 곳 고르기', this.timeLeft, this.stage.placeTime);
    drawHint(ctx, '끌어서 숨을 자리를 골라요!', HUD_H + 24);
    this.buttons.draw(ctx);
  }

  private renderPaint(ctx: Ctx) {
    // 확대된 배경 (미리 렌더링한 선명한 버전)
    if (this.zoomBg) ctx.drawImage(this.zoomBg, VP.x, VP.y, VP.w, VP.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(VP.x, VP.y, VP.w, VP.h);
    ctx.clip();
    this.applyViewTransform(ctx, VP.x, VP.y);
    this.drawCharacter(ctx, this.charX, this.charY, 0.35);
    // 스포이드 "콕" 효과
    for (const pop of this.pops) {
      const k = pop.t / 0.6;
      ctx.beginPath();
      ctx.arc(pop.x, pop.y, (8 + 26 * k) / this.zoom * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = pop.color;
      ctx.globalAlpha = 1 - k;
      ctx.fill();
      ctx.lineWidth = 4 / this.zoom;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    const hint = this.tool === 'picker' ? '배경 아무 곳이나 콕! 색을 가져와요' : '배경이랑 똑같이 칠해서 숨어요!';
    if (this.hintT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.hintT / 0.4);
      drawHint(ctx, hint, 1405);
      ctx.restore();
    }

    // 하단 도구 패널
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 1500, 1080, 420);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(0, 1500, 1080, 6);
    this.buttons.draw(ctx);
    // 현재 색
    ctx.beginPath();
    ctx.arc(936, 1592, 62, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();

    drawHud(ctx, this.stageLabel(), '몸에 칠하기', this.timeLeft, this.stage.paintTime);
  }

  /** 결과 화면용: 캐릭터 주변을 잘라 외곽선 없이 합성한 미리보기 */
  private previewRect: { x: number; y: number; w: number; h: number } | null = null;

  private buildPreview() {
    const cw = BOX_W + 260;
    const ch = BOX_H + 160;
    const cx = clamp(this.charX + BOX_W / 2 - cw / 2, 0, MAP_W - cw);
    const cy = clamp(this.charY + BOX_H / 2 - ch / 2, 0, MAP_H - ch);
    const dispH = 860;
    const dispW = (cw / ch) * dispH;
    this.previewRect = { x: 540 - dispW / 2, y: 190, w: dispW, h: dispH };
    const k = (dispH / ch) * this.host.pixelScale();
    const [c, ctx] = makeCanvas(cw * k, ch * k);
    ctx.scale(k, k);
    ctx.translate(-cx, -cy);
    drawMap(ctx, this.stage.mapId, this.stage.detail, this.stage.seed);
    this.drawCharacter(ctx, this.charX, this.charY, 0);
    this.preview = c;
    const [o, octx] = makeCanvas(cw * k, ch * k);
    octx.scale(k, k);
    octx.translate(-cx, -cy);
    const pad = this.OUTLINE_PAD;
    octx.drawImage(renderOutline(this.pose, PS, 6, pad, C.coral), this.charX - pad, this.charY - pad, BOX_W + pad * 2, BOX_H + pad * 2);
    this.previewOutline = o;
  }

  private renderJudging(ctx: Ctx) {
    this.renderPreviewCard(ctx);
    ctx.fillStyle = 'rgba(43,36,64,0.55)';
    ctx.fillRect(0, 0, 1080, 1920);
    const dots = '.'.repeat(1 + (Math.floor(this.resultT * 6) % 3));
    text(ctx, `두구두구${dots}`, 540, 900, { size: 90, color: C.white, stroke: OUTLINE, strokeW: 14 });
    text(ctx, '위장 실력 채점 중', 540, 1010, { size: 44, color: C.white });
  }

  private renderPreviewCard(ctx: Ctx) {
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 0, 1080, 1920);
    text(ctx, '위장 결과', 540, 100, { size: 64 });
    const r = this.previewRect;
    if (!r || !this.preview) return;
    box(ctx, r.x - 10, r.y - 10, r.w + 20, r.h + 20, 24, C.white);
    ctx.drawImage(this.preview, r.x, r.y, r.w, r.h);
    if (this.revealing && this.previewOutline) ctx.drawImage(this.previewOutline, r.x, r.y, r.w, r.h);
  }

  private renderResult(ctx: Ctx) {
    const res = this.result!;
    this.renderPreviewCard(ctx);
    const r = this.previewRect!;
    text(ctx, this.revealing ? '여기 숨어 있었지롱!' : '꾹 누르면 정답 공개', 540, r.y + r.h + 46, { size: 30, weight: 700, color: '#7a6f94' });

    // 점수 카운트업
    const shown = Math.round(res.score * Math.min(1, this.resultT / 0.9));
    text(ctx, `${shown}`, 400, 1230, { size: 150, color: C.white, stroke: OUTLINE, strokeW: 18, align: 'right' });
    text(ctx, '점', 410, 1260, { size: 60, align: 'left' });

    // 별
    for (let i = 0; i < 3; i++) {
      const appear = clamp((this.resultT - 0.9 - i * 0.2) / 0.25, 0, 1);
      const on = i < this.stars && appear > 0;
      const s = on ? 0.6 + 0.4 * appear + 0.15 * Math.sin(appear * Math.PI) : 1;
      this.drawStar(ctx, 640 + i * 130, 1220, 52 * s, on ? C.yellow : '#e5dff0');
    }

    if (this.resultT > 1.3) {
      text(ctx, commentFor(res.score, res.paintedRatio), 540, 1360, { size: 42 });
      if (this.isBest) text(ctx, '🎉 최고 기록!', 540, 1420, { size: 34, color: C.coral });
    }

    // 항목별 막대
    const bars: [string, number][] = [
      ['색 맞춤', res.colorScore],
      ['윤곽 숨김', res.edgeScore],
      ['칠한 면적', res.paintedRatio],
    ];
    bars.forEach(([label, v], i) => {
      const y = 1480 + i * 80;
      text(ctx, label, 90, y, { size: 34, align: 'left', weight: 700 });
      box(ctx, 300, y - 22, 620, 44, 22, C.white, OUTLINE, 4);
      const fw = 612 * v * Math.min(1, this.resultT / 0.9);
      if (fw > 8) box(ctx, 304, y - 18, fw, 36, 18, v > 0.75 ? C.mint : v > 0.45 ? C.yellow : C.coral, null);
      text(ctx, `${Math.round(v * 100)}`, 990, y, { size: 32, align: 'right', weight: 700 });
    });

    this.buttons.draw(ctx);
    const best = getSave().best[this.stage.id];
    if (best !== undefined) text(ctx, `최고 ${best}점`, 540, 1720, { size: 28, weight: 700, color: '#7a6f94' });
  }

  private drawStar(ctx: Ctx, cx: number, cy: number, r: number, fill: string) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.48;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}
