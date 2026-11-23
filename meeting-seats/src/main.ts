import './style.css';
import { generateLevel } from './core/levels';
import { GameScreen } from './screens/gameScreen';
import { h, formatTime } from './ui/dom';

const app = document.getElementById('app')!;
let current: GameScreen | null = null;

function openLevel(level: number) {
  current?.destroy();
  const g = generateLevel(level);
  current = new GameScreen(
    { kind: 'level', key: level, title: `레벨 ${level}`, puzzle: g.puzzle, difficulty: g.difficulty },
    {
      onBack: () => openLevel(Math.max(1, level - 1)),
      onClear: (info) => {
        const ov = h('div', { class: 'modal-wrap show' },
          h('div', { class: 'modal' },
            h('h2', null, '회의 성공!'),
            h('p', null, `${formatTime(info.time)} · 별 ${info.stars}개`),
            h('button', { class: 'btn primary', onclick: () => { ov.remove(); openLevel(level + 1); } }, '다음 레벨'),
          ));
        document.body.appendChild(ov);
      },
    },
  );
  app.replaceChildren(current.el);
}

const q = new URLSearchParams(location.search);
openLevel(Number(q.get('level')) || 1);
