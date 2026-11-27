// =====================================================================
//  하단 조작부 — 레버(좌우 드래그, 양 끝을 누르면 버튼처럼) + 뽑기 버튼
//  데스크톱 테스트용으로 키보드(← → / 스페이스)도 지원
// =====================================================================

export class Controls {
  /** 레버 기울기 -1 ~ 1 */
  value = 0;
  onDrop: () => void = () => {};
  onFirstTouch: () => void = () => {};

  private track: HTMLElement;
  private knob: HTMLElement;
  private arrowL: HTMLElement;
  private arrowR: HTMLElement;
  private btn: HTMLButtonElement;
  private lever: HTMLElement;
  private pointerId: number | null = null;
  private keyL = false;
  private keyR = false;
  private enabled = true;

  constructor() {
    this.lever = document.getElementById('lever')!;
    this.track = this.lever.querySelector('.track')!;
    this.knob = this.lever.querySelector('.knob')!;
    this.arrowL = this.lever.querySelector('.arrow.left')!;
    this.arrowR = this.lever.querySelector('.arrow.right')!;
    this.btn = document.getElementById('dropBtn') as HTMLButtonElement;

    // ---- 레버 ----
    this.track.addEventListener('pointerdown', (e) => {
      this.onFirstTouch();
      this.pointerId = e.pointerId;
      this.track.setPointerCapture(e.pointerId);
      this.knob.classList.add('dragging');
      this.updateFromPointer(e.clientX);
    });
    this.track.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.pointerId) this.updateFromPointer(e.clientX);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.knob.classList.remove('dragging');
      this.setValue(0); // 손을 떼면 가운데로 툭 돌아감
    };
    this.track.addEventListener('pointerup', end);
    this.track.addEventListener('pointercancel', end);

    // ---- 뽑기 버튼 (pointerdown 으로 즉시 반응) ----
    this.btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onFirstTouch();
      if (!this.btn.disabled) this.onDrop();
    });

    // ---- 키보드 ----
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') this.keyL = true;
      else if (e.key === 'ArrowRight' || e.key === 'd') this.keyR = true;
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.onFirstTouch();
        if (!this.btn.disabled) {
          this.btn.classList.add('pressed');
          this.onDrop();
        }
      } else return;
      this.onFirstTouch();
      this.applyKeys();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.keyL = false;
      else if (e.key === 'ArrowRight' || e.key === 'd') this.keyR = false;
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') this.btn.classList.remove('pressed');
      this.applyKeys();
    });
  }

  private applyKeys(): void {
    if (this.pointerId !== null) return;
    this.setValue((this.keyR ? 1 : 0) - (this.keyL ? 1 : 0));
  }

  private updateFromPointer(clientX: number): void {
    const r = this.track.getBoundingClientRect();
    const knobR = this.knob.offsetWidth / 2;
    const half = r.width / 2 - knobR - 4;
    const raw = (clientX - (r.left + r.width / 2)) / half;
    this.setValue(Math.max(-1, Math.min(1, raw)));
  }

  private setValue(raw: number): void {
    // 가운데 살짝은 무시(데드존) + 작게 밀면 천천히 → 미세 조준 가능
    const dead = 0.1;
    const a = Math.abs(raw);
    const v = a < dead ? 0 : Math.sign(raw) * Math.pow((a - dead) / (1 - dead), 1.4);
    this.value = this.enabled ? v : 0;
    const r = this.track.getBoundingClientRect();
    const half = r.width / 2 - this.knob.offsetWidth / 2 - 4;
    this.knob.style.transform = `translateX(${raw * half}px)`;
    this.arrowL.classList.toggle('on', this.value < 0);
    this.arrowR.classList.toggle('on', this.value > 0);
  }

  /** 집게가 동작 중일 때는 조작 잠금 */
  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    this.btn.disabled = !on;
    this.lever.classList.toggle('disabled-lever', !on);
    if (!on) this.value = 0;
  }
}
