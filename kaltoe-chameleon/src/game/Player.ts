import Phaser from 'phaser';
import { createVisual } from '../assets';
import { TUNING } from '../config';
import { PROP_VISUAL, type PropId } from '../data/zones';

/** 카멜레온(플레이어). 물리 몸체는 보이지 않는 원, 보이는 그림은 컨테이너가 따라다닙니다. */
export class Player {
  readonly body: Phaser.GameObjects.Arc;
  readonly view: Phaser.GameObjects.Container;
  form: PropId | null = null;
  moving = false;
  private visual: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  private shadow: Phaser.GameObjects.Ellipse;
  private facingLeft = false;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.body = scene.add.circle(x, y, TUNING.playerRadius, 0x000000, 0);
    scene.physics.add.existing(this.body);
    this.arcade.setCircle(TUNING.playerRadius);
    this.arcade.setCollideWorldBounds(true);

    this.shadow = scene.add.ellipse(0, 10, 22, 8, 0x000000, 0.2);
    this.visual = createVisual(scene, 'player', 0, 0, 26);
    this.view = scene.add.container(x, y, [this.shadow, this.visual]).setDepth(10);
  }

  get arcade(): Phaser.Physics.Arcade.Body {
    return this.body.body as Phaser.Physics.Arcade.Body;
  }

  get x(): number {
    return this.body.x;
  }

  get y(): number {
    return this.body.y;
  }

  /** dir: 길이 0~1 방향 벡터 */
  setMove(dirX: number, dirY: number): void {
    this.arcade.setVelocity(dirX * TUNING.playerSpeed, dirY * TUNING.playerSpeed);
  }

  stop(): void {
    this.arcade.setVelocity(0, 0);
  }

  update(): void {
    const v = this.arcade.velocity;
    this.moving = v.length() > TUNING.moveThreshold;
    this.view.setPosition(this.body.x, this.body.y);
    if (this.moving) {
      if (this.form) this.revert();
      if (Math.abs(v.x) > 1) this.facingLeft = v.x < 0;
      // 걷는 느낌의 흔들림
      this.visual.setAngle(Math.sin(this.scene.time.now / 70) * 8);
    } else {
      this.visual.setAngle(0);
    }
    if (!this.form) this.visual.setScale(this.facingLeft ? 1 : -1, 1);
  }

  transform(prop: PropId): void {
    this.form = prop;
    this.swapVisual(createVisual(this.scene, PROP_VISUAL[prop], 0, 0, 28));
    this.puff();
  }

  revert(): void {
    this.form = null;
    this.swapVisual(createVisual(this.scene, 'player', 0, 0, 26));
  }

  private swapVisual(next: Phaser.GameObjects.Image | Phaser.GameObjects.Text): void {
    this.visual.destroy();
    this.visual = next;
    this.view.add(next);
    this.scene.tweens.add({ targets: next, scale: { from: 0.4, to: 1 }, duration: 160, ease: 'Back.Out' });
  }

  /** 변신 연기 효과 */
  private puff(): void {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const c = this.scene.add.circle(this.x, this.y, 5, 0xffffff, 0.8).setDepth(11);
      this.scene.tweens.add({
        targets: c,
        x: this.x + Math.cos(a) * 20,
        y: this.y + Math.sin(a) * 20,
        alpha: 0,
        scale: 1.8,
        duration: 320,
        onComplete: () => c.destroy(),
      });
    }
  }

  destroy(): void {
    this.view.destroy();
    this.body.destroy();
  }
}
