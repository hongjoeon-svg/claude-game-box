/** 홈, 레벨 선택, 설정, 게임 방법 */
import { isAdFree, setAdFree } from '../ads';
import { CHARACTERS, faceImg } from '../characters';
import { dailyConfig, dateKey, LEVEL_COUNT, levelConfig } from '../core/levels';
import { DIFFICULTY_LABEL } from '../core/types';
import * as store from '../storage';
import { confirmDialog, formatTime, h, ICONS, toast } from '../ui/dom';

export interface Nav {
  home(): void;
  levels(): void;
  settings(): void;
  playLevel(level: number): void;
  playDaily(): void;
}

function stars(k: number, cls = 'stars'): HTMLElement {
  return h('span', { class: cls }, ...[0, 1, 2].map((i) => h('span', { class: i < k ? 'on' : 'off', html: ICONS.star })));
}

export function totalStars(): number {
  return Object.values(store.load().levels).reduce((s, r) => s + r.stars, 0);
}

/** 오늘까지 이어진 오늘의 퍼즐 연속 일수 */
export function dailyStreak(today = new Date()): number {
  const done = store.load().daily;
  const d = new Date(today);
  if (!done[dateKey(d)]) d.setDate(d.getDate() - 1);
  let k = 0;
  while (done[dateKey(d)]) {
    k++;
    d.setDate(d.getDate() - 1);
  }
  return k;
}

/** 다음에 할 레벨 (진행 중 → 열린 것 중 안 깬 첫 레벨) */
export function nextLevel(): number {
  const d = store.load();
  return Math.min(LEVEL_COUNT, d.unlocked);
}

export function homeScreen(nav: Nav): HTMLElement {
  const d = store.load();
  const next = nextLevel();
  const today = dateKey();
  const dailyDone = d.daily[today];
  const dc = dailyConfig(today);
  const cleared = Object.keys(d.levels).length;
  const allDone = cleared >= LEVEL_COUNT;
  const parade = h('div', { class: 'parade' }, ...CHARACTERS.map((c, i) => {
    const img = faceImg(c.id, 'parade-face');
    img.style.setProperty('--i', String(i));
    img.style.setProperty('--rc', c.color);
    return img;
  }));
  const [, m, day] = today.split('-').map(Number);

  return h(
    'section',
    { class: 'screen home' },
    h('header', { class: 'topbar' }, h('div', { class: 'spacer' }), h('button', { class: 'icon-btn', 'aria-label': '설정', html: ICONS.gear, onclick: nav.settings })),
    h(
      'div',
      { class: 'home-hero' },
      h('div', { class: 'logo-plate' }, h('span', { class: 'logo-sub' }, '대회의실 B'), h('h1', null, '회의실', h('br'), '자리 배치')),
      parade,
      h('p', { class: 'tagline' }, '사이 나쁜 동료들, 붙여 앉히면 큰일 나요'),
    ),
    h(
      'div',
      { class: 'home-actions' },
      h(
        'button',
        { class: 'btn primary big', onclick: () => nav.playLevel(next) },
        h('span', { class: 'ico', html: ICONS.play }),
        allDone ? '레벨 200 다시 하기' : d.inProgress[`level-${next}`] ? `이어하기 · 레벨 ${next}` : `레벨 ${next} 시작`,
      ),
      h(
        'button',
        { class: 'card-btn daily', onclick: nav.playDaily },
        h('span', { class: 'card-ico', html: ICONS.calendar }),
        h(
          'span',
          { class: 'card-text' },
          h('b', null, '오늘의 퍼즐'),
          h('small', null, dailyDone ? `${m}/${day} 완료! ${formatTime(dailyDone.best)} · 연속 ${dailyStreak()}일` : `${m}월 ${day}일 · ${dc.n}×${dc.n} · ${DIFFICULTY_LABEL[dc.difficulty]}`),
        ),
        dailyDone ? stars(dailyDone.stars, 'stars small') : h('span', { class: 'new-dot' }, 'NEW'),
      ),
      h(
        'button',
        { class: 'card-btn', onclick: nav.levels },
        h('span', { class: 'card-ico', html: ICONS.grid }),
        h('span', { class: 'card-text' }, h('b', null, '레벨 선택'), h('small', null, `${cleared} / ${LEVEL_COUNT} 클리어 · ★ ${totalStars()}`)),
      ),
      h('button', { class: 'link-btn', onclick: () => showRules() }, '게임 방법'),
    ),
  );
}

export function levelsScreen(nav: Nav): HTMLElement {
  const d = store.load();
  const list = h('div', { class: 'level-list' });
  let section: HTMLElement | null = null;
  let lastKey = '';
  let scrollTarget: HTMLElement | null = null;
  for (let L = 1; L <= LEVEL_COUNT; L++) {
    const cfg = levelConfig(L);
    const key = `${cfg.n}`;
    if (key !== lastKey) {
      lastKey = key;
      let end = L;
      while (end < LEVEL_COUNT && levelConfig(end + 1).n === cfg.n) end++;
      section = h('div', { class: 'level-grid' });
      list.append(h('h3', { class: 'level-head' }, `레벨 ${L}–${end} · ${cfg.n}×${cfg.n}`), section);
    }
    const rec = d.levels[L];
    const locked = L > d.unlocked;
    const tile = h(
      'button',
      {
        class: `level-tile${rec ? ' done' : ''}${locked ? ' locked' : ''}${L === d.unlocked ? ' current' : ''} diff-${cfg.difficulty}`,
        disabled: locked,
        'aria-label': `레벨 ${L}${locked ? ' 잠김' : ''}`,
        onclick: () => nav.playLevel(L),
      },
      locked ? h('span', { class: 'ico', html: ICONS.lock }) : h('span', { class: 'num' }, String(L)),
      rec ? stars(rec.stars, 'stars tiny') : d.inProgress[`level-${L}`] ? h('span', { class: 'wip' }, '진행 중') : null,
    );
    if (L === d.unlocked) scrollTarget = tile;
    section!.append(tile);
  }
  const el = h(
    'section',
    { class: 'screen levels' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': '뒤로', html: ICONS.back, onclick: nav.home }),
      h('div', { class: 'title' }, h('strong', null, '레벨 선택'), h('span', { class: 'chip' }, `★ ${totalStars()} / ${LEVEL_COUNT * 3}`)),
      h('div', { class: 'spacer' }),
    ),
    h('div', { class: 'scroll' }, list),
  );
  requestAnimationFrame(() => scrollTarget?.scrollIntoView({ block: 'center' }));
  return el;
}

