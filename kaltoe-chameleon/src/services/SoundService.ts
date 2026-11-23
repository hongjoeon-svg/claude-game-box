import Phaser from 'phaser';
import { SFX, type SfxAsset, type SfxKey } from '../assets';
import { SaveData } from './SaveData';

/**
 * 효과음 재생. assets.ts 의 SFX[key].file 이 있고 로드돼 있으면 그 파일을,
 * 없으면 WebAudio 합성음으로 대신 재생합니다.
 */
class SoundServiceImpl {
  private game?: Phaser.Game;
  private ctx?: AudioContext;

  attach(game: Phaser.Game): void {
    this.game = game;
  }

  get enabled(): boolean {
    return SaveData.soundOn;
  }

  set enabled(on: boolean) {
    SaveData.soundOn = on;
  }

  /** iOS는 사용자 터치 안에서 오디오를 한 번 깨워야 소리가 납니다 */
  unlock(): void {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* 오디오 미지원 */
    }
  }

  play(key: SfxKey): void {
    if (!this.enabled) return;
    const def: SfxAsset = SFX[key];
    const cacheKey = `sfx_${key}`;
    if (def.file && this.game?.cache.audio.exists(cacheKey)) {
      this.game.sound.play(cacheKey);
      return;
    }
    this.synth(def.synth);
  }

  private synth({ freqs, dur, type = 'sine', vol = 0.07 }: SfxAsset['synth']): void {
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      const seg = dur / freqs.length;
      const t0 = ctx.currentTime;
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = f;
        const s = t0 + i * seg;
        gain.gain.setValueAtTime(vol, s);
        gain.gain.exponentialRampToValueAtTime(0.0001, s + seg * 0.95);
        osc.connect(gain).connect(ctx.destination);
        osc.start(s);
        osc.stop(s + seg);
      });
    } catch {
      /* 무시 */
    }
  }
}

export const Sound = new SoundServiceImpl();

/** 진동 자리 (iOS 웹에서는 동작하지 않음 → 나중에 @capacitor/haptics 로 교체) */
export function vibrate(ms = 80): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 무시 */
  }
}
