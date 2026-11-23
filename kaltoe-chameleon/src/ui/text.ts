import Phaser from 'phaser';
import { COLORS, FONT, RENDER_SCALE } from '../config';

export interface TextOpts {
  size?: number;
  color?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  stroke?: string;
  strokeThickness?: number;
}

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  opts: TextOpts = {},
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, str, {
      fontFamily: FONT,
      fontSize: `${opts.size ?? 16}px`,
      fontStyle: opts.bold ? 'bold' : 'normal',
      color: opts.color ?? COLORS.text,
      align: opts.align ?? 'center',
      wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
      stroke: opts.stroke,
      strokeThickness: opts.strokeThickness ?? 0,
      padding: { top: 3, bottom: 3 },
      resolution: RENDER_SCALE,
    })
    .setOrigin(0.5);
}