function toggleRow(label: string, desc: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const input = h('input', { type: 'checkbox', role: 'switch' }) as HTMLInputElement;
  input.checked = value;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'set-row' }, h('span', { class: 'set-text' }, h('b', null, label), h('small', null, desc)), h('span', { class: 'switch' }, input, h('i')));
}

export function settingsScreen(nav: Nav): HTMLElement {
  const s = store.settings();
  const set = (k: keyof store.Settings) => (v: boolean) => store.update((d) => (d.settings[k] = v));
  const adRow = h('div', { class: 'set-row' });
  const renderAd = () => {
    adRow.replaceChildren(
      h('span', { class: 'set-text' }, h('b', null, '광고 제거'), h('small', null, isAdFree() ? '구매 완료: 광고 없이 힌트를 쓸 수 있어요' : '힌트 광고와 레벨 사이 광고를 없애요')),
      isAdFree()
        ? h('span', { class: 'chip diff-easy' }, '구매함')
        : h(
            'button',
            {
              class: 'btn primary small',
              onclick: async () => {
                // TODO: 실제 인앱 결제 연결. 지금은 테스트용으로 바로 구매 처리
                if (await confirmDialog('광고 제거', '테스트 빌드: 결제 없이 광고 제거를 켤까요?', '켜기')) {
                  setAdFree(true);
                  renderAd();
                  toast('광고가 제거되었어요');
                }
              },
            },
            '구매',
          ),
    );
  };
  renderAd();
  return h(
    'section',
    { class: 'screen settings' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': '뒤로', html: ICONS.back, onclick: nav.home }),
      h('div', { class: 'title' }, h('strong', null, '설정')),
      h('div', { class: 'spacer' }),
    ),
    h(
      'div',
      { class: 'scroll' },
      h(
        'div',
        { class: 'set-group' },
        toggleRow('자동 X 표시', '사람을 앉히면 같은 줄·부서·주변 칸에 X를 흐리게 표시', s.autoX, set('autoX')),
        toggleRow('효과음', '탭, 배치, 클리어 소리', s.sound, set('sound')),
        toggleRow('진동', '지원하는 기기에서만 동작', s.vibrate, set('vibrate')),
      ),
      h('div', { class: 'set-group' }, adRow,
        h('button', { class: 'set-row link', onclick: () => toast('복원할 구매 내역이 없어요 (테스트 빌드)') }, h('span', { class: 'set-text' }, h('b', null, '구매 복원')))),
      h(
        'div',
        { class: 'set-group' },
        h('button', { class: 'set-row link', onclick: () => showRules() }, h('span', { class: 'set-text' }, h('b', null, '게임 방법'))),
        h(
          'button',
          {
            class: 'set-row link danger',
            onclick: async () => {
              if (await confirmDialog('기록 초기화', '모든 레벨 기록과 별, 진행 상황이 지워져요.\n되돌릴 수 없어요.', '지우기')) {
                store.resetAll();
                toast('기록을 지웠어요');
                nav.home();
              }
            },
          },
          h('span', { class: 'set-text' }, h('b', null, '기록 초기화')),
        ),
      ),
      h('p', { class: 'version' }, '회의실 자리 배치 v1.0'),
    ),
  );
}

export function showRules(onClose?: () => void) {
  const rule = (title: string, body: string, demo: string) =>
    h('li', null, h('span', { class: `rule-demo ${demo}` }), h('span', null, h('b', null, title), h('small', null, body)));
  const close = () => {
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 200);
    store.update((d) => (d.seenTutorial = true));
    onClose?.();
  };
  const wrap = h(
    'div',
    { class: 'modal-wrap' },
    h(
      'div',
      { class: 'modal rules', role: 'dialog', 'aria-modal': 'true' },
      h('h2', null, '자리 배치 규칙'),
      h(
        'ul',
        { class: 'rule-list' },
        rule('줄마다 한 명', '모든 가로줄과 세로줄에 정확히 한 명씩', 'd-row'),
        rule('부서마다 한 명', '같은 색 부서에서 딱 한 명만 회의에 와요', 'd-region'),
        rule('붙어 앉기 금지', '사이가 나빠서 대각선까지 8방향 모두 안 돼요', 'd-adj'),
      ),
      h(
        'div',
        { class: 'how' },
        h('p', null, h('b', null, '탭 1번'), ' X(여기 아님) → ', h('b', null, '2번'), ' 사람 앉히기 → ', h('b', null, '3번'), ' 비우기'),
        h('p', null, h('b', null, '드래그'), '하면 지나간 칸에 X를 연속으로 칠 수 있어요'),
      ),
      h('button', { class: 'btn primary wide', onclick: close }, '알겠어요!'),
    ),
  );
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
}
