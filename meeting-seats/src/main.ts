import './style.css';
import { shouldShowInterstitial, showInterstitial } from './ads';
import { dateKey, generateDaily, generateLevel, LEVEL_COUNT } from './core/levels';
import type { GeneratedPuzzle } from './core/generator';
import { showClear } from './screens/clear';
import { GameScreen } from './screens/gameScreen';
import { homeScreen, levelsScreen, type Nav, settingsScreen, showRules } from './screens/menus';
import * as store from './storage';
import { unlockAudio } from './audio';

const app = document.getElementById('app')!;
let game: GameScreen | null = null;

const cache = new Map<string, GeneratedPuzzle>();
function cached(key: string, make: () => GeneratedPuzzle): GeneratedPuzzle {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

function mount(el: HTMLElement) {
  game?.destroy();
  game = null;
  document.getElementById('toast')?.classList.remove('show');
  app.replaceChildren(el);
}

/** 레벨 진행 중 레벨 사이 전면 광고 */
async function gapThenPlay(level: number) {
  if (shouldShowInterstitial(level, store.load().clears)) await showInterstitial('level-gap');
  nav.playLevel(level);
}

const nav: Nav = {
  home: () => mount(homeScreen(nav)),
  levels: () => mount(levelsScreen(nav)),
  settings: () => mount(settingsScreen(nav)),
  playLevel(level: number) {
    const L = Math.max(1, Math.min(LEVEL_COUNT, level));
    if (L > store.load().unlocked) return nav.levels();
    const g = cached(`level-${L}`, () => generateLevel(L));
    const screen = new GameScreen(
      { kind: 'level', key: L, title: `레벨 ${L}`, puzzle: g.puzzle, difficulty: g.difficulty },
      {
        onBack: () => nav.levels(),
        onClear: (info) =>
          showClear(info, `레벨 ${L} 회의 끝!`, {
            primaryLabel: L < LEVEL_COUNT ? `다음 레벨 (${L + 1})` : '레벨 선택',
            onPrimary: () => (L < LEVEL_COUNT ? gapThenPlay(L + 1) : nav.levels()),
            onHome: () => nav.home(),
            onRetry: () => nav.playLevel(L),
          }),
      },
    );
    mount(screen.el);
    game = screen;
    // 처음 실행이면 규칙 안내
    if (!store.load().seenTutorial) showRules();
  },
  playDaily() {
    const key = dateKey();
    const g = cached(`daily-${key}`, () => generateDaily(key));
    const [, m, d] = key.split('-').map(Number);
    const screen = new GameScreen(
      { kind: 'daily', key, title: `오늘의 퍼즐 ${m}/${d}`, puzzle: g.puzzle, difficulty: g.difficulty },
      {
        onBack: () => nav.home(),
        onClear: (info) =>
          showClear(info, `${m}월 ${d}일 오늘의 퍼즐 완료! 내일 또 만나요`, {
            primaryLabel: '홈으로',
            onPrimary: () => nav.home(),
            onHome: () => nav.home(),
            onRetry: () => {
              store.update((s) => delete s.inProgress[`daily-${key}`]);
              nav.playDaily();
            },
          }),
      },
    );
    mount(screen.el);
    game = screen;
  },
};

window.addEventListener('pointerdown', unlockAudio, { once: true });

const q = new URLSearchParams(location.search);
if (import.meta.env.DEV && q.get('level')) {
  // 개발용: ?level=N 으로 잠긴 레벨도 바로 열기
  const L = Number(q.get('level'));
  store.update((d) => (d.unlocked = Math.max(d.unlocked, L)));
  nav.playLevel(L);
}
else if (q.get('daily') !== null) nav.playDaily();
else nav.home();
