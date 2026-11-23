/** 게임 화면: 상단 바, 상황 대사, 격자, 부서 범례, 조작 버튼 */
import { showRewardedAd, isAdFree } from '../ads';
import { assignCharacters, faceImg, type Character } from '../characters';
import { findHint } from '../core/hint';
import { rngFromString } from '../core/rng';
import { DIFFICULTY_LABEL, type Difficulty, type Puzzle } from '../core/types';
import { GameState } from '../game';
import * as store from '../storage';
import { BoardView } from '../ui/boardView';
import { confirmDialog, formatTime, h, ICONS, toast } from '../ui/dom';
import { sfx, vibrate } from '../audio';
import { pickLine } from '../lines';
import { josa } from '../ui/josa';

export interface GameParams {
  kind: 'level' | 'daily';
  /** 레벨 번호 또는 날짜 */
  key: number | string;
  title: string;
  puzzle: Puzzle;
  difficulty: Difficulty;
}

export interface ClearInfo {
  time: number;
  hints: number;
  stars: number;
  isBest: boolean;
  chars: Character[];
}

export interface GameHandlers {
  onBack(): void;
  onClear(info: ClearInfo, screen: GameScreen): void;
}

export function starsForHints(hints: number): number {
  return hints === 0 ? 3 : hints === 1 ? 2 : 1;
}

export class GameScreen {
  readonly el: HTMLElement;
  readonly params: GameParams;
  private state: GameState;
  private board: BoardView;
  private chars: Character[];
  private elapsed = 0;
  private running = false;
  private lastTick = 0;
  private timerEl: HTMLElement;
  private undoBtn: HTMLButtonElement;
  private tickHandle = 0;
  private ro: ResizeObserver | null = null;
  private finished = false;
  private hintTimer = 0;
  private progressKey: string;

