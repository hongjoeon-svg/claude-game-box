import Phaser from 'phaser';
import { addText } from './text';

export interface ButtonOpts {
  color?: number;
  textColor?: string;
  size?: number;
  radius?: number;
  disabled?: boolean;
}

export type UIButton = Phaser.GameObjects.Container & { setEnabled(on: boolean): UIButton; label: Phaser.GameObjects.Text };

/** 둥근 사각형 버튼 (누르면 살짝 눌리는 효과) */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): UIButton {
  const color = opts.color ?? 0x4cd964;
  const radius = opts.radius ?? 14;
  const g = scene.add.graphics();
  const draw = (c: number) => {
    g.clear();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, radius);
    g.fillStyle(c).fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  };
  draw(color);
  const label = addText(scene, 0, 0, text, { size: opts.size ?? 18, bold: true, color: opts.textColor ?? '#ffffff' });
  const c = scene.add.container(x, y, [g, label]) as UIButton;
  c.label = label;
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  let enabled = true;
  c.setEnabled = (on: boolean) => {
    enabled = on;
    c.setAlpha(on ? 1 : 0.45);
    return c;
  };
  c.on('pointerdown', () => {
    if (!enabled) return;
    c.setScale(0.95);
  });
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    if (!enabled) return;
    c.setScale(1);
    onClick();
  });
  if (opts.disabled) c.setEnabled(false);
  return c;
}
