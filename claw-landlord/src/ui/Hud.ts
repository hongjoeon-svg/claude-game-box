// =====================================================================
//  상단 HUD — 코인, 뽑은 인형 수, 소리 버튼
// =====================================================================

export class Hud {
  private coinEl = document.getElementById('coinText')!;
  private caughtEl = document.getElementById('caughtText')!;
  private coinPill = this.coinEl.parentElement!;
  private muteBtn = document.getElementById('muteBtn') as HTMLButtonElement;
  private shownCoins = 0; // 화면에 보이는 값 (목표값까지 촤라락 올라감)
  private targetCoins = 0;
  onMuteToggle: (muted: boolean) => void = () => {};
  private muted = false;

  constructor() {
    this.muteBtn.addEventListener('click', () => {
      this.muted = !this.muted;
      this.muteBtn.textContent = this.muted ? '🔇' : '🔊';
      this.onMuteToggle(this.muted);
    });
  }

  setCoins(n: number, animate = true): void {
    this.targetCoins = n;
    if (!animate) {
      this.shownCoins = n;
      this.coinEl.textContent = format(n);
      return;
    }
    this.coinPill.classList.remove('pop');
    void this.coinPill.offsetWidth; // 애니메이션 다시 시작
    this.coinPill.classList.add('pop');
  }

  setCaught(n: number): void {
    this.caughtEl.textContent = format(n);
  }

  update(dt: number): void {
    if (this.shownCoins === this.targetCoins) return;
    const diff = this.targetCoins - this.shownCoins;
    const step = Math.max(1, Math.abs(diff) * Math.min(1, dt * 8));
    this.shownCoins += Math.sign(diff) * Math.min(Math.abs(diff), Math.ceil(step));
    this.coinEl.textContent = format(this.shownCoins);
  }
}

/** 1234567 → 1,234,567 (나중에 큰 수는 만/억 단위로 바꿀 예정) */
export function format(n: number): string {
  return Math.floor(n).toLocaleString('ko-KR');
}
