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
import { adService } from '../services/AdService';
import { Sound, vibrate } from '../services/SoundService';
import { makeButton, type UIButton } from '../ui/Button';
import { addText } from '../ui/text';
import { BaseScene } from './BaseScene';

export type Outcome = 'clear' | 'caught' | 'overtime';

export interface RunResult {
  stageId: number;
  outcome: Outcome;
  timeSec: number;
  maxSuspicion: number;
}

type Phase = 'intro' | 'play' | 'paused' | 'caught' | 'ended';

/** 부활 직후 무적 시간 */
const REVIVE_GRACE_MS = 2500;

export class GameScene extends BaseScene {
  private stage!: StageDef;
  private map!: OfficeMap;
  private player!: Player;
  private patrollers: Patroller[] = [];
  private joystick!: VirtualJoystick;
  private propBar!: PropButtonBar;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

  private phase: Phase = 'intro';
  private elapsedMs = 0;
  private suspicion = 0;
  private maxSuspicion = 0;
  private cooldownLeft = 0;
  private graceLeft = 0;
  private reviveUsed = false;
  private resetAdUsed = false;
  private wasSeen = new Set<Patroller>();

  private zoneText!: Phaser.GameObjects.Text;
  private clockText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private gaugeFill!: Phaser.GameObjects.Graphics;
  private gaugeText!: Phaser.GameObjects.Text;
  private resetAdBtn!: UIButton;
  private overlay?: Phaser.GameObjects.Container;
  private statusOverride = '';
  private statusOverrideUntil = 0;

  constructor() {
    super('Game');
  }

  init(data: { stageId?: number }): void {
    this.stage = getStage(data.stageId ?? 1) ?? STAGES[0];
    this.patrollers = [];
    this.phase = 'intro';
    this.elapsedMs = 0;
    this.suspicion = 0;
    this.maxSuspicion = 0;
    this.cooldownLeft = 0;
    this.graceLeft = 0;
    this.reviveUsed = false;
    this.resetAdUsed = false;
    this.wasSeen = new Set();
    this.overlay = undefined;
  }

  private get cooldownMs(): number {
    return this.stage.transformCooldownMs ?? TUNING.transformCooldownMs;
  }

