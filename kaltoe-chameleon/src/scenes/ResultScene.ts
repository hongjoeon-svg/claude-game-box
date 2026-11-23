import { COLORS, GAME_WIDTH } from '../config';
import { getStage, nextStageId } from '../data/stages';
import { SaveData, starCount } from '../services/SaveData';
import { makeButton } from '../ui/Button';
import { addText } from '../ui/text';
import { BaseScene } from './BaseScene';
import type { RunResult } from './GameScene';

const TITLES = {
  clear: { title: '칼퇴 성공!', sub: '오늘도 정시 퇴근 🎉', emoji: '🛗' },
  caught: { title: '들켰다…', sub: '"잠깐 자네, 이리 와봐"', emoji: '😱' },
  overtime: { title: '야근 엔딩', sub: '오후 6시가 지나버렸다… 🌙', emoji: '🌙' },
} as const;

export class ResultScene extends BaseScene {
  private result!: RunResult;

  constructor() {
    super('Result');
  }

  init(data: { result: RunResult }): void {
    this.result = data.result;
  }

  create(): void {
    this.setupCamera();
    const r = this.result;
    const stage = getStage(r.stageId)!;
    const cleared = r.outcome === 'clear';
    this.cameras.main.setBackgroundColor(cleared ? 0x1f3a2b : r.outcome === 'caught' ? 0x3a1f24 : 0x1c2140);

    const { stars, newBest } = SaveData.record(stage, {
      stageId: r.stageId,
      cleared,
      timeSec: r.timeSec,
      maxSuspicion: r.maxSuspicion,
    });
    const t = TITLES[r.outcome];

    addText(this, GAME_WIDTH / 2, 90, `STAGE ${stage.id} · ${stage.name}`, { size: 14, color: COLORS.subText });
    addText(this, GAME_WIDTH / 2, 190, t.emoji, { size: 72 });
    addText(this, GAME_WIDTH / 2, 290, t.title, { size: 36, bold: true });
    addText(this, GAME_WIDTH / 2, 334, t.sub, { size: 16, color: COLORS.subText });

    // 별 3개
    const labels = ['칼퇴 성공', '의심 50% 이하', `${stage.fastClearSec}초 안에`];
    stars.forEach((on, i) => {
      const x = GAME_WIDTH / 2 + (i - 1) * 120;
      addText(this, x, 410, on ? '★' : '☆', { size: 46, color: on ? '#ffd666' : '#555a66' });
      addText(this, x, 450, labels[i], { size: 11, color: on ? '#ffe7a3' : '#6f7685' });
    });

    const timeStr = cleared ? `${r.timeSec.toFixed(1)}초${newBest ? '  🏅 최고 기록!' : ''}` : '-';
    addText(this, GAME_WIDTH / 2, 500, `퇴근 시간: ${timeStr}`, { size: 15 });
    addText(this, GAME_WIDTH / 2, 526, `최대 의심: ${Math.floor(r.maxSuspicion)}%  ·  획득 별 ${starCount(stars)}개`, {
      size: 13,
      color: COLORS.subText,
    });

    const next = nextStageId(stage.id);
    let y = 600;
    if (cleared && next !== undefined) {
      makeButton(this, GAME_WIDTH / 2, y, 260, 58, '다음 스테이지 ▶', () => this.scene.start('Game', { stageId: next }), {
        size: 20,
      });
      y += 72;
    }
    makeButton(this, GAME_WIDTH / 2, y, 260, 54, '다시하기 ↺', () => this.scene.start('Game', { stageId: stage.id }), {
      color: cleared ? 0x3a3f4b : 0x4cd964,
      size: 18,
    });
    y += 66;
    makeButton(this, GAME_WIDTH / 2, y, 260, 46, '스테이지 선택', () => this.scene.start('StageSelect'), {
      color: 0x2c303b,
      size: 15,
    });
  }
}
