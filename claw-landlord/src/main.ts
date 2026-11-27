// =====================================================================
//  뽑기방 건물주 — 진입점
//  1단계: 기계 1대 / 집게 조작 → 물리로 집기 → 배출구 → 코인
// =====================================================================
import './style.css';
import { CONFIG } from './config';
import { preloadSprites } from './assets';
import { Machine, MachineEvent } from './game/Machine';
import { MachineRenderer } from './render/MachineRenderer';
import { Effects } from './fx/Effects';
import { sfx } from './audio/Sfx';
import { haptic } from './platform/haptics';
import { Controls } from './ui/Controls';
import { Hud } from './ui/Hud';
import { mountDebugPanel } from './ui/DebugPanel';

// ---- 게임 진행 상태 (2단계에서 저장/불러오기 붙일 자리) ----
const game = {
  coins: 0,
  caught: 0,
};

// ---- 가벼운 한국어 멘트 ----
const LINES = {
  empty: ['허공만 꽉!', '공기 한 줌 획득', '조준이 살짝…', '집게: 여기 아니야?'],
  slip: ['앗… 놓쳤다!', '손끝에서 툭…', '인형이 탈출했다', '집게야 힘 좀 내…', '아까비!!'],
  slipTop: ['꼭대기에서 덜컹…', '다 올라와 놓고?!'],
  slipCarry: ['거의 다 왔는데!!', '배출구 코앞에서…'],
  saved: ['휴… 버텼다!', '심장 떨어질 뻔', '제발제발제발'],
  win: ['득템!', '뽑았다!', '나이스 캐치!'],
  narrowWin: ['겨우 뽑았다!!', '아슬아슬 성공!', '기적의 집게!'],
  bonus: ['덤이다! 굴러 들어옴', '럭키! 떨어진 김에 쏙'],
};
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// ---- 초기화 ----
preloadSprites();
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const machine = new Machine();
const renderer = new MachineRenderer();
const fx = new Effects();
const controls = new Controls();
const hud = new Hud();
hud.setCoins(game.coins, false);

const debug = new URLSearchParams(location.search).has('debug');
if (debug) {
  mountDebugPanel((on) => (renderer.debug = on));
  (window as unknown as { __game: unknown }).__game = { machine, game, controls, CONFIG };
}

controls.onFirstTouch = () => sfx.unlock();
controls.onDrop = () => {
  if (machine.drop()) {
    haptic('light');
    controls.setEnabled(false);
  }
};
hud.onMuteToggle = (m) => sfx.setMuted(m);

// 이번 판에 아슬아슬한 순간이 있었는지 (성공 멘트 고르기용)
let hadWobble = false;

// ---- 기계 이벤트 → 소리·연출·코인 ----
machine.onEvent = (e: MachineEvent) => {
  switch (e.type) {
    case 'descend':
      hadWobble = false;
      sfx.descend();
      break;
    case 'touch':
      sfx.touch();
      break;
    case 'close':
      sfx.clunk();
      fx.shake(CONFIG.fx.shakeOnGrab);
      haptic('medium');
      break;
    case 'grab':
      fx.stars(e.doll.body.position.x, e.doll.body.position.y - e.doll.radius, 4);
      break;
    case 'empty':
      fx.floatText(machine.headX, machine.headY + 40, pick(LINES.empty), '#cfd6ff', 18);
      sfx.miss();
      break;
    case 'wobble':
      hadWobble = true;
      sfx.creak();
      haptic('light');
      break;
    case 'saved':
      fx.floatText(machine.headX, machine.headY + 70, pick(LINES.saved), '#7ee0ff', 18);
      sfx.saved();
      break;
    case 'slip': {
      fx.puff(e.x, e.y);
      sfx.slip();
      if (e.x < machine.partitionX + 6) {
        // 배출구 위에서 빠짐 → 어차피 들어감. 실패 멘트 대신 두근두근
        fx.floatText(e.x + 30, e.y, '어? 어?!', '#ffffff', 18);
        break;
      }
      const lines = e.phase === 'top' ? LINES.slipTop : e.phase === 'carry' ? LINES.slipCarry : LINES.slip;
      fx.showBanner(pick(lines), '', '#ff8fb1', 1.3);
      fx.shake(CONFIG.fx.shakeOnDrop);
      haptic('fail');
      break;
    }
    case 'topStop':
      sfx.topStop();
      fx.shake(1);
      break;
    case 'release':
      break;
    case 'collected': {
      const value = e.doll.def.value;
      game.coins += value;
      game.caught += 1;
      hud.setCoins(game.coins);
      hud.setCaught(game.caught);
      const title = e.bonus ? pick(LINES.bonus) : hadWobble ? pick(LINES.narrowWin) : pick(LINES.win);
      fx.showBanner(title, `${e.doll.def.name} · "${pick(e.doll.def.quips)}"`, '#ffe14d', 1.8);
      fx.floatText(e.x + 20, e.y - 40, `+${value}`, '#ffe14d', 26);
      fx.coins(e.x, e.y - 10, 12);
      fx.confetti(machine.W / 2, 150, 36);
      fx.shake(CONFIG.fx.shakeOnWin);
      sfx.win();
      setTimeout(() => sfx.coin(), 380);
      haptic('success');
      break;
    }
    case 'idle':
      controls.setEnabled(true);
      break;
  }
};

// ---- 캔버스 크기 (레티나 대응) ----
let dpr = 1;
function resize(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
new ResizeObserver(resize).observe(canvas);
resize();

// ---- 메인 루프: 물리는 60Hz 고정 스텝, 그리기는 화면 주사율대로 ----
const STEP_MS = 1000 / 60;
let acc = 0;
let last = performance.now();
let prevCable = machine.cableLen;
let prevTrolley = machine.trolleyX;

function frame(now: number): void {
  const dtMs = Math.min(100, now - last); // 탭 전환 후 폭주 방지
  last = now;
  acc += dtMs;

  machine.moveInput = controls.value;
  let steps = 0;
  while (acc >= STEP_MS && steps < 5) {
    machine.step();
    acc -= STEP_MS;
    steps++;
  }
  if (steps === 5) acc = 0;

  const dt = dtMs / 1000;
  // 모터 소리: 집게가 움직이는 만큼
  const moving = Math.abs(machine.cableLen - prevCable) + Math.abs(machine.trolleyX - prevTrolley);
  sfx.motor(Math.min(1, moving / (dt * 140 + 0.0001)), machine.cableLen > prevCable ? 0.6 : 1);
  prevCable = machine.cableLen;
  prevTrolley = machine.trolleyX;

  fx.update(dt);
  hud.update(dt);

  // 그리기: 캐비닛이 화면에 꽉 차게 (비율 유지)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / renderer.viewW, canvas.height / renderer.viewH);
  const ox = (canvas.width - renderer.viewW * scale) / 2;
  const oy = (canvas.height - renderer.viewH * scale) / 2;
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  renderer.draw(ctx, machine, fx, dt, '뽑기방 1호기');

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 앱이 백그라운드로 가면 소리 끄기 (3단계에서 오프라인 수익 계산도 여기에)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sfx.motor(0);
});
