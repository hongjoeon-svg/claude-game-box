import Phaser from 'phaser';
import {
  COLORS,
  GAME_HEIGHT,
  GAME_WIDTH,
  HUD_HEIGHT,
  MAP_COLS,
  MAP_ROWS,
  MAP_X,
  MAP_Y,
  PANEL_HEIGHT,
  PANEL_Y,
  TILE,
  TUNING,
} from '../config';
import { getStage, STAGES, type StageDef } from '../data/stages';
import { effectiveFit, PROP_NAMES, ZONE_NAMES, type PropId } from '../data/zones';
import { OfficeMap } from '../game/OfficeMap';
import { Patroller } from '../game/Patroller';
import { Player } from '../game/Player';
import { PropButtonBar } from '../game/PropButtonBar';
import { VirtualJoystick } from '../game/VirtualJoystick';
import { makeButton } from '../ui/Button';
import { addText } from '../ui/text';
import { BaseScene } from './BaseScene';

export type Outcome = 'clear' | 'caught' | 'overtime';

export interface RunResult {
  stageId: number;
  outcome: Outcome;
  timeSec: number;
  maxSuspicion: number;
}

type Phase = 'play' | 'caught' | 'ended';

export class GameScene extends BaseScene {
  private stage!: StageDef;
  private map!: OfficeMap;
  private player!: Player;
  private patrollers: Patroller[] = [];
  private joystick!: VirtualJoystick;
  private propBar!: PropButtonBar;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

  private phase: Phase = 'play';
  private elapsedMs = 0;
  private suspicion = 0;
  private maxSuspicion = 0;
  private cooldownLeft = 0;

  private zoneText!: Phaser.GameObjects.Text;
  private clockText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private gaugeFill!: Phaser.GameObjects.Graphics;
  private gaugeText!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  init(data: { stageId?: number }): void {
    this.stage = getStage(data.stageId ?? 1) ?? STAGES[0];
    this.patrollers = [];
    this.phase = 'play';
    this.elapsedMs = 0;
    this.suspicion = 0;
    this.maxSuspicion = 0;
    this.cooldownLeft = 0;
  }

  private get cooldownMs(): number {
    return this.stage.transformCooldownMs ?? TUNING.transformCooldownMs;
  }

  create(): void {
    this.setupCamera();
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.physics.world.setBounds(MAP_X, MAP_Y, MAP_COLS * TILE, MAP_ROWS * TILE);

    this.map = new OfficeMap(this.stage.map);
    this.map.draw(this);
    const walls = this.map.buildColliders(this);

    const start = this.map.findAll('P')[0] ?? { tx: 1, ty: 1 };
    const sp = this.map.center(start.tx, start.ty);
    this.player = new Player(this, sp.x, sp.y);
    this.physics.add.collider(this.player.body, walls);

    for (const def of this.stage.patrollers) this.patrollers.push(new Patroller(this, this.map, def));

    this.joystick = new VirtualJoystick(this, new Phaser.Geom.Rectangle(0, MAP_Y, GAME_WIDTH, MAP_ROWS * TILE));
    this.keys = this.input.keyboard!.addKeys('up,down,left,right,w,a,s,d') as typeof this.keys;

    this.buildHud();
    this.buildPanel();
  }

  // ---------------------------------------------------------------- UI
  private buildHud(): void {
    this.add.rectangle(GAME_WIDTH / 2, HUD_HEIGHT / 2, GAME_WIDTH, HUD_HEIGHT, COLORS.hud).setDepth(100);
    addText(this, 14, 18, `STAGE ${this.stage.id}  ${this.stage.name}`, { size: 14, bold: true })
      .setOrigin(0, 0.5)
      .setDepth(101);
    this.clockText = addText(this, GAME_WIDTH - 14, 18, '', { size: 16, bold: true }).setOrigin(1, 0.5).setDepth(101);

    // 의심 게이지
    addText(this, 14, 45, '의심', { size: 12, bold: true, color: COLORS.subText }).setOrigin(0, 0.5).setDepth(101);
    const gx = 48;
    const gw = 250;
    this.add.graphics().setDepth(101).fillStyle(0x111318).fillRoundedRect(gx, 37, gw, 16, 8);
    this.gaugeFill = this.add.graphics().setDepth(102);
    this.gaugeText = addText(this, gx + gw / 2, 45, '0%', { size: 11, bold: true, stroke: '#000', strokeThickness: 3 }).setDepth(103);
    this.zoneText = addText(this, GAME_WIDTH - 14, 45, '', { size: 12, color: COLORS.subText }).setOrigin(1, 0.5).setDepth(101);
  }

