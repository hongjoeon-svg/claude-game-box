import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '../config';

/**
 * 내부 캔버스를 RENDER_SCALE 배로 키우고 카메라 줌으로 맞춰서
 * 논리 좌표(450x800)는 그대로 쓰면서 레티나에서도 선명하게 그립니다.
 */
export class BaseScene extends Phaser.Scene {
  protected setupCamera(): void {
    const cam = this.cameras.main;
    cam.setZoom(RENDER_SCALE);
    cam.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }

  /** 포인터의 논리 좌표 */
  protected worldPoint(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }
}
