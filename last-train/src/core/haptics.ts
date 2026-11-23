/**
 * 진동. Capacitor 앱으로 감싸면 @capacitor/haptics 플러그인(전역 Capacitor.Plugins.Haptics)을 쓰고,
 * 브라우저에서는 navigator.vibrate (iOS Safari 는 미지원 → 무시) 로 대체.
 */
type Style = 'LIGHT' | 'MEDIUM' | 'HEAVY';
interface HapticsPlugin { impact(o: { style: Style }): Promise<void> }

export class Haptics {
  enabled = true;
  private plugin(): HapticsPlugin | null {
    const cap = (window as unknown as { Capacitor?: { Plugins?: { Haptics?: HapticsPlugin } } }).Capacitor;
    return cap?.Plugins?.Haptics ?? null;
  }
  impact(style: Style = 'LIGHT') {
    if (!this.enabled) return;
    const p = this.plugin();
    if (p) {
      p.impact({ style }).catch(() => undefined);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(style === 'HEAVY' ? 120 : style === 'MEDIUM' ? 40 : 15);
  }
}
