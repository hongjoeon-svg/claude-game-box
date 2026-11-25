/**
 * 광고 호출 지점. 실제 SDK(AdMob 등)는 아직 연결하지 않았다.
 * Capacitor 플러그인을 붙일 때 아래 두 함수 안만 채우면 된다.
 */

const AD_FREE_KEY = 'meetingSeats.adFree';

/** "광고 제거" 구매 여부 */
export function isAdFree(): boolean {
  try {
    return localStorage.getItem(AD_FREE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAdFree(v: boolean): void {
  try {
    localStorage.setItem(AD_FREE_KEY, v ? 'true' : 'false');
  } catch {
    /* 무시 */
  }
}

/**
 * 보상형 광고. 끝까지 봤으면 true (보상 지급).
 * 광고 제거를 샀으면 광고 없이 바로 true.
 */
export async function showRewardedAd(placement: string): Promise<boolean> {
  if (isAdFree()) return true;
  // TODO: 실제 보상형 광고 SDK 연결
  console.info(`[ads] rewarded: ${placement} (SDK 미연결 → 보상 지급으로 처리)`);
  return true;
}

/** 전면 광고. 광고 제거를 샀으면 건너뛴다. */
export async function showInterstitial(placement: string): Promise<void> {
  if (isAdFree()) return;
  // TODO: 실제 전면 광고 SDK 연결
  console.info(`[ads] interstitial: ${placement} (SDK 미연결)`);
}

/** 전면 광고는 레벨 3개 클리어마다 한 번 (첫 5레벨은 없음) */
export function shouldShowInterstitial(level: number, clears: number): boolean {
  return level > 5 && clears > 0 && clears % 3 === 0;
}
