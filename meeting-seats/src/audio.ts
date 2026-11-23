/**
 * 효과음: 외부 파일 없이 WebAudio 로 그때그때 합성한다.
 * 진동: navigator.vibrate 가 있을 때만. (iOS 사파리에는 없음 → Capacitor Haptics 로 교체 예정)
 */
import { settings } from './storage';

export type Sfx = 'cross' | 'place' | 'clear' | 'error' | 'undo' | 'hint' | 'win' | 'tap' | 'star';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** iOS 는 사용자 터치 안에서 오디오를 깨워야 한다 */
export function unlockAudio(): void {
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
}

interface Tone {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  at?: number;
}

function play(tones: Tone[]) {
  const c = ac();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume();
  const t0 = c.currentTime + 0.005;
  for (const t of tones) {
    const o = c.createOscillator();
    const g = c.createGain();
    const start = t0 + (t.at ?? 0);
    o.type = t.type ?? 'sine';
    o.frequency.setValueAtTime(t.freq, start);
    if (t.to) o.frequency.exponentialRampToValueAtTime(t.to, start + t.dur);
    const v = t.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(v, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    o.connect(g);
    g.connect(master);
    o.start(start);
    o.stop(start + t.dur + 0.02);
  }
}

const SOUNDS: Record<Sfx, Tone[]> = {
  tap: [{ freq: 900, dur: 0.04, type: 'triangle', vol: 0.15 }],
  cross: [{ freq: 520, to: 380, dur: 0.06, type: 'triangle', vol: 0.18 }],
  place: [
    { freq: 440, to: 880, dur: 0.09, type: 'sine', vol: 0.32 },
    { freq: 1320, dur: 0.08, type: 'sine', vol: 0.08, at: 0.03 },
  ],
  clear: [{ freq: 600, to: 300, dur: 0.08, type: 'sine', vol: 0.15 }],
  undo: [{ freq: 700, to: 450, dur: 0.07, type: 'triangle', vol: 0.15 }],
  error: [
    { freq: 180, dur: 0.12, type: 'square', vol: 0.12 },
    { freq: 150, dur: 0.16, type: 'square', vol: 0.12, at: 0.11 },
  ],
  hint: [
    { freq: 988, dur: 0.12, vol: 0.2 },
    { freq: 1319, dur: 0.22, vol: 0.2, at: 0.1 },
  ],
  star: [
    { freq: 1175, dur: 0.1, type: 'triangle', vol: 0.22 },
    { freq: 1760, dur: 0.18, type: 'sine', vol: 0.12, at: 0.05 },
  ],
  // 도-미-솔-도 + 반짝
  win: [
    { freq: 523, dur: 0.16, type: 'triangle', vol: 0.3 },
    { freq: 659, dur: 0.16, type: 'triangle', vol: 0.3, at: 0.12 },
    { freq: 784, dur: 0.16, type: 'triangle', vol: 0.3, at: 0.24 },
    { freq: 1047, dur: 0.45, type: 'triangle', vol: 0.32, at: 0.36 },
    { freq: 1568, dur: 0.3, type: 'sine', vol: 0.1, at: 0.42 },
    { freq: 2093, dur: 0.3, type: 'sine', vol: 0.08, at: 0.52 },
  ],
};

export function sfx(name: Sfx): void {
  if (!settings().sound) return;
  try {
    play(SOUNDS[name]);
  } catch {
    /* 오디오 실패는 무시 */
  }
}

export function vibrate(pattern: number | number[]): void {
  if (!settings().vibrate) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* 무시 */
    }
  }
}
