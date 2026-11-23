import { COLORS, GAME_WIDTH } from '../config';
import { makeButton } from '../ui/Button';
import { addText } from '../ui/text';
import { BaseScene } from './BaseScene';

export class TitleScene extends BaseScene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.setupCamera();
    this.cameras.main.setBackgroundColor(COLORS.bg);
    addText(this, GAME_WIDTH / 2, 260, '칼퇴 카멜레온', { size: 40, bold: true });
    makeButton(this, GAME_WIDTH / 2, 520, 240, 64, '시작하기', () => this.scene.start('StageSelect'), { size: 22 });
  }
}