  private buildPanel(): void {
    this.add.rectangle(GAME_WIDTH / 2, PANEL_Y + PANEL_HEIGHT / 2, GAME_WIDTH, PANEL_HEIGHT, COLORS.panel).setDepth(100);
    this.statusText = addText(this, 14, PANEL_Y + 17, '', { size: 12, color: COLORS.subText }).setOrigin(0, 0.5).setDepth(101);
    this.propBar = new PropButtonBar(this, this.stage.props, (p) => this.tryTransform(p));
  }

  private drawGauge(): void {
    const gx = 48;
    const gw = 250;
    const ratio = this.suspicion / 100;
    const color = ratio < 0.5 ? 0x4cd964 : ratio < 0.8 ? 0xffc53d : 0xff4d4f;
    this.gaugeFill.clear();
    if (ratio > 0.01) this.gaugeFill.fillStyle(color).fillRoundedRect(gx, 37, Math.max(16, gw * ratio), 16, 8);
    this.gaugeText.setText(`${Math.floor(this.suspicion)}%`);
  }

  /** 오후 5:55:00 → 6:00:00 게임 시계 */
  private drawClock(): void {
    const ratio = Phaser.Math.Clamp(this.elapsedMs / (this.stage.timeLimitSec * 1000), 0, 1);
    const gameSec = Math.floor(ratio * 300);
    const total = 55 * 60 + gameSec;
    const m = Math.floor(total / 60);
    const s = total % 60;
    const label = m >= 60 ? '오후 6:00:00' : `오후 5:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.clockText.setText(`🕔 ${label}`);
    this.clockText.setColor(ratio > 0.8 ? '#ff6b6b' : '#ffffff');
  }

  // ---------------------------------------------------------------- 조작
  private readInput(): Phaser.Math.Vector2 {
    const v = this.joystick.vector.clone();
    const k = this.keys;
    const kx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const ky = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (kx || ky) v.set(kx, ky).normalize();
    return v;
  }

  private tryTransform(prop: PropId): void {
    if (this.phase !== 'play' || this.player.form === prop) return;
    if (this.player.moving) {
      this.flashStatus('멈춰야 변신할 수 있어요!');
      return;
    }
    if (this.cooldownLeft > 0) return;
    this.player.transform(prop);
    this.cooldownLeft = this.cooldownMs;
  }

  private statusOverride = '';
  private statusOverrideUntil = 0;
  private flashStatus(msg: string): void {
    this.statusOverride = msg;
    this.statusOverrideUntil = this.time.now + 1200;
  }

  private updateStatus(): void {
    let msg: string;
    if (this.time.now < this.statusOverrideUntil) {
      msg = this.statusOverride;
    } else if (this.player.moving) {
      msg = '이동 중… 멈추면 변신할 수 있어요';
    } else if (this.player.form) {
      const zone = this.map.zoneAt(this.player.x, this.player.y);
      const fit = effectiveFit(zone, this.player.form, this.stage.strictness);
      const name = PROP_NAMES[this.player.form];
      msg =
        fit === 'good'
          ? `${name}(으)로 위장 중 · ${ZONE_NAMES[zone]}에 딱 어울려요 👍`
          : fit === 'ok'
            ? `${name}(으)로 위장 중 · 조금 어색해요… 🤔`
            : `${name}(으)로 위장 중 · ${ZONE_NAMES[zone]}에 이건 수상해요! 😰`;
    } else if (this.cooldownLeft > 0) {
      msg = `변신 준비 중… ${(this.cooldownLeft / 1000).toFixed(1)}초`;
    } else {
      msg = '소품을 골라 변신하세요';
    }
    this.statusText.setText(msg);
  }

  // ---------------------------------------------------------------- 루프
  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    if (this.phase === 'play') {
      this.elapsedMs += dt;
      this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
      const input = this.readInput();
      this.player.setMove(input.x, input.y);
    } else {
      this.player.stop();
    }
    this.player.update();
    for (const p of this.patrollers) p.update(dt);

    if (this.phase === 'play') {
      this.updateSuspicion(dt);
      this.checkEnd();
    }

    const zone = this.map.zoneAt(this.player.x, this.player.y);
    this.zoneText.setText(`📍 ${ZONE_NAMES[zone]}`);
    this.propBar.update({
      canTransform: this.phase === 'play' && !this.player.moving,
      cooldownRatio: this.cooldownLeft / this.cooldownMs,
      current: this.player.form,
      zone,
      strictness: this.stage.strictness,
      showHints: !!this.stage.showHints,
    });
    this.drawGauge();
    this.drawClock();
    this.updateStatus();
  }

  private updateSuspicion(dt: number): void {
    const S = TUNING.suspicion;
    const zone = this.map.zoneAt(this.player.x, this.player.y);
    let rate = 0;
    let worst: Patroller | null = null;
    let worstRate = 0;
    for (const p of this.patrollers) {
      let r = 0;
      if (p.canSee(this.player.x, this.player.y)) {
        if (this.player.moving) r = S.moving;
        else if (!this.player.form) r = S.unformed;
        else {
          const fit = effectiveFit(zone, this.player.form, this.stage.strictness);
          r = fit === 'bad' ? S.bad : fit === 'ok' ? S.ok : 0;
        }
        r *= 1 + S.closeBonus * (1 - p.distanceRatio(this.player.x, this.player.y));
      }
      p.alert = r > 0;
      p.setIcon(r > 0 ? (r >= S.moving ? '❗' : '❓') : '');
      rate += r;
      if (r > worstRate) {
        worstRate = r;
        worst = p;
      }
    }
    if (rate > 0) this.suspicion += (rate * dt) / 1000;
    else this.suspicion -= (S.decay * dt) / 1000;
    this.suspicion = Phaser.Math.Clamp(this.suspicion, 0, 100);
    this.maxSuspicion = Math.max(this.maxSuspicion, this.suspicion);
    if (this.suspicion >= 100 && worst) this.onCaught(worst);
  }

  private checkEnd(): void {
    if (this.phase !== 'play') return;
    if (this.map.isExitAt(this.player.x, this.player.y)) {
      this.finish('clear');
    } else if (this.elapsedMs >= this.stage.timeLimitSec * 1000) {
      this.finish('overtime');
    }
  }

  // ---------------------------------------------------------------- 들킴 연출
  private onCaught(by: Patroller): void {
    this.phase = 'caught';
    this.joystick.release();
    this.joystick.enabled = false;
    for (const p of this.patrollers) p.frozen = true;
    by.faceTo(this.player.x, this.player.y);
    by.alert = true;
    by.setIcon('❗');
    this.cameras.main.shake(250, 0.01);
    this.cameras.main.flash(200, 255, 80, 80);
    this.showSpeech(by.x, by.y - 56, '잠깐 자네, 이리 와봐');
    this.time.delayedCall(1700, () => this.finish('caught'));
  }

  private showSpeech(x: number, y: number, text: string): void {
    const t = addText(this, 0, 0, text, { size: 15, bold: true, color: '#222' });
    const w = t.width + 24;
    const h = t.height + 14;
    const bx = Phaser.Math.Clamp(x, w / 2 + 6, GAME_WIDTH - w / 2 - 6);
    const by = Math.max(MAP_Y + h / 2 + 4, y);
    const g = this.add.graphics();
    g.fillStyle(0xffffff).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.fillTriangle(-8, h / 2 - 1, 8, h / 2 - 1, Phaser.Math.Clamp(x - bx, -w / 2 + 10, w / 2 - 10), h / 2 + 10);
    const c = this.add.container(bx, by, [g, t]).setDepth(300);
    this.tweens.add({ targets: c, scale: { from: 0.3, to: 1 }, duration: 220, ease: 'Back.Out' });
  }

  // ---------------------------------------------------------------- 종료
  private finish(outcome: Outcome): void {
    this.phase = 'ended';
    this.joystick.release();
    this.joystick.enabled = false;
    const result: RunResult = {
      stageId: this.stage.id,
      outcome,
      timeSec: this.elapsedMs / 1000,
      maxSuspicion: this.maxSuspicion,
    };
    this.showEndOverlay(result);
  }

  /** (임시) 결과 오버레이 — 4단계에서 결과 화면으로 교체 */
  private showEndOverlay(r: RunResult): void {
    const title = r.outcome === 'clear' ? '칼퇴 성공! 🎉' : r.outcome === 'caught' ? '들켰다… 😱' : '야근 확정… 🌙';
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(400).setInteractive();
    addText(this, GAME_WIDTH / 2, 330, title, { size: 30, bold: true }).setDepth(401);
    addText(this, GAME_WIDTH / 2, 380, `시간 ${r.timeSec.toFixed(1)}초 · 최대 의심 ${Math.floor(r.maxSuspicion)}%`, {
      size: 14,
      color: COLORS.subText,
    }).setDepth(401);
    makeButton(this, GAME_WIDTH / 2, 450, 200, 54, '다시하기', () => this.scene.restart({ stageId: r.stageId })).setDepth(401);
  }
}
