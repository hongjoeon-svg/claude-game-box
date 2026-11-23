/** 진행 상황·설정은 기기 안 localStorage 에만 저장 (서버 없음) */
export interface Settings {
  sensitivity: number; // 0.4 ~ 2.0
  volume: number; // 0 ~ 1
  vibration: boolean;
}

export interface SaveData {
  v: 1;
  settings: Settings;
  discovered: string[]; // 도감: 맞게 알아챈 이상현상 id
  disabled: string[]; // 끈 이상현상 id (개발/설정용)
  entitlements: string[]; // 구매한 추가 노선 productId
  best: number; // 최고 진행도
  clears: number; // 종착역 도착 횟수
  bestTime: number | null; // 최단 클리어(초)
  seenTutorial: boolean;
}

const KEY = 'lastTrainAnomaly.v1';

const defaults = (): SaveData => ({
  v: 1,
  settings: { sensitivity: 1, volume: 0.8, vibration: true },
  discovered: [],
  disabled: [],
  entitlements: [],
  best: 0,
  clears: 0,
  bestTime: null,
  seenTutorial: false,
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw) as Partial<SaveData>;
    const base = defaults();
    return { ...base, ...d, settings: { ...base.settings, ...(d.settings ?? {}) } };
  } catch {
    return defaults();
  }
}

export function writeSave(d: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* 저장 공간 없음/사생활 보호 모드 — 무시 */
  }
}

export function resetProgress(d: SaveData): SaveData {
  const n = defaults();
  n.settings = d.settings;
  n.entitlements = d.entitlements; // 구매 내역은 유지
  n.seenTutorial = true;
  writeSave(n);
  return n;
}
