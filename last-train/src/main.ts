import './style.css';
import { Game } from './core/game';
import { loadSave, writeSave, resetProgress, type SaveData } from './core/save';
import { isPackOwned } from './core/store';
import { PACKS, allAnomalies } from './anomalies/registry';
import type { Anomaly } from './anomalies/types';
import { GOAL, TERMINAL } from './core/stations';

let save: SaveData = loadSave();
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const DIFF: Record<Anomaly['difficulty'], string> = { easy: '쉬움', normal: '보통', subtle: '은근함' };

const app = $('app');
app.innerHTML = `
  <canvas id="view"></canvas>
  <div class="vignette"></div>
  <div class="grain"></div>

  <div id="title" class="screen">
    <div class="title-wrap">
      <div class="title-sub">심야순환선</div>
      <h1 class="title">막차 이상현상</h1>
      <p class="title-desc">이상현상이 없으면 앞 칸으로.<br>하나라도 있으면 돌아서 뒤 칸으로.</p>
    </div>
    <div class="menu">
      <button class="btn primary" id="board">탑승하기</button>
      <button class="btn" id="open-dex">이상현상 도감 <span id="dex-count" class="muted"></span></button>
      <button class="btn" id="open-settings">설정</button>
    </div>
    <p id="record" class="record"></p>
    <p class="foot">헤드폰을 끼고 플레이하는 것을 권장합니다</p>
  </div>

  <button id="pause-btn" class="pause-btn hidden" aria-label="일시정지"><span></span><span></span></button>

  <div id="pause" class="screen dim hidden">
    <div class="panel">
      <h2>일시정지</h2>
      <div class="menu tight">
        <button class="btn primary" id="resume">계속하기</button>
        <button class="btn" id="pause-settings">설정</button>
        <button class="btn" id="pause-how">조작 방법</button>
        <button class="btn" id="quit">처음으로</button>
      </div>
    </div>
  </div>

  <div id="settings" class="screen dim hidden">
    <div class="panel">
      <h2>설정</h2>
      <label class="row"><span>시점 감도</span><input id="s-sens" type="range" min="0.4" max="2" step="0.05"></label>
      <label class="row"><span>소리</span><input id="s-vol" type="range" min="0" max="1" step="0.05"></label>
      <label class="row"><span>진동</span><input id="s-vib" type="checkbox" class="switch"></label>
      <div class="menu tight">
        <button class="btn small" id="s-how">조작 방법 다시 보기</button>
        <button class="btn small danger" id="s-reset">기록 초기화</button>
        <button class="btn primary" id="s-close">닫기</button>
      </div>
    </div>
  </div>

  <div id="how" class="screen dim hidden">
    <div class="panel">
      <h2>탑승 안내</h2>
      <ol class="rules">
        <li>당신은 막차 객차의 <b>뒤쪽 끝</b>에서 출발합니다.</li>
        <li>객차가 <b>평소와 같다면</b> → 끝까지 걸어가 <b>앞 칸 문</b>으로.</li>
        <li><b>이상현상이 하나라도</b> 있다면 → 돌아서 <b>뒤 칸 문</b>으로.<br><span class="muted">뒤 칸 문은 객차 중간까지 가 봐야 열립니다.</span></li>
        <li>맞히면 전광판 숫자가 1 오르고, 틀리면 0으로 돌아갑니다.</li>
        <li>숫자가 <b>${GOAL}</b>이 되면 종착역 ${TERMINAL}에 도착합니다.</li>
      </ol>
      <div class="controls">
        <div><b>화면 왼쪽</b> 드래그 — 이동</div>
        <div><b>화면 오른쪽</b> 드래그 — 둘러보기</div>
        <div class="muted">PC: WASD 이동 · 마우스로 시점 (클릭하면 커서 고정, Esc 해제)</div>
      </div>
      <p class="muted center">첫 칸은 평소의 모습입니다. 잘 기억해 두세요.</p>
      <div class="menu tight"><button class="btn primary" id="how-ok">알겠습니다</button></div>
    </div>
  </div>

  <div id="dex" class="screen dim hidden">
    <div class="panel tall">
      <div class="dex-head"><h2>이상현상 도감</h2><button class="btn small" id="dex-close">닫기</button></div>
      <div id="dex-body" class="dex-body"></div>
    </div>
  </div>

  <div id="ending" class="screen hidden">
    <div class="ending-wrap">
      <div class="title-sub dark">심야순환선 종착역</div>
      <h1 class="ending-title">${TERMINAL}</h1>
      <p class="ending-text">막차에서 내렸다.<br>승강장의 공기가 차갑고, 어디선가 첫차를 알리는 방송이 들린다.</p>
      <div id="ending-stats" class="stats"></div>
      <div class="menu">
        <button class="btn primary" id="again">다시 탑승하기</button>
        <button class="btn light" id="end-title">처음으로</button>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>
  <div id="fade"></div>
`;

