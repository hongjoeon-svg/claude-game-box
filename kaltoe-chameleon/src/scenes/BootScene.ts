import Phaser from 'phaser';
import { SFX, VISUALS, textureKey, type SfxAsset, type VisualAsset } from '../assets';

/** assets.ts 에 image/file 경로가 채워진 에셋만 로드합니다. (지금은 전부 이모지라 즉시 통과) */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const [key, def] of Object.entries(VISUALS) as [string, VisualAsset][]) {
      if (def.image) this.load.image(textureKey(key as keyof typeof VISUALS), def.image);
    }
    for (const [key, def] of Object.entries(SFX) as [string, SfxAsset][]) {
      if (def.file) this.load.audio(`sfx_${key}`, def.file);
    }
  }

  create(): void {
    this.scene.start('Game', { stageId: 1 });
  }
}
