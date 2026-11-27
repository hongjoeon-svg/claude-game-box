// =====================================================================
//  진동(햅틱) — 지금은 브라우저 vibrate (안드로이드 크롬만 지원, iOS 사파리는 무시됨)
//  5단계에서 Capacitor Haptics 플러그인으로 이 함수 안만 바꾸면 됩니다.
// =====================================================================

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'fail';

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 18,
  heavy: 35,
  success: [20, 40, 30],
  fail: [40, 30, 15],
};

export function haptic(kind: HapticKind): void {
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    /* 지원 안 하면 무시 */
  }
}