// ── 페이드 ─────────────────────────────
const fadeEl = $('fade');
const fade = (to: number, ms: number) =>
  new Promise<void>((r) => {
    fadeEl.style.transitionDuration = `${ms}ms`;
    fadeEl.style.opacity = String(to);
    window.setTimeout(r, ms);
  });

// ── 토스트 ─────────────────────────────
let toastTimer = 0;
function toast(html: string) {
  const t = $('toast');
  t.innerHTML = html;
  t.classList.add('on');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('on'), 2600);
}

// ── 게임 ──────────────────────────────
const pool = () =>
  PACKS.filter((p) => isPackOwned(p, save) && !p.comingSoon)
    .flatMap((p) => p.anomalies)
    .filter((a) => !save.disabled.includes(a.id));

const game = new Game($<HTMLCanvasElement>('view'), {
  fade,
  pool,
  onDiscover(a) {
    if (save.discovered.includes(a.id)) return;
    save.discovered.push(a.id);
    writeSave(save);
    // 다음 칸이 밝아진 뒤에 알림
    window.setTimeout(() => toast(`<small>도감에 기록됨</small>${a.name}`), 900);
  },
  onCarDone(_correct, count) {
    if (count > save.best) {
      save.best = count;
      writeSave(save);
    }
  },
  onEnding: () => void showEnding(),
});

function applySettings() {
  game.sensitivity = save.settings.sensitivity;
  game.audio.setVolume(save.settings.volume);
  game.haptics.enabled = save.settings.vibration;
}
applySettings();

function show(id: string, on: boolean) {
  $(id).classList.toggle('hidden', !on);
}

function refreshTitle() {
  const total = pool().length;
  const found = save.discovered.filter((id) => allAnomalies().some((a) => a.id === id)).length;
  $('dex-count').textContent = `${found} / ${total}`;
  const parts: string[] = [];
  if (save.best > 0) parts.push(`최고 기록 ${save.best}`);
  if (save.clears > 0) parts.push(`종착역 도착 ${save.clears}회`);
  if (save.bestTime) parts.push(`최단 ${fmtTime(save.bestTime)}`);
  $('record').textContent = parts.join(' · ');
}
refreshTitle();

const fmtTime = (s: number) => `${Math.floor(s / 60)}분 ${String(Math.floor(s % 60)).padStart(2, '0')}초`;

// ── 탑승 ──────────────────────────────
let howThen: (() => void) | null = null;
async function board() {
  game.audio.unlock();
  if (!save.seenTutorial) {
    howThen = () => {
      save.seenTutorial = true;
      writeSave(save);
      void board();
    };
    show('how', true);
    return;
  }
  game.audio.start();
  await fade(1, 400);
  show('title', false);
  game.startRun();
  show('pause-btn', true);
  await fade(0, 800);
}
$('board').addEventListener('click', () => void board());

// ── 일시정지 ───────────────────────────
function pause() {
  if (game.mode !== 'playing' && game.mode !== 'ending') return;
  game.pause(true);
  show('pause', true);
}
$('pause-btn').addEventListener('click', pause);
$('pause-btn').addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (game.mode === 'paused' && !document.pointerLockElement && $('settings').classList.contains('hidden')) resume();
    else if (e.code === 'KeyP') pause();
  }
});
document.addEventListener('pointerlockchange', () => {
  // PC: Esc 로 커서 고정이 풀리면 일시정지
  if (!document.pointerLockElement && game.mode === 'playing') pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
function resume() {
  show('pause', false);
  game.pause(false);
}
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', async () => {
  show('pause', false);
  await fade(1, 400);
  game.audio.stop();
  game.toTitle();
  show('pause-btn', false);
  refreshTitle();
  show('title', true);
  await fade(0, 600);
});
$('pause-how').addEventListener('click', () => {
  howThen = null;
  show('how', true);
});

// ── 조작 방법 ──────────────────────────
$('how-ok').addEventListener('click', () => {
  show('how', false);
  const f = howThen;
  howThen = null;
  f?.();
});

// ── 설정 ──────────────────────────────
const sens = $<HTMLInputElement>('s-sens');
const vol = $<HTMLInputElement>('s-vol');
const vib = $<HTMLInputElement>('s-vib');
function openSettings() {
  sens.value = String(save.settings.sensitivity);
  vol.value = String(save.settings.volume);
  vib.checked = save.settings.vibration;
  show('settings', true);
}
sens.addEventListener('input', () => {
  save.settings.sensitivity = Number(sens.value);
  applySettings();
});
vol.addEventListener('input', () => {
  save.settings.volume = Number(vol.value);
  applySettings();
});
vib.addEventListener('change', () => {
  save.settings.vibration = vib.checked;
  applySettings();
  if (vib.checked) game.haptics.impact('MEDIUM');
});
$('s-close').addEventListener('click', () => {
  writeSave(save);
  show('settings', false);
});
$('s-how').addEventListener('click', () => {
  howThen = null;
  show('how', true);
});
$('s-reset').addEventListener('click', () => {
  if (!window.confirm('도감과 기록을 모두 지울까요? (설정과 구매 내역은 유지됩니다)')) return;
  save = resetProgress(save);
  refreshTitle();
  toast('기록을 초기화했습니다');
});
$('open-settings').addEventListener('click', openSettings);
$('pause-settings').addEventListener('click', openSettings);

