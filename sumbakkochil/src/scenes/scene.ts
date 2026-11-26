import type { Ctx } from '../render/draw';
import type { Pt } from '../ui/button';

export interface Scene {
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  render(ctx: Ctx): void;
  pointerDown?(p: Pt): void;
  /** pts: 이번 이벤트에 합쳐진(coalesced) 모든 좌표 — 빠른 드래그도 끊기지 않게 */
  pointerMove?(p: Pt, pts: Pt[]): void;
  pointerUp?(p: Pt): void;
}

export interface SceneHost {
  go(scene: Scene): void;
  /** 논리 1px 당 실제 캔버스 픽셀 수 (선명한 오프스크린 렌더링용) */
  pixelScale(): number;
}
