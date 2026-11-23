import { Capacitor } from '@capacitor/core';
import { Haptics as CapHaptics, ImpactStyle } from '@capacitor/haptics';

/**
 * 진동. iOS 앱(Capacitor)에서는 @capacitor/haptics 의 Taptic Engine 을 쓰고,
 * 브라우저에서는 navigator.vibrate (iOS Safari 는 미지원 → 무시) 로 대체.
 */
type Style = 'LIGHT' | 'MEDIUM' | 'HEAVY';
const MAP: Record<Style, ImpactStyle> = { LIGHT: ImpactStyle.Light, MEDIUM: ImpactStyle.Medium, HEAVY: ImpactStyle.Heavy };

export class Haptics {
  enabled = true;
  private native = Capacitor.isNativePlatform();

  impact(style: Style = 'LIGHT') {
    if (!this.enabled) return;
    if (this.native) {
      CapHaptics.impact({ style: MAP[style] }).catch(() => undefined);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(style === 'HEAVY' ? 120 : style === 'MEDIUM' ? 40 : 15);
  }
}