// ── 도감 ──────────────────────────────
function renderDex() {
  const body = $('dex-body');
  body.innerHTML = '';
  for (const pack of PACKS) {
    const owned = isPackOwned(pack, save);
    const sec = document.createElement('section');
    sec.className = 'dex-pack';
    if (pack.comingSoon || !owned) {
      sec.innerHTML = `
        <div class="pack-head"><h3>${pack.name}</h3><span class="badge lock">추가 노선</span></div>
        <div class="pack-locked">
          <div class="lock-icon">🔒</div>
          <p>${pack.desc}</p>
          <button class="btn small" disabled>${pack.comingSoon ? '준비 중' : '구매하기'}</button>
        </div>`;
      body.appendChild(sec);
      continue;
    }
    const found = pack.anomalies.filter((a) => save.discovered.includes(a.id)).length;
    sec.innerHTML = `<div class="pack-head"><h3>${pack.name}</h3><span class="badge">${found} / ${pack.anomalies.length}</span></div>
      <div class="progress"><i style="width:${(found / Math.max(1, pack.anomalies.length)) * 100}%"></i></div>`;
    const grid = document.createElement('div');
    grid.className = 'dex-grid';
    pack.anomalies.forEach((a, i) => {
      const got = save.discovered.includes(a.id);
      const card = document.createElement('div');
      card.className = 'dex-card' + (got ? ' got' : '');
      card.innerHTML = got
        ? `<div class="no">No.${String(i + 1).padStart(2, '0')} <span class="diff ${a.difficulty}">${DIFF[a.difficulty]}</span></div><h4>${a.name}</h4><p>${a.desc}</p>`
        : `<div class="no">No.${String(i + 1).padStart(2, '0')} <span class="diff ${a.difficulty}">${DIFF[a.difficulty]}</span></div><h4>???</h4><p class="muted">아직 발견하지 못했다.</p>`;
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    body.appendChild(sec);
  }
}
$('open-dex').addEventListener('click', () => {
  renderDex();
  show('dex', true);
});
$('dex-close').addEventListener('click', () => show('dex', false));

// ── 엔딩 ──────────────────────────────
async function showEnding() {
  fadeEl.classList.add('white');
  await fade(1, 1600);
  const secs = (performance.now() - game.runStart) / 1000;
  save.clears++;
  save.best = Math.max(save.best, GOAL);
  if (!save.bestTime || secs < save.bestTime) save.bestTime = secs;
  writeSave(save);
  game.audio.stop();
  show('pause-btn', false);
  const total = pool().length;
  const found = save.discovered.length;
  $('ending-stats').innerHTML = `
    <div><span>지나온 칸</span><b>${game.runCars}칸</b></div>
    <div><span>걸린 시간</span><b>${fmtTime(secs)}</b></div>
    <div><span>도감</span><b>${found} / ${total}</b></div>`;
  show('ending', true);
  await fade(0, 1200);
  fadeEl.classList.remove('white');
  game.toTitle();
}
$('again').addEventListener('click', async () => {
  await fade(1, 400);
  show('ending', false);
  game.audio.unlock();
  game.audio.start();
  game.startRun();
  show('pause-btn', true);
  await fade(0, 700);
});
$('end-title').addEventListener('click', async () => {
  await fade(1, 400);
  show('ending', false);
  refreshTitle();
  show('title', true);
  await fade(0, 600);
});

// ── 개발용: ?debug → FPS 표시 + 이상현상 켜고 끄기 ──
if (new URLSearchParams(location.search).has('debug')) {
  const panel = document.createElement('details');
  panel.className = 'debug';
  panel.innerHTML = `<summary>이상현상 on/off</summary>` +
    allAnomalies()
      .map((a) => `<label><input type="checkbox" data-id="${a.id}" ${save.disabled.includes(a.id) ? '' : 'checked'}> ${a.name}</label>`)
      .join('');
  panel.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    const id = el.dataset.id!;
    save.disabled = el.checked ? save.disabled.filter((x) => x !== id) : [...save.disabled, id];
    writeSave(save);
  });
  document.body.appendChild(panel);
}

// 개발 중 콘솔/자동 테스트용
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