  create(): void {
    this.setupCamera();
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.cameras.main.fadeIn(250);
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
    this.input.keyboard!.on('keydown-ESC', () => (this.phase === 'paused' ? this.resume() : this.pause()));
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= this.stage.props.length) this.tryTransform(this.stage.props[n - 1]);
    });

    this.buildHud();
    this.buildPanel();
    this.playIntro();

    // 앱이 백그라운드로 가면 자동 일시정지
    const onHidden = () => {
      if (document.hidden) this.pause();
    };
    document.addEventListener('visibilitychange', onHidden);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', onHidden));
  }

  // ================================================================ UI
  private buildHud(): void {
    this.add.rectangle(GAME_WIDTH / 2, HUD_HEIGHT / 2, GAME_WIDTH, HUD_HEIGHT, COLORS.hud).setDepth(100);
    const pauseBtn = makeButton(this, 26, 19, 34, 28, 'Ⅱ', () => this.pause(), { color: 0x3a3f4b, size: 14, radius: 8 });
    pauseBtn.setDepth(101);
    addText(this, 50, 19, `STAGE ${this.stage.id}  ${this.stage.name}`, { size: 14, bold: true })
      .setOrigin(0, 0.5)
      .setDepth(101);
    this.clockText = addText(this, GAME_WIDTH - 14, 19, '', { size: 16, bold: true }).setOrigin(1, 0.5).setDepth(101);

    addText(this, 14, 46, '의심', { size: 12, bold: true, color: COLORS.subText }).setOrigin(0, 0.5).setDepth(101);
    this.add.graphics().setDepth(101).fillStyle(0x111318).fillRoundedRect(48, 38, 250, 16, 8);
    // 50% 기준선 (별 조건)
    this.add.rectangle(48 + 125, 46, 2, 16, 0xffffff, 0.35).setDepth(103);
    this.gaugeFill = this.add.graphics().setDepth(102);
    this.gaugeText = addText(this, 48 + 125, 46, '0%', { size: 11, bold: true, stroke: '#000', strokeThickness: 3 }).setDepth(104);
    this.zoneText = addText(this, GAME_WIDTH - 14, 46, '', { size: 12, color: COLORS.subText }).setOrigin(1, 0.5).setDepth(101);
  }

  private buildPanel(): void {
    this.add.rectangle(GAME_WIDTH / 2, PANEL_Y + PANEL_HEIGHT / 2, GAME_WIDTH, PANEL_HEIGHT, COLORS.panel).setDepth(100);
    this.statusText = addText(this, 14, PANEL_Y + 17, '', { size: 12, color: COLORS.subText }).setOrigin(0, 0.5).setDepth(101);
    this.resetAdBtn = makeButton(this, GAME_WIDTH - 66, PANEL_Y + 17, 112, 24, '📺 의심 초기화', () => this.useResetAd(), {
      color: 0x5b4bd6,
      size: 11,
      radius: 12,
    });
    this.resetAdBtn.setDepth(101);
    this.propBar = new PropButtonBar(this, this.stage.props, (p) => this.tryTransform(p));
  }

  private drawGauge(): void {
    const ratio = this.suspicion / 100;
    const color = ratio < 0.5 ? 0x4cd964 : ratio < 0.8 ? 0xffc53d : 0xff4d4f;
    this.gaugeFill.clear();
    if (ratio > 0.01) this.gaugeFill.fillStyle(color).fillRoundedRect(48, 38, Math.max(16, 250 * ratio), 16, 8);
    this.gaugeText.setText(`${Math.floor(this.suspicion)}%`);
  }

  /** 오후 5:55:00 → 6:00:00 게임 시계 */
  private drawClock(): void {
    const ratio = Phaser.Math.Clamp(this.elapsedMs / (this.stage.timeLimitSec * 1000), 0, 1);
    const total = 55 * 60 + Math.floor(ratio * 300);
    const m = Math.floor(total / 60);
    const s = total % 60;
    const label = m >= 60 ? '오후 6:00:00' : `오후 5:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.clockText.setText(`🕔 ${label}`);
    const urgent = ratio > 0.8;
    this.clockText.setColor(urgent ? '#ff6b6b' : '#ffffff');
    this.clockText.setScale(urgent && Math.floor(this.elapsedMs / 500) % 2 === 0 ? 1.06 : 1);
  }

  private toast(msg: string, duration = 2600): void {
    const t = addText(this, GAME_WIDTH / 2, MAP_Y + 28, msg, { size: 14, bold: true, wrap: 380 }).setDepth(251);
    const bg = this.add.graphics().setDepth(250);
    bg.fillStyle(0x000000, 0.72).fillRoundedRect(GAME_WIDTH / 2 - t.width / 2 - 14, MAP_Y + 28 - t.height / 2 - 6, t.width + 28, t.height + 12, 12);
    const items = [t, bg];
    this.tweens.add({ targets: items, alpha: { from: 0, to: 1 }, y: '-=0', duration: 200 });
    this.time.delayedCall(duration, () =>
      this.tweens.add({ targets: items, alpha: 0, duration: 250, onComplete: () => items.forEach((o) => o.destroy()) }),
    );
  }

  private flashStatus(msg: string): void {
    this.statusOverride = msg;
    this.statusOverrideUntil = this.time.now + 1200;
  }

  private updateStatus(): void {
    let msg: string;
    if (this.time.now < this.statusOverrideUntil) msg = this.statusOverride;
    else if (this.graceLeft > 0) msg = '부활! 잠깐 동안은 안 들켜요 ✨';
    else if (this.player.moving) msg = '이동 중… 멈추면 변신할 수 있어요';
    else if (this.player.form) {
      const zone = this.map.zoneAt(this.player.x, this.player.y);
      const fit = effectiveFit(zone, this.player.form, this.stage.strictness);
      const name = PROP_NAMES[this.player.form];
      msg =
        fit === 'good'
          ? `${name} 위장 중 · ${ZONE_NAMES[zone]}에 딱이에요 👍`
          : fit === 'ok'
            ? `${name} 위장 중 · 조금 어색해요… 🤔`
            : `${name} 위장 중 · ${ZONE_NAMES[zone]}엔 수상해요! 😰`;
    } else if (this.cooldownLeft > 0) msg = `변신 준비 중… ${(this.cooldownLeft / 1000).toFixed(1)}초`;
    else msg = '소품을 골라 변신하세요';
    this.statusText.setText(msg);
  }

  // ================================================================ 흐름
  private playIntro(): void {
    const items: Phaser.GameObjects.GameObject[] = [];
    const dim = this.add.rectangle(GAME_WIDTH / 2, MAP_Y + 300, GAME_WIDTH, 600, 0x000000, 0.45).setDepth(240);
    const t1 = addText(this, GAME_WIDTH / 2, MAP_Y + 250, `STAGE ${this.stage.id}`, { size: 18, color: '#4cd964', bold: true }).setDepth(241);
    const t2 = addText(this, GAME_WIDTH / 2, MAP_Y + 285, this.stage.name, { size: 30, bold: true }).setDepth(241);
    const t3 = addText(this, GAME_WIDTH / 2, MAP_Y + 330, '오후 5:55 · 퇴근까지 5분!', { size: 15, color: '#ffd666' }).setDepth(241);
    items.push(dim, t1, t2, t3);
    this.tweens.add({ targets: [t1, t2, t3], scale: { from: 0.6, to: 1 }, alpha: { from: 0, to: 1 }, duration: 300, ease: 'Back.Out' });
    this.time.delayedCall(1400, () => {
      this.tweens.add({ targets: items, alpha: 0, duration: 250, onComplete: () => items.forEach((o) => o.destroy()) });
      this.phase = 'play';
      this.toast('칼퇴 시작! 🏃');
      (this.stage.tips ?? []).forEach((tip, i) =>
        this.time.delayedCall(2800 * (i + 1), () => {
          if (this.phase === 'play') this.toast(tip);
        }),
      );
    });
  }

  private pause(): void {
    if (this.phase !== 'play') return;
    this.phase = 'paused';
    this.joystick.release();
    this.showOverlay('일시정지', [
      { label: '계속하기', onClick: () => this.resume() },
      { label: '다시하기', color: 0x3a3f4b, onClick: () => this.scene.restart({ stageId: this.stage.id }) },
      { label: '스테이지 선택', color: 0x2c303b, onClick: () => this.scene.start('StageSelect') },
      {
        label: Sound.enabled ? '🔊 소리 켜짐' : '🔇 소리 꺼짐',
        color: 0x2c303b,
        onClick: (b) => {
          Sound.enabled = !Sound.enabled;
          b.label.setText(Sound.enabled ? '🔊 소리 켜짐' : '🔇 소리 꺼짐');
        },
      },
    ]);
  }

  private resume(): void {
    if (this.phase !== 'paused') return;
    this.hideOverlay();
    this.phase = 'play';
  }

  private showOverlay(
    title: string,
    buttons: { label: string; color?: number; onClick: (b: UIButton) => void }[],
    sub?: string,
  ): void {
    this.hideOverlay();
    const c = this.add.container(0, 0).setDepth(500);
    c.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65).setInteractive());
    const top = 300 - buttons.length * 30;
    c.add(addText(this, GAME_WIDTH / 2, top, title, { size: 28, bold: true }));
    if (sub) c.add(addText(this, GAME_WIDTH / 2, top + 40, sub, { size: 14, color: COLORS.subText, wrap: 360 }));
    buttons.forEach((b, i) => {
      const btn: UIButton = makeButton(this, GAME_WIDTH / 2, top + 110 + i * 70, 260, 56, b.label, () => b.onClick(btn), {
        color: b.color,
        size: 18,
      });
      c.add(btn);
    });
    this.overlay = c;
  }

  private hideOverlay(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
  }

  // ================================================================ 조작
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
    if (this.cooldownLeft > 0) {
      Sound.play('tap');
      return;
    }
    this.player.transform(prop);
    this.cooldownLeft = this.cooldownMs;
    Sound.play('transform');
  }

  private async useResetAd(): Promise<void> {
    if (this.phase !== 'play' || this.resetAdUsed || this.suspicion < 1) return;
    if (!adService.isRewardedReady('resetSuspicion')) return;
    this.phase = 'paused';
    this.joystick.release();
    const rewarded = await adService.showRewarded('resetSuspicion');
    if (!this.scene.isActive()) return;
    this.phase = 'play';
    if (rewarded) {
      this.resetAdUsed = true;
      this.suspicion = 0;
      this.toast('의심 게이지 초기화! 😮‍💨');
      Sound.play('star');
    }
  }

  // ================================================================ 루프
  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    if (this.phase === 'paused') {
      this.player.stop();
      return;
    }
    const playing = this.phase === 'play';
    if (playing) {
      this.elapsedMs += dt;
      this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
      this.graceLeft = Math.max(0, this.graceLeft - dt);
      const input = this.readInput();
      this.player.setMove(input.x, input.y);
    } else {
      this.player.stop();
    }
    const wasForm = this.player.form;
    this.player.update();
    if (wasForm && !this.player.form) Sound.play('revert');
    this.player.view.setAlpha(this.graceLeft > 0 ? 0.4 + 0.4 * Math.abs(Math.sin(this.time.now / 90)) : 1);

    if (this.phase !== 'intro') for (const p of this.patrollers) p.update(dt);
    else for (const p of this.patrollers) p.update(0);

    if (playing) {
      this.updateSuspicion(dt);
      this.checkEnd();
    }

    const zone = this.map.zoneAt(this.player.x, this.player.y);
    this.zoneText.setText(`📍 ${ZONE_NAMES[zone]}`);
    this.propBar.update({
      canTransform: playing && !this.player.moving,
      cooldownRatio: this.cooldownLeft / this.cooldownMs,
      current: this.player.form,
      zone,
      strictness: this.stage.strictness,
      showHints: !!this.stage.showHints,
    });
    this.resetAdBtn.setEnabled(playing && !this.resetAdUsed && this.suspicion >= 1);
    this.resetAdBtn.setVisible(!this.resetAdUsed);
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
      if (p.takeWarnEvent()) Sound.play('surprise');

      let r = 0;
      if (this.graceLeft <= 0 && p.canSee(this.player.x, this.player.y)) {
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
      if (r > 0 && !this.wasSeen.has(p)) {
        this.wasSeen.add(p);
        Sound.play('alert');
      } else if (r <= 0) {
        this.wasSeen.delete(p);
      }
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
    if (this.map.isExitAt(this.player.x, this.player.y)) this.onClear();
    else if (this.elapsedMs >= this.stage.timeLimitSec * 1000) this.onOvertime();
  }

  // ================================================================ 결말 연출
  private onClear(): void {
    this.phase = 'ended';
    this.joystick.release();
    Sound.play('clear');
    this.player.revert();
    this.tweens.add({ targets: this.player.view, scale: 0, angle: 360, duration: 500 });
    this.showSpeech(this.player.x, this.player.y - 40, '먼저 들어가보겠습니다~!');
    this.time.delayedCall(1100, () => this.finish('clear'));
  }

  private onOvertime(): void {
    this.phase = 'ended';
    this.joystick.release();
    Sound.play('overtime');
    this.cameras.main.fade(1200, 10, 12, 40);
    const t = addText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '🕕 오후 6:00', { size: 34, bold: true }).setDepth(600);
    this.tweens.add({ targets: t, scale: { from: 1.4, to: 1 }, duration: 300 });
    this.time.delayedCall(1300, () => this.finish('overtime'));
  }

  private onCaught(by: Patroller): void {
    this.phase = 'caught';
    this.joystick.release();
    for (const p of this.patrollers) p.frozen = true;
    by.faceTo(this.player.x, this.player.y);
    by.alert = true;
    by.setIcon('❗');
    Sound.play('caught');
    vibrate(200);
    this.cameras.main.shake(260, 0.012);
    this.cameras.main.flash(220, 255, 80, 80);
    const bubble = this.showSpeech(by.x, by.y - 56, '잠깐 자네, 이리 와봐');
    this.time.delayedCall(1600, () => {
      if (!this.reviveUsed && adService.isRewardedReady('revive')) this.offerRevive(by, bubble);
      else this.finish('caught');
    });
  }

  private offerRevive(by: Patroller, bubble: Phaser.GameObjects.Container): void {
    this.showOverlay(
      '들켰다…! 😱',
      [
        {
          label: '📺 광고 보고 부활 (1회)',
          color: 0x5b4bd6,
          onClick: async () => {
            this.hideOverlay();
            const ok = await adService.showRewarded('revive');
            if (!this.scene.isActive()) return;
            if (ok) this.revive(by, bubble);
            else this.finish('caught');
          },
        },
        { label: '포기하기', color: 0x3a3f4b, onClick: () => this.finish('caught') },
      ],
      `${by.name}: "아, 아니네. 화분이었군…" 하고 넘어가게 만들 수 있어요`,
    );
  }

  private revive(by: Patroller, bubble: Phaser.GameObjects.Container): void {
    this.reviveUsed = true;
    bubble.destroy();
    this.suspicion = 0;
    this.graceLeft = REVIVE_GRACE_MS;
    by.setIcon('');
    for (const p of this.patrollers) p.frozen = false;
    this.phase = 'play';
    this.toast('부활! 2.5초 동안 숨을 고르세요 ✨');
    Sound.play('star');
  }

  private showSpeech(x: number, y: number, text: string): Phaser.GameObjects.Container {
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
    return c;
  }

  private finish(outcome: Outcome): void {
    this.phase = 'ended';
    this.hideOverlay();
    const result: RunResult = {
      stageId: this.stage.id,
      outcome,
      timeSec: this.elapsedMs / 1000,
      maxSuspicion: this.maxSuspicion,
    };
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Result', { result }));
  }
}
