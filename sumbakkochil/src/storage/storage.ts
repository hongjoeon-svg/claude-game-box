// ─────────────────────────────────────────────────────────────
// 저장 모듈. 지금은 localStorage, 나중에 Capacitor Preferences로 교체할 때
// KeyValueStore 구현만 바꾸면 되도록 분리해 둠.
// (Capacitor Preferences는 비동기라서 처음부터 Promise 인터페이스로 맞춤)
// ─────────────────────────────────────────────────────────────
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

class LocalStore implements KeyValueStore {
  async get(key: string) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  async set(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* 사파리 사생활 보호 모드 등 */ }
  }
  async remove(key: string) {
    try { localStorage.removeItem(key); } catch { /* 무시 */ }
  }
}

const PREFIX = 'sumbakkochil.';
let store: KeyValueStore = new LocalStore();

/** 나중에 Capacitor Preferences 구현으로 교체할 자리 */
export function setStore(s: KeyValueStore) { store = s; }

export interface SaveData {
  version: 1;
  /** 스테이지별 최고 점수 */
  best: Record<string, number>;
  settings: { sound: boolean; vibration: boolean };
}

const DEFAULT: SaveData = { version: 1, best: {}, settings: { sound: true, vibration: true } };

let cache: SaveData = structuredClone(DEFAULT);

export async function loadSave(): Promise<SaveData> {
  const raw = await store.get(PREFIX + 'save');
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      cache = { ...structuredClone(DEFAULT), ...parsed, settings: { ...DEFAULT.settings, ...parsed.settings } };
    } catch { cache = structuredClone(DEFAULT); }
  }
  return cache;
}

export function getSave(): SaveData { return cache; }

export async function persist() {
  await store.set(PREFIX + 'save', JSON.stringify(cache));
}

/** 최고 점수 갱신 시 true */
export async function recordScore(stageId: string, score: number): Promise<boolean> {
  const prev = cache.best[stageId] ?? -1;
  if (score <= prev) return false;
  cache.best[stageId] = score;
  await persist();
  return true;
}
