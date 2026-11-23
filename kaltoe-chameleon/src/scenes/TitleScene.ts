import { createVisual, type VisualKey } from '../assets';
import { COLORS, GAME_WIDTH } from '../config';
import { STAGES } from '../data/stages';
import { SaveData } from '../services/SaveData';
import { Sound } from '../services/SoundService';
import { makeButton } from '../ui/Button';
import { addText } from '../ui/text';
import { BaseScene } from './BaseScene';

const MORPH: VisualKey[] = ['player', 'prop_plant', 'player', 'prop_water', 'player', 'prop_chair', 'player', 'prop_box'];

export class TitleScene extends BaseScene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.setupCamera();
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.cameras.main.fadeIn(300);

    // 배경: 사무실 바닥 느낌의 체크무늬
    const g = this.add.graphics();
    for (let y = 0; y < 800; y += 30)
      for (let x = 0; x < 450; x += 30) g.fillStyle((x + y) % 60 === 0 ? 0x20232b : 0x1d2027).fillRect(x, y, 30, 30);

    addText(this, GAME_WIDTH / 2, 118, '부장님 몰래 정시 퇴근 대작전', { size: 15, color: '#ffd666' });
    const title = addText(this, GAME_WIDTH / 2, 170, '칼퇴 카멜레온', {
      size: 46,
      bold: true,
      stroke: '#2f7d4a',
      strokeThickness: 8,
    });
    this.tweens.add({ targets: title, y: 176, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.InOut' });

    this.buildDiorama();

    const stars = SaveData.totalStars();
    addText(this, GAME_WIDTH / 2, 500, `⭐ ${stars} / ${STAGES.length * 3}`, { size: 16, bold: true, color: '#ffd666' });

    const start = makeButton(
      this,
      GAME_WIDTH / 2,
      570,
      260,
      66,
      '퇴근 준비 ▶',
      () => {
        Sound.unlock();
        Sound.play('tap');
        this.cameras.main.fadeOut(200);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('StageSelect'));
      },
      { size: 24 },
    );
    this.tweens.add({ targets: start, scale: 1.04, yoyo: true, repeat: -1, duration: 700 });

    const soundBtn = makeButton(
      this,
      GAME_WIDTH / 2,
      650,
      160,
      42,
      Sound.enabled ? '🔊 소리 ON' : '🔇 소리 OFF',
      () => {
        Sound.unlock();
        Sound.enabled = !Sound.enabled;
        soundBtn.label.setText(Sound.enabled ? '🔊 소리 ON' : '🔇 소리 OFF');
        Sound.play('tap');
      },
      { color: 0x3a3f4b, size: 15 },
    );

    addText(this, GAME_WIDTH / 2, 760, 'v0.1 MVP · 드래그로 이동, 버튼으로 변신', { size: 11, color: '#5c6270' });
  }

  /** 카멜레온이 소품으로 변신하고, 부장님이 지나가는 작은 연출 */
  private buildDiorama(): void {
    const cy = 330;
    this.add.graphics().fillStyle(0xd8d2c4, 0.12).fillRoundedRect(40, cy - 90, 370, 180, 20);

    let i = 0;
    let cham = createVisual(this, MORPH[0], 150, cy + 20, 56);
    this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        i = (i + 1) % MORPH.length;
        cham.destroy();
        cham = createVisual(this, MORPH[i], 150, cy + 20, 56);
        this.tweens.add({ targets: cham, scale: { from: 0.5, to: 1 }, duration: 200, ease: 'Back.Out' });
      },
    });

    const cone = this.add.graphics();
    const boss = createVisual(this, 'boss', 330, cy, 52);
    const label = addText(this, 330, cy - 40, '부장님', { size: 12, bold: true, stroke: '#000', strokeThickness: 3 });
    const state = { x: 330, dir: -1 };
    this.tweens.add({
      targets: state,
      x: 250,
      yoyo: true,
      repeat: -1,
      duration: 2400,
      ease: 'Sine.InOut',
      onYoyo: () => (state.dir = 1),
      onRepeat: () => (state.dir = -1),
      onUpdate: () => {
        boss.setX(state.x).setScale(state.dir < 0 ? -1 : 1, 1);
        label.setX(state.x);
        cone.clear().fillStyle(COLORS.fovIdle, 0.22);
        const a = state.dir < 0 ? Math.PI : 0;
        cone.slice(state.x, cy, 110, a - 0.55, a + 0.55).fillPath();
      },
    });
  }
}
