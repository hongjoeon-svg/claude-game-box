/**
 * 격자 화면 + 터치 입력.
 *  - 탭: 빈칸 → X → 사람 → 빈칸
 *  - 드래그: 지나간 빈칸에 X (X 칸에서 시작하면 지나간 X 를 지운다)
 */
import { faceURL, type Character } from '../characters';
import { CROSS, EMPTY, QUEEN } from '../core/types';
import type { GameState } from '../game';

export interface BoardCallbacks {
  /** 상태가 바뀐 뒤 (탭 1번 또는 드래그 1번이 끝날 때마다) */
  onChange(kind: 'cross' | 'queen' | 'clear' | 'drag'): void;
  /** 첫 조작 */
  onFirstInput?(): void;
}

export class BoardView {
  readonly el: HTMLDivElement;
  private cells: HTMLDivElement[] = [];
  private state: GameState;
  private chars: Character[];
  private cb: BoardCallbacks;
  autoX = true;
  locked = false;
  private hintCell = -1;
  private touched = false;

  // 드래그 상태
  private pointerId: number | null = null;
  private startCell = -1;
  private lastCell = -1;
  private dragging = false;
  private dragErase = false;

  constructor(state: GameState, chars: Character[], cb: BoardCallbacks) {
    this.state = state;
    this.chars = chars;
    this.cb = cb;
    const n = state.n;
    const el = document.createElement('div');
    el.className = 'board';
    el.style.setProperty('--n', String(n));
    el.setAttribute('role', 'grid');
    const { regions } = state.puzzle;
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const d = document.createElement('div');
      d.className = 'cell';
      const ch = chars[regions[i]];
      d.style.setProperty('--rc', ch.color);
      // 부서 경계는 굵은 선
      if (r === 0 || regions[i - n] !== regions[i]) d.classList.add('bt');
      if (c === 0 || regions[i - 1] !== regions[i]) d.classList.add('bl');
      if (r === n - 1 || regions[i + n] !== regions[i]) d.classList.add('bb');
      if (c === n - 1 || regions[i + 1] !== regions[i]) d.classList.add('br');
      d.setAttribute('role', 'gridcell');
      d.setAttribute('aria-label', `${r + 1}행 ${c + 1}열 ${ch.name} 부서`);
      el.appendChild(d);
      this.cells.push(d);
    }
    this.el = el;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.render();
  }

  private cellAt(x: number, y: number): number {
    const rect = this.el.getBoundingClientRect();
    const n = this.state.n;
    const cx = Math.floor(((x - rect.left) / rect.width) * n);
    const cy = Math.floor(((y - rect.top) / rect.height) * n);
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) return -1;
    return cy * n + cx;
  }

  private first() {
    if (!this.touched) {
      this.touched = true;
      this.cb.onFirstInput?.();
    }
  }

  private onDown = (e: PointerEvent) => {
    if (this.locked || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const cell = this.cellAt(e.clientX, e.clientY);
    if (cell < 0) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try { this.el.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    this.startCell = cell;
    this.lastCell = cell;
    this.dragging = false;
    this.dragErase = this.state.board[cell] === CROSS;
    this.cells[cell].classList.add('press');
  };

  private dragMark(cell: number) {
    const b = this.state.board;
    if (this.dragErase) {
      if (b[cell] === CROSS) this.state.set(cell, EMPTY);
    } else if (b[cell] === EMPTY) {
      this.state.set(cell, CROSS);
    }
  }

  /** 빠르게 그어서 건너뛴 칸도 채운다 */
  private lineCells(a: number, b: number): number[] {
    const n = this.state.n;
    const r0 = Math.floor(a / n), c0 = a % n;
    const r1 = Math.floor(b / n), c1 = b % n;
    const out: number[] = [];
    const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
    for (let k = 1; k <= steps; k++) {
      const r = Math.round(r0 + ((r1 - r0) * k) / steps);
      const c = Math.round(c0 + ((c1 - c0) * k) / steps);
      out.push(r * n + c);
    }
    return out;
  }

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    const cell = this.cellAt(e.clientX, e.clientY);
    if (cell < 0 || cell === this.lastCell) return;
    if (!this.dragging) {
      this.dragging = true;
      this.first();
      this.cells[this.startCell].classList.remove('press');
      this.state.begin();
      this.dragMark(this.startCell);
    }
    for (const c of this.lineCells(this.lastCell, cell)) this.dragMark(c);
    this.lastCell = cell;
    this.render();
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.cells[this.startCell]?.classList.remove('press');
    if (this.dragging) {
      this.state.commit();
      this.dragging = false;
      this.render();
      this.cb.onChange('drag');
      return;
    }
    this.first();
    const next = this.state.tap(this.startCell, this.autoX);
    this.render();
    this.pop(this.startCell);
    this.cb.onChange(next === QUEEN ? 'queen' : next === CROSS ? 'cross' : 'clear');
  };

  private onCancel = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.cells[this.startCell]?.classList.remove('press');
    if (this.dragging) {
      this.state.commit();
      this.dragging = false;
      this.render();
      this.cb.onChange('drag');
    }
  };

  private pop(cell: number) {
    const d = this.cells[cell];
    d.classList.remove('pop');
    void d.offsetWidth;
    d.classList.add('pop');
  }

  setHint(cell: number) {
    this.hintCell = cell;
    this.render();
  }

  render() {
    const s = this.state;
    const auto = this.autoX ? s.autoCrossed() : null;
    const bad = s.conflicts();
    const { regions } = s.puzzle;
    for (let i = 0; i < this.cells.length; i++) {
      const d = this.cells[i];
      const v = s.board[i];
      const want = v === QUEEN ? 'q' : v === CROSS ? 'x' : auto && auto[i] ? 'ax' : '';
      if (d.dataset.v !== want) {
        d.dataset.v = want;
        d.textContent = '';
        if (want === 'q') {
          const img = document.createElement('img');
          img.className = 'face';
          img.src = faceURL(this.chars[regions[i]].id);
          img.alt = '';
          img.draggable = false;
          d.appendChild(img);
        } else if (want === 'x' || want === 'ax') {
          const x = document.createElement('span');
          x.className = 'x';
          d.appendChild(x);
        }
      }
      d.classList.toggle('bad', bad.has(i));
      d.classList.toggle('hint', i === this.hintCell);
    }
  }

  /** 클리어 연출: 앉은 사람들이 차례로 통통 */
  celebrate() {
    const s = this.state;
    let k = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (s.board[i] !== QUEEN) continue;
      const d = this.cells[i];
      d.style.setProperty('--delay', `${k++ * 90}ms`);
      d.classList.add('cheer');
    }
    this.el.classList.add('won');
  }
}
