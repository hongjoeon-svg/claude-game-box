import Phaser from 'phaser';
import { EMOJI_FONT, RENDER_SCALE } from './config';

/**
 * ★ 에셋 키 레지스트리 ★
 * 지금은 이모지 플레이스홀더로 그립니다.
 * 실제 이미지로 바꾸려면 public/assets/ 에 파일을 넣고 `image` 경로만 채우세요.
 * (BootScene이 image가 있는 키를 자동으로 로드하고, createVisual이 이미지를 우선 사용합니다.)
 */
export interface VisualAsset {
  emoji: string;
  /** 예: 'assets/player.png' (public/ 기준 상대경로) */
  image?: string;
}

export const VISUALS = {
  player: { emoji: '🦎' },
  boss: { emoji: '👨‍💼' },
  manager: { emoji: '👩‍💼' },
  prop_plant: { emoji: '🪴' },
  prop_copier: { emoji: '🖨️' },
  prop_water: { emoji: '🚰' },
  prop_box: { emoji: '📦' },
  prop_chair: { emoji: '🪑' },
  elevator: { emoji: '🛗' },
  desk_pc: { emoji: '💻' },
  counter_cup: { emoji: '☕' },
  alert: { emoji: '❗' },
  question: { emoji: '❓' },
  surprise: { emoji: '‼️' },
} satisfies Record<string, VisualAsset>;

export type VisualKey = keyof typeof VISUALS;

/**
 * 효과음 키. `file`을 채우면 실제 사운드를 재생하고,
 * 비어 있으면 SoundService가 간단한 합성음(삐- 소리)으로 대신합니다.
 */
export interface SfxAsset {
  file?: string; // 예: 'assets/sfx/transform.mp3'
  /** 합성음 대체: 주파수(Hz) 목록, 길이(초), 파형 */
  synth: { freqs: number[]; dur: number; type?: OscillatorType; vol?: number };
}

export const SFX = {
  tap: { synth: { freqs: [660], dur: 0.05, type: 'square', vol: 0.05 } },
  transform: { synth: { freqs: [520, 780], dur: 0.12, type: 'triangle' } },
  revert: { synth: { freqs: [400, 300], dur: 0.08, type: 'triangle' } },
  alert: { synth: { freqs: [880, 880], dur: 0.1, type: 'square', vol: 0.06 } },
  surprise: { synth: { freqs: [990, 660], dur: 0.15, type: 'sawtooth', vol: 0.05 } },
  caught: { synth: { freqs: [440, 330, 220], dur: 0.45, type: 'sawtooth', vol: 0.08 } },
  clear: { synth: { freqs: [523, 659, 784, 1046], dur: 0.6, type: 'triangle' } },
  overtime: { synth: { freqs: [300, 250, 200], dur: 0.7, type: 'sine' } },
  star: { synth: { freqs: [1046, 1318], dur: 0.15, type: 'triangle' } },
} satisfies Record<string, SfxAsset>;

export type SfxKey = keyof typeof SFX;

export function textureKey(key: VisualKey): string {
  return `vis_${key}`;
}

/** 키에 맞는 표시 오브젝트 생성 (이미지가 로드돼 있으면 이미지, 아니면 이모지 텍스트) */
export function createVisual(
  scene: Phaser.Scene,
  key: VisualKey,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
  const tex = textureKey(key);
  if (scene.textures.exists(tex)) {
    return scene.add.image(x, y, tex).setDisplaySize(size, size);
  }
  return scene.add
    .text(x, y, VISUALS[key].emoji, {
      fontFamily: EMOJI_FONT,
      fontSize: `${Math.round(size * 0.82)}px`,
      padding: { top: 4, bottom: 4 },
      resolution: RENDER_SCALE,
    })
    .setOrigin(0.5);
}