  constructor(params: GameParams, private handlers: GameHandlers) {
    this.params = params;
    const { puzzle } = params;
    this.progressKey = `${params.kind}-${params.key}`;
    this.chars = assignCharacters(puzzle.n, rngFromString(`chars/${this.progressKey}`));

    const saved = store.load().inProgress[this.progressKey];
    this.state = new GameState(puzzle, saved?.board);
    if (saved) {
      this.elapsed = saved.elapsed;
      this.state.hintsUsed = saved.hints;
    }

    const settings = store.settings();
    this.board = new BoardView(this.state, this.chars, {
      onChange: (kind) => this.onBoardChange(kind),
      onFirstInput: () => this.start(),
    });
    this.board.autoX = settings.autoX;

    this.timerEl = h('span', { class: 'timer-text' }, formatTime(this.elapsed));
    this.undoBtn = h(
      'button',
      { class: 'ctl', onclick: () => this.undo(), 'aria-label': '실행 취소' },
      h('span', { class: 'ico', html: ICONS.undo }),
      h('span', null, '실행 취소'),
    );

    const line = pickLine(this.chars, rngFromString(`line/${this.progressKey}`));
    const wrap = h('div', { class: 'board-wrap' }, this.board.el);

    this.el = h(
      'section',
      { class: 'screen game' },
      h(
        'header',
        { class: 'topbar' },
        h('button', { class: 'icon-btn', 'aria-label': '뒤로', html: ICONS.back, onclick: () => this.leave() }),
        h(
          'div',
          { class: 'title' },
          h('strong', null, params.title),
          h('span', { class: `chip diff-${params.difficulty}` }, `${puzzle.n}×${puzzle.n} · ${DIFFICULTY_LABEL[params.difficulty]}`),
        ),
        h('div', { class: 'timer' }, h('span', { class: 'ico', html: ICONS.clock }), this.timerEl),
      ),
      h(
        'div',
        { class: 'bubble' },
        faceImg(line.speaker.id, 'bubble-face'),
        h('div', { class: 'bubble-text' }, h('b', null, line.speaker.name), h('span', null, line.text)),
      ),
      wrap,
      h(
        'div',
        { class: 'legend', 'aria-label': '부서' },
        ...this.chars.map((c) =>
          h('span', { class: 'legend-chip', style: `--rc:${c.color};--ink:${c.ink}` }, faceImg(c.id, 'legend-face'), c.name),
        ),
      ),
      h(
        'nav',
        { class: 'controls' },
        this.undoBtn,
        h(
          'button',
          { class: 'ctl', onclick: () => this.reset(), 'aria-label': '전체 초기화' },
          h('span', { class: 'ico', html: ICONS.reset }),
          h('span', null, '초기화'),
        ),
        h(
          'button',
          { class: 'ctl hint-btn', onclick: () => this.hint(), 'aria-label': '힌트' },
          h('span', { class: 'ico', html: ICONS.hint }),
          h('span', null, '힌트'),
          isAdFree() ? null : h('span', { class: 'ad-badge' }, 'AD'),
        ),
      ),
    );

    // 격자를 남은 공간에 꽉 차는 정사각형으로
    this.ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const size = Math.floor(Math.min(r.width - 24, r.height - 12, 520));
      this.board.el.style.setProperty('--size', `${Math.max(200, size)}px`);
    });
    this.ro.observe(wrap);
    this.updateButtons();
    document.addEventListener('visibilitychange', this.onVisibility);
    // 이미 진행한 판이면 바로 시계 시작
    if (saved) this.start();
  }

  private onVisibility = () => {
    if (document.hidden) {
      this.pause();
      this.persist();
    } else if (!this.finished && this.lastTick !== 0) {
      this.start();
    }
  };

  private start() {
    if (this.running || this.finished) return;
    this.running = true;
    this.lastTick = performance.now();
    const tick = () => {
      if (!this.running) return;
      const now = performance.now();
      this.elapsed += (now - this.lastTick) / 1000;
      this.lastTick = now;
      this.timerEl.textContent = formatTime(this.elapsed);
      this.tickHandle = window.setTimeout(tick, 250);
    };
    tick();
  }

  private pause() {
    if (!this.running) return;
    const now = performance.now();
    this.elapsed += (now - this.lastTick) / 1000;
    this.running = false;
    clearTimeout(this.tickHandle);
  }

  private persist() {
    if (this.finished) return;
    const board = this.state.board.slice();
    store.update((d) => {
      if (board.every((v) => v === 0) && this.state.hintsUsed === 0) delete d.inProgress[this.progressKey];
      else d.inProgress[this.progressKey] = { board, elapsed: this.elapsed, hints: this.state.hintsUsed };
    });
  }

  private onBoardChange(kind: 'cross' | 'queen' | 'clear' | 'drag') {
    this.clearHint();
    const bad = this.state.conflicts();
    if (kind === 'queen' && bad.size) {
      sfx('error');
      vibrate([30, 40, 30]);
    } else {
      sfx(kind === 'queen' ? 'place' : kind === 'clear' ? 'clear' : 'cross');
      if (kind === 'queen') vibrate(12);
    }
    this.updateButtons();
    if (this.state.isSolved()) this.win();
    else this.persist();
  }

  private updateButtons() {
    this.undoBtn.disabled = !this.state.canUndo() || this.finished;
  }

  private undo() {
    if (this.finished) return;
    if (this.state.undo()) {
      this.clearHint();
      this.board.render();
      sfx('undo');
      this.updateButtons();
      this.persist();
    }
  }

  private async reset() {
    if (this.finished || this.state.board.every((v) => v === 0)) return;
    const ok = await confirmDialog('전체 초기화', '자리 배치를 모두 지울까요?\n(실행 취소로 되돌릴 수 있어요)', '지우기');
    if (!ok) return;
    this.state.reset();
    this.clearHint();
    this.board.render();
    sfx('clear');
    this.updateButtons();
    this.persist();
  }

  private clearHint() {
    clearTimeout(this.hintTimer);
    this.board.setHint(-1);
  }

  private async hint() {
    if (this.finished) return;
    const h0 = findHint(this.params.puzzle, this.state.board);
    if (h0.kind === 'done') return;
    const ok = await showRewardedAd('hint');
    if (!ok) {
      toast('광고를 끝까지 보면 힌트를 받을 수 있어요');
      return;
    }
    this.start();
    this.state.hintsUsed++;
    const n = this.params.puzzle.n;
    const name = this.chars[this.params.puzzle.regions[h0.cell]].name;
    const where = `${Math.floor(h0.cell / n) + 1}행 ${(h0.cell % n) + 1}열`;
    if (h0.kind === 'wrongQueen') toast(`${where}: 여긴 자리가 아니에요. 다른 곳을 찾아보세요`, 2600);
    else if (h0.kind === 'wrongCross') toast(`${where}의 X를 다시 생각해 보세요`, 2600);
    else toast(`${where}에 ${josa(name, '을', '를')} 앉힐 수 있어요`, 2600);
    sfx('hint');
    this.board.setHint(h0.cell);
    this.hintTimer = window.setTimeout(() => this.board.setHint(-1), 6000);
    this.persist();
  }

  private win() {
    this.finished = true;
    this.pause();
    this.clearHint();
    this.board.locked = true;
    this.updateButtons();
    this.board.celebrate();
    const time = Math.round(this.elapsed);
    const hints = this.state.hintsUsed;
    const stars = starsForHints(hints);
    const isBest = store.recordClear(this.params.kind, this.params.key, stars, time);
    sfx('win');
    vibrate([20, 60, 20, 60, 40]);
    setTimeout(() => this.handlers.onClear({ time, hints, stars, isBest, chars: this.chars }, this), 900);
  }

  private leave() {
    this.persist();
    this.handlers.onBack();
  }

  destroy() {
    this.pause();
    this.persist();
    this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    clearTimeout(this.hintTimer);
  }
}
