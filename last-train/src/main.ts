import './style.css';
import { Game } from './core/game';

const app = document.getElementById('app')!;
app.innerHTML = `
  <canvas id="view"></canvas>
  <div class="vignette"></div>
  <div id="title" class="screen">
    <div class="title-wrap">
      <div class="title-sub">심야순환선</div>
      <h1 class="title">막차 이상현상</h1>
      <p class="title-desc">이상현상이 없으면 앞 칸으로.<br>하나라도 있으면 돌아서 뒤 칸으로.</p>
    </div>
    <div class="menu"><button class="btn primary" id="board">탑승하기</button></div>
  </div>
  <div id="fade"></div>
`;
const fadeEl = document.getElementById('fade')!;
const fade = (to: number, ms: number) =>
  new Promise<void>((r) => {
    fadeEl.style.transitionDuration = `${ms}ms`;
    fadeEl.style.opacity = String(to);
    window.setTimeout(r, ms);
  });

const game = new Game(document.getElementById('view') as HTMLCanvasElement, {
  fade,
  onEnding: async () => {
    await fade(1, 1200);
    game.audio.stop();
    game.toTitle();
    document.getElementById('title')!.classList.remove('hidden');
    await fade(0, 800);
  },
});

document.getElementById('board')!.addEventListener('click', async () => {
  game.audio.unlock();
  game.audio.start();
  await fade(1, 400);
  document.getElementById('title')!.classList.add('hidden');
  game.startRun();
  await fade(0, 700);
});

// 개발 중 콘솔/자동 테스트용
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
