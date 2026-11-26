// 광고 자리 (지금은 연결하지 않음 — 콘솔 로그만)
// 사용처(Phase 3): 실패 시 "광고 보고 칠하기 시간 +10초로 재도전", 3스테이지마다 전면 광고

/** 보상형 광고. 끝까지 봤으면 true */
export async function showRewardedAd(placement: string): Promise<boolean> {
  console.log('[ads] showRewardedAd', placement);
  return true;
}

export async function showInterstitial(placement: string): Promise<void> {
  console.log('[ads] showInterstitial', placement);
}
