import { COLORS, GAME_WIDTH } from '../config';
import { STAGES } from '../data/stages';
import { SaveData } from '../services/SaveData';
import { makeButton } from '../ui/Button';
import { addText } from '../ui/text';
import { BaseScene } from './BaseScene';

export class StageSelectScene extends BaseScene {
  constructor() {
    super('StageSelect');
  }

  create(): void {
    this.setupCamera();
    this.cameras.main.setBackgroundColor(COLORS.bg);

    addText(this, GAME_WIDTH / 2, 56, '스테이지 선택', { size: 26, bold: true });
    addText(this, GAME_WIDTH / 2, 92, `⭐ ${SaveData.totalStars()} / ${STAGES.length * 3}`, {
      size: 16,
      color: '#ffd666',
      bold: true,
    });

    const cardW = 390;
    const cardH = 104;
    const top = 130;
    const gap = 12;
    STAGES.forEach((stage, i) => {
      const y = top + cardH / 2 + i * (cardH + gap);
      const unlocked = SaveData.isUnlocked(stage.id);
      const prog = SaveData.progress(stage.id);
      const c = this.add.container(GAME_WIDTH / 2, y);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(-cardW / 2, -cardH / 2 + 4, cardW, cardH, 16);
      g.fillStyle(unlocked ? 0x2c303b : 0x24262d).fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
      if (unlocked && prog.clears === 0) g.lineStyle(2, COLORS.accent).strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
      c.add(g);

      c.add(addText(this, -cardW / 2 + 40, 0, unlocked ? String(stage.id) : '🔒', { size: 30, bold: true, color: '#4cd964' }));
      c.add(
        addText(this, -cardW / 2 + 78, -26, stage.name, { size: 18, bold: true, color: unlocked ? '#fff' : '#666' }).setOrigin(0, 0.5),
      );
      c.add(
        addText(this, -cardW / 2 + 78, 6, unlocked ? (stage.description ?? '') : '이전 스테이지를 클리어하면 열려요', {
          size: 12,
          color: unlocked ? COLORS.subText : '#555',
          align: 'left',
          wrap: 230,
        }).setOrigin(0, 0.5),
      );
      const stars = prog.stars.map((s) => (s ? '★' : '☆')).join('');
      c.add(addText(this, cardW / 2 - 50, -24, stars, { size: 20, color: '#ffd666' }));
      if (prog.bestTimeSec !== undefined) {
        c.add(addText(this, cardW / 2 - 50, 4, `최고 ${prog.bestTimeSec.toFixed(1)}초`, { size: 11, color: COLORS.subText }));
      }
      c.add(addText(this, cardW / 2 - 50, 28, `빠른 클리어 ${stage.fastClearSec}초`, { size: 10, color: '#6f7685' }));

      if (unlocked) {
        c.setSize(cardW, cardH).setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => c.setScale(0.97));
        c.on('pointerout', () => c.setScale(1));
        c.on('pointerup', () => {
          c.setScale(1);
          this.scene.start('Game', { stageId: stage.id });
        });
      }
      this.tweens.add({ targets: c, alpha: { from: 0, to: 1 }, x: { from: GAME_WIDTH / 2 + 30, to: GAME_WIDTH / 2 }, delay: i * 60, duration: 250 });
    });

    makeButton(this, GAME_WIDTH / 2, 740, 180, 50, '← 타이틀', () => this.scene.start('Title'), { color: 0x3a3f4b, size: 16 });
  }
}
