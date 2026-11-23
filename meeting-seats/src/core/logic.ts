/**
 * 사람이 쓰는 추론만으로 퍼즐을 푸는 논리 솔버. 난이도 판정과 힌트에 쓴다.
 *
 * 추론 단계(tier):
 *  1 (단순)  - 사람을 앉히면 같은 행/열/부서/주변 8칸은 X
 *            - 행/열/부서에 남은 빈칸이 하나뿐이면 거기에 앉힌다
 *            - 한 부서의 빈칸이 전부 한 행(열)에 있으면, 그 행(열)의 나머지는 X (그 반대도)
 *  2 (보통)  - 여기 앉히면 어떤 행/열/부서의 빈칸이 모두 사라지는 칸은 X
 *            - k개 부서의 빈칸이 정확히 k개 행(열) 안에 몰려 있으면 그 행(열)의 나머지는 X (그 반대도)
 *  3 (어려움) - 한 칸에 앉혀 보고 1~2단계 추론을 끝까지 돌렸을 때 모순이면 X (한 수 앞 가정)
 *  4         - 위 방법으로 풀리지 않음 (생성기가 버린다)
 */
import { CROSS, EMPTY, QUEEN, type Puzzle } from './types';

export interface Ctx {
  n: number;
  nn: number;
  /** 0..n-1 행, n..2n-1 열, 2n..3n-1 부서 */
  units: number[][];
  /** 칸 → [행 unit, 열 unit, 부서 unit] */
  cellUnits: [number, number, number][];
  /** 칸마다 같은 행/열/부서 또는 인접한 칸 목록 */
  peers: number[][];
  /** peerMat[a*nn+b] = 1 이면 b 는 a 의 peer */
  peerMat: Uint8Array;
}

export function makeCtx(n: number, regions: ArrayLike<number>): Ctx {
  const nn = n * n;
  const units: number[][] = Array.from({ length: 3 * n }, () => []);
  const cellUnits: [number, number, number][] = [];
  for (let i = 0; i < nn; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    const g = regions[i];
    units[r].push(i);
    units[n + c].push(i);
    units[2 * n + g].push(i);
    cellUnits.push([r, n + c, 2 * n + g]);
  }
  const peerMat = new Uint8Array(nn * nn);
  const peers: number[][] = [];
  for (let i = 0; i < nn; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    const list: number[] = [];
    for (let j = 0; j < nn; j++) {
      if (j === i) continue;
      const r2 = Math.floor(j / n);
      const c2 = j % n;
      const adj = Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1;
      if (adj || r === r2 || c === c2 || regions[i] === regions[j]) {
        list.push(j);
        peerMat[i * nn + j] = 1;
      }
    }
    peers.push(list);
  }
  return { n, nn, units, cellUnits, peers, peerMat };
}

export function placeQueen(ctx: Ctx, s: Int8Array, cell: number): void {
  s[cell] = QUEEN;
  for (const p of ctx.peers[cell]) if (s[p] === EMPTY) s[p] = CROSS;
}

/** 모순: 한 unit 에 사람이 둘 이상, 혹은 사람도 빈칸도 없음, 혹은 인접 */
export function hasContradiction(ctx: Ctx, s: Int8Array): boolean {
  for (const u of ctx.units) {
    let q = 0;
    let e = 0;
    for (const c of u) {
      if (s[c] === QUEEN) q++;
      else if (s[c] === EMPTY) e++;
    }
    if (q > 1 || (q === 0 && e === 0)) return true;
  }
  const n = ctx.n;
  for (let i = 0; i < ctx.nn; i++) {
    if (s[i] !== QUEEN) continue;
    const r = Math.floor(i / n);
    const c = i % n;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r2 = r + dr;
        const c2 = c + dc;
        if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) continue;
        if (s[r2 * n + c2] === QUEEN) return true;
      }
  }
  return false;
}

export function queenCount(s: Int8Array): number {
  let k = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === QUEEN) k++;
  return k;
}

function unitHasQueen(s: Int8Array, u: number[]): boolean {
  for (const c of u) if (s[c] === QUEEN) return true;
  return false;
}

function candidates(s: Int8Array, u: number[]): number[] {
  const out: number[] = [];
  for (const c of u) if (s[c] === EMPTY) out.push(c);
  return out;
}

/** 한 번의 추론 결과 */
export interface Step {
  tier: number;
  /** 새로 앉힌 칸 (있으면) */
  placed?: number;
  /** 새로 X 한 칸들 */
  crossed: number[];
  rule: string;
}

// ---------- tier 1 ----------

function stepSingles(ctx: Ctx, s: Int8Array): Step | null {
  for (let ui = 0; ui < ctx.units.length; ui++) {
    const u = ctx.units[ui];
    if (unitHasQueen(s, u)) continue;
    const cand = candidates(s, u);
    if (cand.length === 1) {
      const before = Array.from(s);
      placeQueen(ctx, s, cand[0]);
      const crossed: number[] = [];
      for (let i = 0; i < s.length; i++) if (before[i] === EMPTY && s[i] === CROSS) crossed.push(i);
      return { tier: 1, placed: cand[0], crossed, rule: 'single' };
    }
  }
  return null;
}

