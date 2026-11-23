import Phaser from 'phaser';
import { createVisual } from '../assets';
import { GAME_WIDTH, PANEL_Y } from '../config';
import { effectiveFit, PROP_NAMES, PROP_VISUAL, type PropId, type Strictness, type ZoneId } from '../data/zones';
import { addText } from '../ui/text';

export interface PropBarState {
  canTransform: boolean;
  /** 남은 쿨타임 비율 1→0 */
  cooldownRatio: number;
  current: PropId | null;
  zone: ZoneId;
  strictness: Strictness;
  showHints: boolean;
}

interface PropButton {
  prop: PropId;
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  cooldown: Phaser.GameObjects.Graphics;
  hint: Phaser.GameObjects.Arc;
  w: number;
  h: number;
  lastKey: string;
}

/** 하단 소품 변신 버튼 줄 (3~5개) */
export class PropButtonBar {
  private buttons: PropButton[] = [];

  constructor(
    scene: Phaser.Scene,
    props: PropId[],
    private onPick: (p: PropId) => void,
  ) {
    const n = props.length;
    const gap = 8;
    const w = Math.min(100, (GAME_WIDTH - 24 - gap * (n - 1)) / n);
    const h = 88;
    const total = w * n + gap * (n - 1);
    const y = PANEL_Y + 34 + h / 2;
    props.forEach((prop, i) => {
      const x = (GAME_WIDTH - total) / 2 + w / 2 + i * (w + gap);
      const frame = scene.add.graphics();
      const icon = createVisual(scene, PROP_VISUAL[prop], 0, -10, 38);
      const name = addText(scene, 0, h / 2 - 15, PROP_NAMES[prop], { size: 12, bold: true });
      const cooldown = scene.add.graphics();
      const hint = scene.add.circle(w / 2 - 10, -h / 2 + 10, 5, 0x4cd964).setStrokeStyle(2, 0xffffff);
      const root = scene.add.container(x, y, [frame, icon, name, cooldown, hint]).setDepth(110);
      root.setSize(w, h).setInteractive({ useHandCursor: true });
      root.on('pointerdown', () => {
        root.setScale(0.93);
        this.onPick(prop);
      });
      root.on('pointerup', () => root.setScale(1));
      root.on('pointerout', () => root.setScale(1));
      this.buttons.push({ prop, root, frame, cooldown, hint, w, h, lastKey: '' });
    });
  }

  update(s: PropBarState): void {
    for (const b of this.buttons) {
      const selected = s.current === b.prop;
      const enabled = s.canTransform && s.cooldownRatio <= 0;
      // 프레임은 상태가 바뀔 때만 다시 그림
      const key = `${b.prop}:${selected}:${enabled}`;
      if (b.lastKey !== key) {
        b.lastKey = key;
        b.frame.clear();
        b.frame.fillStyle(0x000000, 0.3).fillRoundedRect(-b.w / 2, -b.h / 2 + 4, b.w, b.h, 14);
        b.frame.fillStyle(selected ? 0x2f7d4a : 0x3a3f4b).fillRoundedRect(-b.w / 2, -b.h / 2, b.w, b.h, 14);
        if (selected) b.frame.lineStyle(3, 0x4cd964).strokeRoundedRect(-b.w / 2, -b.h / 2, b.w, b.h, 14);
      }
      b.root.setAlpha(enabled || selected ? 1 : 0.5);

      b.cooldown.clear();
      if (s.cooldownRatio > 0) {
        const ch = b.h * s.cooldownRatio;
        b.cooldown.fillStyle(0x000000, 0.5).fillRect(-b.w / 2, b.h / 2 - ch, b.w, ch);
      }

      if (s.showHints) {
        const fit = effectiveFit(s.zone, b.prop, s.strictness);
        b.hint.setVisible(true).setFillStyle(fit === 'good' ? 0x4cd964 : fit === 'ok' ? 0xffc53d : 0xff4d4f);
      } else {
        b.hint.setVisible(false);
      }
    }
  }
}
