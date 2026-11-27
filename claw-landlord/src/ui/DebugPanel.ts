// =====================================================================
//  손맛 튜닝용 디버그 패널 — 주소 끝에 ?debug 를 붙이면 나타납니다.
//  슬라이더로 바꾼 값은 바로 적용되고, 마음에 들면 config.ts 에 옮겨 적으세요.
// =====================================================================
import { CONFIG } from '../config';

type Group = Record<string, unknown>;

const KNOBS: [group: keyof typeof CONFIG, key: string, min: number, max: number, step: number, label: string][] = [
  ['grip', 'strength', 0, 1, 0.01, '집게 힘'],
  ['grip', 'qualityWeight', 0, 1, 0.01, '잡은 위치 영향'],
  ['grip', 'holdStiffness', 0.02, 0.4, 0.01, '매달림 스프링'],
  ['grip', 'wobbleTime', 0.1, 1.5, 0.05, '버티기 시간'],
  ['grip', 'fakeWobbleChance', 0, 1, 0.05, '가짜 흔들림 확률'],
  ['claw', 'moveMaxSpeed', 60, 320, 5, '좌우 속도'],
  ['claw', 'moveAccel', 200, 2000, 50, '가속'],
  ['claw', 'swayFromAccel', 0, 2, 0.05, '흔들림 세기'],
  ['claw', 'swayDamping', 0.5, 12, 0.1, '흔들림 감쇠'],
  ['claw', 'descendSpeed', 60, 400, 5, '내려가는 속도'],
  ['claw', 'liftSpeed', 40, 300, 5, '올라가는 속도'],
  ['claw', 'closeTime', 0.15, 1.2, 0.05, '오므리는 시간'],
  ['claw', 'sinkDepth', 0, 30, 1, '파고드는 깊이'],
  ['claw', 'openAngle', 0.2, 1.1, 0.02, '벌림 각도'],
];

export function mountDebugPanel(onToggleOverlay: (on: boolean) => void): void {
  const el = document.createElement('div');
  el.id = 'debugPanel';
  let html = '<b>손맛 튜닝</b> <label><input type="checkbox" id="dbgOverlay" checked> 충돌선 표시</label>';
  KNOBS.forEach(([g, k, min, max, step, label], i) => {
    const v = (CONFIG[g] as Group)[k] as number;
    html += `<label><div class="row"><span>${label}</span><span id="dbgv${i}">${v}</span></div>
      <input type="range" id="dbg${i}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;
  });
  html += '<button id="dbgCopy">현재 값 복사</button>';
  el.innerHTML = html;
  document.body.appendChild(el);
  // 패널 위 터치가 게임으로 새지 않게
  el.addEventListener('pointerdown', (e) => e.stopPropagation());

  KNOBS.forEach(([g, k], i) => {
    const input = document.getElementById(`dbg${i}`) as HTMLInputElement;
    input.addEventListener('input', () => {
      (CONFIG[g] as Group)[k] = Number(input.value);
      document.getElementById(`dbgv${i}`)!.textContent = input.value;
    });
  });
  const overlay = document.getElementById('dbgOverlay') as HTMLInputElement;
  overlay.addEventListener('change', () => onToggleOverlay(overlay.checked));
  onToggleOverlay(true);
  document.getElementById('dbgCopy')!.addEventListener('click', () => {
    const text = KNOBS.map(([g, k]) => `${g}.${k} = ${(CONFIG[g] as Group)[k]}`).join('\n');
    void navigator.clipboard?.writeText(text);
    alert(text);
  });
}