/** unit 의 빈칸이 모두 다른 unit 하나에 들어 있으면 그 unit 의 나머지 X */
function stepPointing(ctx: Ctx, s: Int8Array): Step | null {
  for (let ui = 0; ui < ctx.units.length; ui++) {
    const u = ctx.units[ui];
    if (unitHasQueen(s, u)) continue;
    const cand = candidates(s, u);
    if (cand.length === 0) continue;
    for (let k = 0; k < 3; k++) {
      const v = ctx.cellUnits[cand[0]][k];
      if (v === ui) continue;
      let all = true;
      for (const c of cand) if (ctx.cellUnits[c][k] !== v) { all = false; break; }
      if (!all) continue;
      const crossed: number[] = [];
      for (const c of ctx.units[v]) {
        if (s[c] === EMPTY && ctx.cellUnits[c][Math.floor(ui / ctx.n)] !== ui) {
          s[c] = CROSS;
          crossed.push(c);
        }
      }
      if (crossed.length) return { tier: 1, crossed, rule: 'pointing' };
    }
  }
  return null;
}

// ---------- tier 2 ----------

/** 여기 앉히면 어떤 unit 의 빈칸이 전부 사라진다 → X */
function stepCellKill(ctx: Ctx, s: Int8Array): Step | null {
  const { nn, peerMat } = ctx;
  const open: number[][] = [];
  for (const u of ctx.units) open.push(unitHasQueen(s, u) ? [] : candidates(s, u));
  for (let c = 0; c < nn; c++) {
    if (s[c] !== EMPTY) continue;
    const base = c * nn;
    for (let ui = 0; ui < open.length; ui++) {
      const cand = open[ui];
      if (!cand.length) continue;
      let killsAll = true;
      for (const x of cand) {
        if (x === c || !peerMat[base + x]) { killsAll = false; break; }
      }
      if (killsAll) {
        s[c] = CROSS;
        return { tier: 2, crossed: [c], rule: 'cellKill' };
      }
    }
  }
  return null;
}

function popcount(x: number): number {
  let k = 0;
  while (x) { x &= x - 1; k++; }
  return k;
}

/** k개 A-unit 의 빈칸이 정확히 k개 B-unit 안에 있으면, 그 B-unit 의 나머지 X */
function stepSubsets(ctx: Ctx, s: Int8Array): Step | null {
  const n = ctx.n;
  // 0 = 행, 1 = 열, 2 = 부서
  const pairs: [number, number][] = [[2, 0], [2, 1], [0, 2], [1, 2], [0, 1], [1, 0]];
  for (const [ta, tb] of pairs) {
    const openA: number[] = [];
    const bMask: number[] = [];
    for (let a = 0; a < n; a++) {
      const u = ctx.units[ta * n + a];
      if (unitHasQueen(s, u)) continue;
      let m = 0;
      for (const c of u) if (s[c] === EMPTY) m |= 1 << (ctx.cellUnits[c][tb] - tb * n);
      openA.push(a);
      bMask.push(m);
    }
    const m = openA.length;
    if (m < 3) continue;
    const full = 1 << m;
    for (let sub = 1; sub < full; sub++) {
      const k = popcount(sub);
      if (k < 2 || k >= m) continue;
      let union = 0;
      let aSet = 0;
      for (let i = 0; i < m; i++) if (sub & (1 << i)) { union |= bMask[i]; aSet |= 1 << openA[i]; }
      if (popcount(union) !== k) continue;
      const crossed: number[] = [];
      for (let b = 0; b < n; b++) {
        if (!(union & (1 << b))) continue;
        for (const c of ctx.units[tb * n + b]) {
          if (s[c] !== EMPTY) continue;
          const a = ctx.cellUnits[c][ta] - ta * n;
          if (!(aSet & (1 << a))) { s[c] = CROSS; crossed.push(c); }
        }
      }
      if (crossed.length) return { tier: 2, crossed, rule: 'subset' };
    }
  }
  return null;
}

// ---------- tier 3 ----------

function stepLookahead(ctx: Ctx, s: Int8Array): Step | null {
  for (let c = 0; c < ctx.nn; c++) {
    if (s[c] !== EMPTY) continue;
    const t = Int8Array.from(s);
    placeQueen(ctx, t, c);
    const res = propagate(ctx, t, 2);
    if (res === 'contradiction') {
      s[c] = CROSS;
      return { tier: 3, crossed: [c], rule: 'lookahead' };
    }
  }
  return null;
}

/** 가능한 가장 쉬운 추론 한 번 */
export function nextStep(ctx: Ctx, s: Int8Array, maxTier = 3): Step | null {
  return (
    stepSingles(ctx, s) ??
    stepPointing(ctx, s) ??
    (maxTier >= 2 ? stepCellKill(ctx, s) ?? stepSubsets(ctx, s) : null) ??
    (maxTier >= 3 ? stepLookahead(ctx, s) : null)
  );
}

export function propagate(ctx: Ctx, s: Int8Array, maxTier: number): 'solved' | 'stuck' | 'contradiction' {
  for (;;) {
    if (hasContradiction(ctx, s)) return 'contradiction';
    if (queenCount(s) === ctx.n) return 'solved';
    if (!nextStep(ctx, s, maxTier)) return 'stuck';
  }
}

export interface GradeResult {
  solved: boolean;
  /** 사용한 가장 어려운 추론 단계 (풀리지 않으면 4) */
  tier: number;
  steps: number;
}

/** 빈 판에서 논리만으로 풀어 보고 난이도 단계를 매긴다 */
export function grade(puzzle: Puzzle): GradeResult {
  const ctx = makeCtx(puzzle.n, puzzle.regions);
  const s = new Int8Array(ctx.nn);
  let tier = 0;
  let steps = 0;
  for (;;) {
    if (hasContradiction(ctx, s)) return { solved: false, tier: 4, steps };
    if (queenCount(s) === ctx.n) return { solved: true, tier: Math.max(tier, 1), steps };
    const st = nextStep(ctx, s, 3);
    if (!st) return { solved: false, tier: 4, steps };
    steps++;
    if (st.tier > tier) tier = st.tier;
  }
}
