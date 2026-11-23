import Phaser from 'phaser';

/**
 * 플로팅 가상 조이스틱: 지정한 영역 안 아무 곳이나 누르면 그 자리에 조이스틱이 생깁니다.
 * vector는 길이 0~1의 방향 벡터입니다.
 */
export class VirtualJoystick {
  readonly vector = new Phaser.Math.Vector2(0, 0);
  enabled = true;
  private pointerId: number | null = null;
  private origin = new Phaser.Math.Vector2();
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;

  constructor(
    private scene: Phaser.Scene,
    private area: Phaser.Geom.Rectangle,
    private radius = 46,
  ) {
    this.base = scene.add
      .circle(0, 0, radius, 0xffffff, 0.12)
      .setStrokeStyle(2, 0xffffff, 0.45)
      .setDepth(900)
      .setVisible(false);
    this.thumb = scene.add.circle(0, 0, 20, 0xffffff, 0.55).setDepth(901).setVisible(false);
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once('shutdown', () => this.destroy());
  }

  get active(): boolean {
    return this.pointerId !== null;
  }

  private toWorld(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.scene.cameras.main.getWorldPoint(p.x, p.y);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.enabled || this.pointerId !== null) return;
    const w = this.toWorld(p);
    if (!this.area.contains(w.x, w.y)) return;
    this.pointerId = p.id;
    this.origin.set(w.x, w.y);
    this.base.setPosition(w.x, w.y).setVisible(true);
    this.thumb.setPosition(w.x, w.y).setVisible(true);
    this.vector.set(0, 0);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    const w = this.toWorld(p);
    const d = new Phaser.Math.Vector2(w.x - this.origin.x, w.y - this.origin.y);
    const len = d.length();
    if (len > this.radius) d.scale(this.radius / len);
    this.thumb.setPosition(this.origin.x + d.x, this.origin.y + d.y);
    const mag = Math.min(len, this.radius) / this.radius;
    // 데드존 15%
    if (mag < 0.15) this.vector.set(0, 0);
    else this.vector.set(d.x, d.y).normalize().scale((mag - 0.15) / 0.85);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    this.release();
  }

  release(): void {
    this.pointerId = null;
    this.vector.set(0, 0);
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
  }
}
