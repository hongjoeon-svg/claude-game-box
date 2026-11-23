/** localStorage 저장. 접근이 막혀 있어도(사파리 사생활 보호 등) 게임은 돌아가게 한다. */

export interface Settings {
  /** 사람을 놓으면 같은 행/열/부서/인접 칸에 자동 X */
  autoX: boolean;
  sound: boolean;
  vibrate: boolean;
}

export interface Record_ {
  stars: number;
  /** 최고 기록 (초) */
  best: number;
}

export interface InProgress {
  board: number[];
  elapsed: number;
  hints: number;
}

export interface SaveData {
  version: 1;
  /** 열려 있는 가장 높은 레벨 */
  unlocked: number;
  levels: { [level: number]: Record_ };
  daily: { [date: string]: Record_ };
  settings: Settings;
  /** 진행 중인 판: 'level-12', 'daily-2026-11-23' */
  inProgress: { [key: string]: InProgress };
  /** 레벨 클리어 횟수 (전면 광고 간격 계산용) */
  clears: number;
  seenTutorial: boolean;
}

const KEY = 'meetingSeats.save.v1';

function defaults(): SaveData {
  return {
    version: 1,
    unlocked: 1,
    levels: {},
    daily: {},
    settings: { autoX: true, sound: true, vibrate: true },
    inProgress: {},
    clears: 0,
    seenTutorial: false,
  };
}

let cache: SaveData | null = null;

export function load(): SaveData {
  if (cache) return cache;
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      cache = { ...d, ...parsed, settings: { ...d.settings, ...(parsed.settings ?? {}) } };
      return cache;
    }
  } catch {
    /* 무시 */
  }
  cache = d;
  return cache;
}

export function save(): void {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* 저장 공간 부족 등: 무시 */
  }
}

export function update(fn: (d: SaveData) => void): void {
  fn(load());
  save();
}

export function settings(): Settings {
  return load().settings;
}

export function resetAll(): void {
  cache = defaults();
  save();
}

/** 클리어 기록. 더 좋은 기록만 남긴다. 새 기록이면 true */
export function recordClear(kind: 'level' | 'daily', key: string | number, stars: number, time: number): boolean {
  let isBest = false;
  update((d) => {
    const table = (kind === 'level' ? d.levels : d.daily) as { [k: string]: Record_ };
    const prev = table[key];
    isBest = !prev || time < prev.best;
    table[key] = { stars: Math.max(prev?.stars ?? 0, stars), best: Math.min(prev?.best ?? Infinity, time) };
    if (kind === 'level') {
      d.unlocked = Math.max(d.unlocked, Number(key) + 1);
      d.clears++;
    }
    delete d.inProgress[`${kind}-${key}`];
  });
  return isBest;
}
