/**
 * 보상형 광고 인터페이스.
 * 지금은 MockAdService(가짜 광고 화면)만 있습니다.
 * 출시 때 AdMob 등 SDK를 붙인 구현체를 만들고 아래 `adService` 한 줄만 바꾸면 됩니다.
 */
export type RewardPlacement = 'revive' | 'resetSuspicion';

export interface AdService {
  /** 광고를 바로 보여줄 수 있는지 */
  isRewardedReady(placement: RewardPlacement): boolean;
  /** 광고를 보여주고, 끝까지 봐서 보상을 받으면 true */
  showRewarded(placement: RewardPlacement): Promise<boolean>;
}

const PLACEMENT_LABEL: Record<RewardPlacement, string> = {
  revive: '들킨 순간 1회 부활',
  resetSuspicion: '의심 게이지 초기화',
};

/** 개발용 가짜 광고: 3초 카운트다운 화면을 띄웁니다 (실제 광고처럼 웹뷰 위를 덮는 DOM 오버레이) */
export class MockAdService implements AdService {
  constructor(private durationSec = 3) {}

  isRewardedReady(): boolean {
    return true;
  }

  showRewarded(placement: RewardPlacement): Promise<boolean> {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed;inset:0;z-index:9999;background:rgba(10,10,14,.94);color:#fff;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;gap:14px;font-family:"Apple SD Gothic Neo","Noto Sans KR",sans-serif;';
      el.innerHTML = `
        <div style="font-size:13px;opacity:.6">[테스트] 가짜 보상형 광고</div>
        <div style="font-size:56px">📺</div>
        <div style="font-size:18px;font-weight:bold">${PLACEMENT_LABEL[placement]}</div>
        <div data-count style="font-size:15px;opacity:.85"></div>
        <button data-skip style="margin-top:18px;background:none;border:1px solid #666;color:#aaa;border-radius:20px;padding:8px 16px;font-size:13px">건너뛰기 (보상 없음)</button>`;
      document.body.appendChild(el);
      const countEl = el.querySelector<HTMLElement>('[data-count]')!;
      let left = this.durationSec;
      const done = (rewarded: boolean) => {
        clearInterval(timer);
        el.remove();
        resolve(rewarded);
      };
      const tick = () => {
        countEl.textContent = left > 0 ? `${left}초 후 보상 지급` : '보상 지급!';
        if (left <= 0) setTimeout(() => done(true), 400);
        left--;
      };
      tick();
      const timer = window.setInterval(tick, 1000);
      el.querySelector('[data-skip]')!.addEventListener('click', () => done(false));
    });
  }
}

export const adService: AdService = new MockAdService();
