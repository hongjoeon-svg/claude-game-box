// =====================================================================
//  효과음 — 지금은 Web Audio 로 짧게 합성합니다 (파일 필요 없음).
//  나중에 녹음/구매한 효과음이 생기면 assets.ts 의 SOUNDS 에 경로를 넣고
//  play() 안에서 파일 재생으로 바꾸면 됩니다.
// =====================================================================

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private motorOsc: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  muted = false;

  /** iOS 는 첫 터치 이후에만 소리가 나므로, 터치할 때 호출 */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      // 모터 웅웅 소리 (집게가 움직이는 동안 볼륨이 올라감)
      this.motorOsc = this.ctx.createOscillator();
      this.motorOsc.type = 'sawtooth';
      this.motorOsc.frequency.value = 70;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      this.motorGain = this.ctx.createGain();
      this.motorGain.gain.value = 0;
      this.motorOsc.connect(lp).connect(this.motorGain).connect(this.master);
      this.motorOsc.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  /** 모터 소리 크기 (0~1), 음높이는 속도에 따라 */
  motor(level: number, pitch = 1): void {
    if (!this.ctx || !this.motorGain || !this.motorOsc) return;
    const t = this.ctx.currentTime;
    this.motorGain.gain.setTargetAtTime(level * 0.09, t, 0.05);
    this.motorOsc.frequency.setTargetAtTime(60 + 50 * pitch, t, 0.08);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.2, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 0.2, freq = 1200, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }

  // ---- 게임 효과음 ----
  button(): void {
    this.tone(660, 0.06, 'square', 0.12);
  }
  descend(): void {
    this.tone(520, 0.12, 'triangle', 0.15, 300);
  }
  touch(): void {
    this.noise(0.06, 0.25, 500);
  }
  clunk(): void {
    // 집게가 철컥 닫히는 소리
    this.noise(0.08, 0.35, 2200);
    this.tone(140, 0.12, 'square', 0.18, 90);
  }
  topStop(): void {
    this.noise(0.07, 0.3, 900);
    this.tone(110, 0.1, 'triangle', 0.2, 80);
  }
  creak(): void {
    // 놓치기 직전 끼이익
    this.tone(900, 0.35, 'sawtooth', 0.05, 1300);
    this.tone(930, 0.35, 'sawtooth', 0.04, 1250, 0.05);
  }
  slip(): void {
    // 뾰로롱~ 떨어지는 소리
    this.tone(700, 0.45, 'triangle', 0.22, 160);
  }
  thud(): void {
    this.noise(0.1, 0.3, 300);
  }
  miss(): void {
    this.tone(330, 0.18, 'square', 0.14, 300);
    this.tone(250, 0.32, 'square', 0.14, 180, 0.18);
  }
  saved(): void {
    this.tone(520, 0.09, 'triangle', 0.18);
    this.tone(780, 0.14, 'triangle', 0.18, undefined, 0.08);
  }
  win(): void {
    // 띠리링~ 상승 아르페지오
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, 'square', 0.13, undefined, i * 0.07));
    this.tone(1568, 0.4, 'triangle', 0.15, undefined, 0.38);
  }
  coin(): void {
    this.tone(988, 0.07, 'square', 0.12);
    this.tone(1319, 0.22, 'square', 0.12, undefined, 0.06);
  }
}

export const sfx = new SfxEngine();
