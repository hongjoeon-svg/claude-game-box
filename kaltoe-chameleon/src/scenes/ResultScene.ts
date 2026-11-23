import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config';
import { getStage, nextStageId } from '../data/stages';
import { SaveData, starCount } from '../services/SaveData';
import { Sound } from '../services/SoundService';
import { makeButton } from '../ui/Button';
import { addText } from '../ui/text';
import { BaseScene } from './BaseScene';
import type { RunResult } from './GameScene';

const ENDINGS = {
  clear: {
    title: '칼퇴 성공!',
    lines: ['오늘도 정시 퇴근 🎉', '저녁이 있는 삶 🍗', '엘리베이터 문이 닫혔다… 자유다!'],
    emoji: '🛗',
    bg: 0x1f3a2b,
  },
  caught: {
    title: '들켰다…',
    lines: ['"잠깐 자네, 이리 와봐"', '"이것 좀 내일까지… 아니 오늘까지"', '"자네 요즘 한가해 보이던데?"'],
    emoji: '😱',
    bg: 0x3a1f24,
  },
  overtime: {
    title: '야근 엔딩',
    lines: ['오후 6시가 지나버렸다… 🌙', '편의점 도시락과 함께하는 밤', '퇴근은… 내일의 내가 하겠지'],
    emoji: '🌙',
    bg: 0x1c2140,
  },
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
    const ending = ENDINGS[r.outcome];
    this.cameras.main.setBackgroundColor(ending.bg);
    this.cameras.main.fadeIn(250);

    const { stars, newBest } = SaveData.record(stage, {
      stageId: r.stageId,
      cleared,
      timeSec: r.timeSec,
      maxSuspicion: r.maxSuspicion,
    });

    addText(this, GAME_WIDTH / 2, 80, `STAGE ${stage.id} · ${stage.name}`, { size: 14, color: COLORS.subText });
    const em = addText(this, GAME_WIDTH / 2, 180, ending.emoji, { size: 76 });
    this.tweens.add({ targets: em, scale: { from: 0, to: 1 }, duration: 450, ease: 'Back.Out' });
    if (!cleared) this.tweens.add({ targets: em, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 120, delay: 450, repeatDelay: 1400 });
    addText(this, GAME_WIDTH / 2, 280, ending.title, { size: 38, bold: true });
    addText(this, GAME_WIDTH / 2, 324, Phaser.Utils.Array.GetRandom([...ending.lines]), { size: 15, color: COLORS.subText });

    // 별 3개 (하나씩 팡!)
    const labels = ['칼퇴 성공', '의심 50% 이하', `${stage.fastClearSec}초 안에`];
    stars.forEach((on, i) => {
      const x = GAME_WIDTH / 2 + (i - 1) * 120;
      addText(this, x, 405, '☆', { size: 48, color: '#555a66' });
      addText(this, x, 446, labels[i], { size: 11, color: on ? '#ffe7a3' : '#6f7685' });
      if (on) {
        const s = addText(this, x, 405, '★', { size: 48, color: '#ffd666' }).setScale(0);
        this.tweens.add({
          targets: s,
          scale: 1,
          duration: 300,
          delay: 500 + i * 300,
          ease: 'Back.Out',
          onStart: () => Sound.play('star'),
        });
      }
    });

    const timeStr = cleared ? `${r.timeSec.toFixed(1)}초${newBest ? '  🏅 최고 기록!' : ''}` : '-';
    addText(this, GAME_WIDTH / 2, 494, `퇴근 소요: ${timeStr}`, { size: 15 });
    addText(this, GAME_WIDTH / 2, 520, `최대 의심 ${Math.floor(r.maxSuspicion)}%  ·  이번 판 별 ${starCount(stars)}개`, {
      size: 13,
      color: COLORS.subText,
    });

    const next = nextStageId(stage.id);
    let y = 596;
    if (cleared && next !== undefined) {
      makeButton(this, GAME_WIDTH / 2, y, 260, 58, '다음 스테이지 ▶', () => this.go('Game', { stageId: next }), { size: 20 });
      y += 72;
    } else if (cleared) {
      addText(this, GAME_WIDTH / 2, y - 10, '🎊 모든 스테이지 칼퇴 완료! 🎊', { size: 16, bold: true, color: '#ffd666' });
      y += 40;
    }
    makeButton(this, GAME_WIDTH / 2, y, 260, 54, '다시하기 ↺', () => this.go('Game', { stageId: stage.id }), {
      color: cleared ? 0x3a3f4b : 0x4cd964,
      size: 18,
    });
    y += 66;
    makeButton(this, GAME_WIDTH / 2, y, 260, 46, '스테이지 선택', () => this.go('StageSelect'), { color: 0x2c303b, size: 15 });

    if (cleared) this.confetti();
  }

  private go(key: string, data?: object): void {
    Sound.play('tap');
    this.scene.start(key, data);
  }

  private confetti(): void {
    const colors = [0xff6b6b, 0xffd666, 0x4cd964, 0x5ac8fa, 0xaf52de];
    for (let i = 0; i < 50; i++) {
      const p = this.add.rectangle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(-200, -10),
        Phaser.Math.Between(5, 9),
        Phaser.Math.Between(8, 14),
        Phaser.Utils.Array.GetRandom(colors),
      );
      this.tweens.add({
        targets: p,
        y: 820,
        x: p.x + Phaser.Math.Between(-60, 60),
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(1800, 3200),
        delay: Phaser.Math.Between(0, 800),
        onComplete: () => p.destroy(),
      });
    }
  }
}
