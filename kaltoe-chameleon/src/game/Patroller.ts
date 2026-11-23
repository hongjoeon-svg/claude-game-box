import Phaser from 'phaser';
import { createVisual } from '../assets';
import { COLORS, TUNING } from '../config';
import type { PatrollerDef } from '../data/stages';
import { addText } from '../ui/text';
import type { OfficeMap } from './OfficeMap';

type SurpriseState = 'idle' | 'warn' | 'look';

/** 부장님·과장님 순찰 AI */
export class Patroller {
  x: number;
  y: number;
  facing: number;
  /** 시야 안에 플레이어가 있어서 의심 중인지 (그리기 색상용) */
  alert = false;
  /** 정지 상태(잡는 연출 등)면 움직이지 않음 */
  frozen = false;

  private readonly fov: number;
  private readonly points: { x: number; y: number }[];
  private idx: number;
  private dir = 1;
  private waitLeft = 0;
  private waitBase = 0;
  private waitT = 0;
  private surprise: SurpriseState = 'idle';
  private surpriseTimer = 0;
  private surpriseBase = 0;
  private warnEvent = false;

  private readonly sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Text;
  private readonly fovGfx: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    private map: OfficeMap,
    readonly def: PatrollerDef,
  ) {
    this.fov = Phaser.Math.DegToRad(def.fovDeg);
    this.points = def.path.map(([tx, ty]) => map.center(tx, ty));
    this.idx = def.startIndex ?? 0;
    const start = this.points[this.idx];
    this.x = start.x;
    this.y = start.y;
    this.advanceIndex();
    const next = this.points[this.idx];
    this.facing = Math.atan2(next.y - this.y, next.x - this.x);
    this.resetSurpriseTimer();

    this.fovGfx = scene.add.graphics().setDepth(5);
    this.sprite = createVisual(scene, def.type === 'boss' ? 'boss' : 'manager', this.x, this.y, 30).setDepth(20);
    this.label = addText(scene, this.x, this.y - 24, def.name ?? (def.type === 'boss' ? '부장님' : '과장님'), {
      size: 10,
      bold: true,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setDepth(21);
    this.icon = addText(scene, this.x, this.y - 40, '', { size: 18 }).setDepth(22);
  }

  get name(): string {
    return this.label.text;
  }

  private advanceIndex(): void {
    const n = this.points.length;
    if (n <= 1) return;
    if ((this.def.mode ?? 'loop') === 'loop') {
      this.idx = (this.idx + 1) % n;
    } else {
      if (this.idx + this.dir >= n || this.idx + this.dir < 0) this.dir *= -1;
      this.idx += this.dir;
    }
  }

  private resetSurpriseTimer(): void {
    const s = this.def.surpriseCheck;
    if (s) this.surpriseTimer = Phaser.Math.Between(s.minIntervalMs, s.maxIntervalMs);
  }

  /** ‼️ 경고가 막 시작됐으면 한 번만 true (효과음용) */
  takeWarnEvent(): boolean {
    const e = this.warnEvent;
    this.warnEvent = false;
    return e;
  }

  update(dtMs: number): void {
    if (!this.frozen) this.step(dtMs);
    this.render();
  }

  private step(dtMs: number): void {
    const dt = dtMs / 1000;
    const turn = TUNING.patrollerTurnSpeed * dt;

    // --- 기습 확인 ---
    const s = this.def.surpriseCheck;
    if (s) {
      this.surpriseTimer -= dtMs;
      if (this.surprise === 'idle' && this.surpriseTimer <= 0) {
        this.surprise = 'warn';
        this.surpriseTimer = s.warnMs;
        this.warnEvent = true;
      } else if (this.surprise === 'warn' && this.surpriseTimer <= 0) {
        this.surprise = 'look';
        this.surpriseTimer = s.holdMs;
        this.surpriseBase = this.facing;
        this.facing = this.facing + Math.PI; // 휙!
        this.scene.cameras.main.shake(120, 0.004);
      } else if (this.surprise === 'look' && this.surpriseTimer <= 0) {
        this.surprise = 'idle';
        this.facing = this.surpriseBase;
        this.resetSurpriseTimer();
      }
      if (this.surprise !== 'idle') return;
    }

    // --- 웨이포인트에서 대기 (두리번) ---
    if (this.waitLeft > 0) {
      this.waitLeft -= dtMs;
      if (this.def.lookAround) {
        this.waitT += dt;
        this.facing = this.waitBase + Math.sin(this.waitT * 2.2) * 0.9;
      }
      return;
    }

    // --- 이동 ---
    const target = this.points[this.idx];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const stepLen = this.def.speed * dt;
    if (dist > 0.5) this.facing = Phaser.Math.Angle.RotateTo(this.facing, Math.atan2(dy, dx), turn);
    if (dist <= stepLen) {
      this.x = target.x;
      this.y = target.y;
      this.advanceIndex();
      if (this.def.waitMs) {
        this.waitLeft = this.def.waitMs;
        this.waitT = 0;
        const next = this.points[this.idx];
        this.facing = Phaser.Math.Angle.Wrap(this.facing);
        this.waitBase = this.def.lookAround ? this.facing : Math.atan2(next.y - this.y, next.x - this.x);
      }
    } else {
      this.x += (dx / dist) * stepLen;
      this.y += (dy / dist) * stepLen;
    }
  }

  /** 플레이어가 시야(부채꼴 + 벽 가림) 안에 있는지 */
  canSee(px: number, py: number): boolean {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, px, py);
    if (dist <= TUNING.bumpDistance) return true;
    if (dist > this.def.viewDist) return false;
    const diff = Phaser.Math.Angle.Wrap(Math.atan2(py - this.y, px - this.x) - this.facing);
    if (Math.abs(diff) > this.fov / 2) return false;
    return this.map.hasLineOfSight(this.x, this.y, px, py);
  }

  /** 거리 비율 0(바로 앞)~1(시야 끝) */
  distanceRatio(px: number, py: number): number {
    return Phaser.Math.Clamp(Phaser.Math.Distance.Between(this.x, this.y, px, py) / this.def.viewDist, 0, 1);
  }

  /** 플레이어 쪽으로 몸을 돌림 (잡는 연출) */
  faceTo(px: number, py: number): void {
    this.facing = Math.atan2(py - this.y, px - this.x);
  }

  setIcon(str: string): void {
    this.icon.setText(str);
  }

  private render(): void {
    const g = this.fovGfx;
    g.clear();
    const rays = 30;
    const color = this.alert ? COLORS.fovAlert : COLORS.fovIdle;
    g.fillStyle(color, this.alert ? 0.38 : 0.3);
    g.beginPath();
    g.moveTo(this.x, this.y);
    for (let i = 0; i <= rays; i++) {
      const a = this.facing - this.fov / 2 + (this.fov * i) / rays;
      const d = this.map.castRay(this.x, this.y, a, this.def.viewDist);
      g.lineTo(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d);
    }
    g.closePath();
    g.fillPath();

    this.sprite.setPosition(this.x, this.y);
    // 왼쪽을 볼 때 좌우 반전
    const lookingLeft = Math.cos(this.facing) < -0.1;
    this.sprite.setScale(lookingLeft ? -1 : 1, 1);
    this.label.setPosition(this.x, this.y - 24);
    this.icon.setPosition(this.x, this.y - 42);
    if (this.surprise === 'warn') this.icon.setText('‼️');
  }

  destroy(): void {
    this.fovGfx.destroy();
    this.sprite.destroy();
    this.label.destroy();
    this.icon.destroy();
  }
}
