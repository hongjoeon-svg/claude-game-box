/** 클리어 창: "회의 성공!" + 시간 + 별 */
import { faceImg } from '../characters';
import { formatTime, h, ICONS } from '../ui/dom';
import type { ClearInfo } from './gameScreen';

export interface ClearActions {
  primaryLabel: string;
  onPrimary(): void;
  onHome(): void;
  onRetry(): void;
}

export function showClear(info: ClearInfo, subtitle: string, actions: ClearActions) {
  const close = (fn: () => void) => {
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 200);
    fn();
  };
  const hintText = info.hints === 0 ? '힌트 없이 완벽하게!' : `힌트 ${info.hints}번 사용`;
  const wrap = h(
    'div',
    { class: 'modal-wrap clear-wrap' },
    h('div', { class: 'confetti', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'modal clear', role: 'dialog', 'aria-modal': 'true', 'aria-label': '회의 성공' },
      h('div', { class: 'clear-faces' }, ...info.chars.slice(0, 5).map((c, i) => {
        const img = faceImg(c.id, 'clear-face');
        img.style.setProperty('--i', String(i));
        return img;
      })),
      h('h2', { class: 'clear-title' }, '회의 성공!'),
      h('p', { class: 'clear-sub' }, subtitle),
      h('div', { class: 'clear-stars' }, ...[0, 1, 2].map((i) => {
        const s = h('span', { class: `big-star ${i < info.stars ? 'on' : 'off'}`, html: ICONS.star });
        s.style.setProperty('--i', String(i));
        return s;
      })),
      h(
        'div',
        { class: 'clear-stats' },
        h('div', null, h('small', null, '클리어 시간'), h('b', null, formatTime(info.time)), info.isBest ? h('span', { class: 'best' }, '최고 기록!') : null),
        h('div', null, h('small', null, '힌트'), h('b', null, String(info.hints)), h('span', { class: 'muted' }, hintText)),
      ),
      h('button', { class: 'btn primary wide', onclick: () => close(actions.onPrimary) }, actions.primaryLabel),
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { class: 'btn ghost', onclick: () => close(actions.onHome) }, '홈으로'),
        h('button', { class: 'btn ghost', onclick: () => close(actions.onRetry) }, '다시 하기'),
      ),
    ),
  );
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
}
