// 진입점: 캔버스 스케일링, 포인터 입력, 게임 루프, 씬 전환
import { Screen } from './render/screen';
import type { Scene, SceneHost } from './scenes/scene';
import { TitleScene } from './scenes/TitleScene';
import { loadSave } from './storage/storage';
import type { Pt } from './ui/button';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const screen = new Screen(canvas);
let scene: Scene | null = null;

const host: SceneHost = {
  go(next) {
    scene?.exit?.();
    scene = next;
    next.enter?.();
  },
  pixelScale: () => canvas.width / 1080,
};

// ── 입력: 손가락 하나만 추적 (멀티터치로 인한 오작동 방지) ──
let activePointer: number | null = null;
const toPt = (e: PointerEvent): Pt => screen.toLogical(e.clientX, e.clientY);

canvas.addEventListener('pointerdown', (e) => {
  if (activePointer !== null) return;
  activePointer = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  scene?.pointerDown?.(toPt(e));
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer) return;
  // getCoalescedEvents: 프레임 사이에 합쳐진 중간 좌표까지 받아 선이 매끄럽게
  const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
  const pts = events.length > 0 ? events.map(toPt) : [toPt(e)];
  scene?.pointerMove?.(toPt(e), pts);
  e.preventDefault();
});
const end = (e: PointerEvent) => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  scene?.pointerUp?.(toPt(e));
};
canvas.addEventListener('pointerup', end);
canvas.addEventListener('pointercancel', end);
// iOS 사파리 길게 누르기 메뉴/확대 방지
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ── 게임 루프 ──
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); // 탭 전환 후 큰 dt 방지
  last = now;
  if (scene) {
    scene.update(dt);
    screen.begin();
    scene.render(screen.ctx);
  }
  requestAnimationFrame(frame);
}

void loadSave().then(() => {
  host.go(new TitleScene(host));
  requestAnimationFrame(frame);
});
