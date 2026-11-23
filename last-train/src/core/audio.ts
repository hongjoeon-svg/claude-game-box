/**
 * 모든 소리는 WebAudio 로 실시간 합성 (외부 음원 파일 없음).
 *  - 주행음: 저역 노이즈 + 레일 이음매 "덜컹-덜컹"
 *  - 형광등 웅웅거림: 120Hz 톱니파
 *  - 안내 방송: 차임 + 웅얼거리는 PA 목소리를 미리 렌더링 → 거꾸로 재생 가능
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private rumbleGain!: GainNode;
  private humGain!: GainNode;
  private noise!: AudioBuffer;
  private announce: AudioBuffer | null = null;
  private announceRev: AudioBuffer | null = null;
  private nextClack = 0;
  private clackOn = true;
  private volume = 0.8;
  private timer: number | null = null;
  private running = false;

  /** 사용자 제스처(탑승하기 탭) 안에서 호출해야 iOS 에서 소리가 난다 */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.build();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    // 갈색 노이즈 버퍼
    const len = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    // 주행 저음
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.23;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 70;
    lfo.connect(lfoGain).connect(lp.frequency);
    src.connect(lp).connect(this.rumbleGain).connect(this.master);
    src.start();
    lfo.start();
    // 바람 소리 (고역 노이즈 약하게)
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    wind.playbackRate.value = 2.7;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0.05;
    wind.connect(bp).connect(wg).connect(this.rumbleGain);
    wind.start();
    // 형광등 험
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 120;
    const hum2 = ctx.createOscillator();
    hum2.type = 'sine';
    hum2.frequency.value = 240.6;
    const hlp = ctx.createBiquadFilter();
    hlp.type = 'lowpass';
    hlp.frequency.value = 700;
    const h2g = ctx.createGain();
    h2g.gain.value = 0.4;
    hum.connect(hlp);
    hum2.connect(h2g).connect(hlp);
    hlp.connect(this.humGain).connect(this.master);
    hum.start();
    hum2.start();
    void this.renderAnnouncement();
  }

  /** 주행 소리 켜기/끄기 (정지한 객차 이상현상, 종착역) */
  setTravel(on: boolean, fade = 0.4) {
    if (!this.ctx || (on && !this.running)) return;
    const t = this.ctx.currentTime;
    this.rumbleGain.gain.cancelScheduledValues(t);
    this.rumbleGain.gain.setTargetAtTime(on ? 0.55 : 0, t, fade);
    this.clackOn = on;
  }

  setHum(on: boolean) {
    if (!this.ctx || (on && !this.running)) return;
    this.humGain.gain.setTargetAtTime(on ? 0.022 : 0, this.ctx.currentTime, 0.08);
  }

  start() {
    if (!this.ctx || this.running) return;
    this.running = true;
    this.clackOn = true;
    this.setTravel(true, 1);
    this.setHum(true);
    this.nextClack = this.ctx.currentTime + 0.5;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  stop() {
    if (!this.ctx) return;
    this.running = false;
    this.setTravel(false, 0.3);
    this.setHum(false);
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** 레일 이음매: 바퀴 두 쌍이 연달아 지나가는 "덜컹-덜컹 … 덜컹-덜컹" */
  private schedule() {
    const ctx = this.ctx!;
    while (this.nextClack < ctx.currentTime + 0.3) {
      if (this.clackOn) {
        const t = this.nextClack;
        this.clack(t, 1);
        this.clack(t + 0.11, 0.8);
        this.clack(t + 0.82, 0.9);
        this.clack(t + 0.93, 0.7);
      }
      this.nextClack += 1.55 + Math.random() * 0.1;
    }
  }

  private clack(t: number, v: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 1.6;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 420 + Math.random() * 120;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9 * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 2, 0.15);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5 * v, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.14);
  }

  /** 발소리 */
  step() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 2, 0.1);
  }

  /** 미닫이문: 공기 빠지는 소리 + 덜컥 */
  door() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 3;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, 0, 0.6);
    this.thud(t + 0.48, 0.6);
  }

  /** 잠긴 문을 덜컹거림 */
  locked() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.thud(t, 0.5);
    this.thud(t + 0.13, 0.4);
  }

  private thud(t: number, v: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  }

  /** 점프스케어용 날카로운 소리 */
  sting() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const freqs = [311, 329.6, 466, 493.9, 987];
    for (const fr of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(fr, t);
      o.frequency.linearRampToValueAtTime(fr * 0.94, t + 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 1.5);
    }
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    s.connect(g).connect(this.master);
    s.start(t, 0, 0.7);
    this.thud(t, 1);
  }

  /** 정전 시 '틱' */
  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.04);
  }

  /** 낮게 깔리는 불길한 소리 (이상현상 일부에서) */
  drone(secs: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const fr of [55, 58.3]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = fr;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + secs * 0.4);
      g.gain.linearRampToValueAtTime(0, t + secs);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + secs + 0.1);
    }
  }

  /**
   * 안내 방송을 오프라인으로 한 번 렌더링해 둔다.
   * "딩-동-댕" 차임 + 포먼트 필터를 거친 웅얼거림(알아들을 수 없는 PA 목소리).
   */
  private async renderAnnouncement() {
    const sr = 22050;
    const dur = 4.6;
    const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    const off = new OAC(1, Math.ceil(sr * dur), sr);
    const out = off.createBiquadFilter();
    out.type = 'bandpass';
    out.frequency.value = 1400;
    out.Q.value = 0.5;
    out.connect(off.destination);
    // 차임
    [659.3, 523.3, 784, 1046.5].forEach((f, i) => {
      const t = 0.05 + i * 0.32;
      for (const [mul, amp] of [[1, 0.35], [2, 0.08], [3, 0.04]] as const) {
        const o = off.createOscillator();
        o.frequency.value = f * mul;
        const g = off.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 1.2);
      }
    });
    // 목소리: 글로탈 펄스(톱니) → 포먼트 2개 → 음절 엔벨로프
    const v0 = 1.75;
    const syl = 13;
    const src = off.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(190, v0);
    const env = off.createGain();
    env.gain.setValueAtTime(0, 0);
    const f1 = off.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 6;
    const f2 = off.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 8;
    const vowels: [number, number][] = [[750, 1200], [400, 2000], [300, 2300], [500, 900], [600, 1700]];
    let t = v0;
    for (let i = 0; i < syl; i++) {
      const [a, b] = vowels[Math.floor(Math.random() * vowels.length)];
      const len = 0.13 + Math.random() * 0.1;
      f1.frequency.setValueAtTime(a, t);
      f2.frequency.setValueAtTime(b, t);
      src.frequency.linearRampToValueAtTime(170 + Math.random() * 45 - (i / syl) * 30, t + len);
      env.gain.setValueAtTime(0.001, t);
      env.gain.linearRampToValueAtTime(0.9, t + 0.03);
      env.gain.linearRampToValueAtTime(0.5, t + len - 0.03);
      env.gain.linearRampToValueAtTime(0.02, t + len);
      t += len + (i % 4 === 3 ? 0.16 : 0.03);
    }
    const mix = off.createGain();
    mix.gain.value = 0.5;
    src.connect(f1).connect(mix);
    src.connect(f2).connect(mix);
    mix.connect(env).connect(out);
    src.start(v0);
    src.stop(t + 0.1);
    try {
      const buf = await off.startRendering();
      this.announce = buf;
      const rev = this.ctx!.createBuffer(1, buf.length, buf.sampleRate);
      const a = buf.getChannelData(0);
      const r = rev.getChannelData(0);
      for (let i = 0; i < a.length; i++) r[i] = a[a.length - 1 - i];
      this.announceRev = rev;
    } catch {
      /* 렌더링 실패 시 방송 생략 */
    }
  }

  announcement(reversed: boolean) {
    if (!this.ctx) return;
    const buf = reversed ? this.announceRev : this.announce;
    if (!buf) return;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 1.6;
    // 객차 스피커 느낌의 잔향을 살짝
    const d = this.ctx.createDelay();
    d.delayTime.value = 0.06;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.25;
    s.connect(g).connect(this.master);
    g.connect(d).connect(fb).connect(this.master);
    s.start();
  }
}
