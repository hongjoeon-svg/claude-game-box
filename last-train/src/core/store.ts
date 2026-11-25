import type { AnomalyPack } from '../anomalies/types';
import type { SaveData } from './save';

/**
 * 추가 노선(이상현상 팩) 인앱 결제 자리.
 * 앱스토어 출시 시 Capacitor 인앱결제 플러그인(예: RevenueCat, cordova-plugin-purchase)으로
 * purchase()/restore() 안쪽만 바꾸면 된다. 구매 성공 시 productId 를 entitlements 에 기록.
 */
export function isPackOwned(pack: AnomalyPack, save: SaveData): boolean {
  return pack.productId === null || save.entitlements.includes(pack.productId);
}

export async function purchasePack(pack: AnomalyPack, save: SaveData): Promise<boolean> {
  if (!pack.productId || pack.comingSoon) return false;
  // TODO(IAP): 네이티브 결제 호출 → 성공 시 아래 실행
  void save;
  return false;
}

export async function restorePurchases(save: SaveData): Promise<string[]> {
  // TODO(IAP): 네이티브 구매 복원 → save.entitlements 갱신
  return save.entitlements;
}
