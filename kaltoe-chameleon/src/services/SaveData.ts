import { STAGES, type StageDef } from '../data/stages';
import { storage } from './StorageService';

const KEY = 'kaltoe-chameleon/save/v1';

export type Stars = [boolean, boolean, boolean];

export interface StageProgress {
  /** [클리어, 의심 50% 이하, 빠른 클리어] — 한 번이라도 달성하면 유지 */
  stars: Stars;
  bestTimeSec?: number;
  clears: number;
}

interface SaveState {
  version: 1;
  stages: Record<string, StageProgress>;
  soundOn: boolean;
}

export interface RunStats {
  stageId: number;
  cleared: boolean;
  timeSec: number;
  maxSuspicion: number;
}

/** 별 3개 평가 */
export function rateRun(stage: StageDef, run: RunStats): Stars {
  return [run.cleared, run.cleared && run.maxSuspicion <= 50, run.cleared && run.timeSec <= stage.fastClearSec];
}

export function starCount(stars: Stars): number {
  return stars.filter(Boolean).length;
}

class SaveDataStore {
  private state: SaveState;

  constructor() {
    this.state = this.load();
  }

  private load(): SaveState {
    const fresh: SaveState = { version: 1, stages: {}, soundOn: true };
    const raw = storage.getItem(KEY);
    if (!raw) return fresh;
    try {
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      return { ...fresh, ...parsed, stages: parsed.stages ?? {} };
    } catch {
      return fresh;
    }
  }

  private persist(): void {
    storage.setItem(KEY, JSON.stringify(this.state));
  }

  progress(stageId: number): StageProgress {
    return this.state.stages[stageId] ?? { stars: [false, false, false], clears: 0 };
  }

  /** 첫 스테이지이거나 바로 앞 스테이지를 클리어했으면 해금 */
  isUnlocked(stageId: number): boolean {
    const idx = STAGES.findIndex((s) => s.id === stageId);
    if (idx <= 0) return true;
    return this.progress(STAGES[idx - 1].id).clears > 0;
  }

  totalStars(): number {
    return STAGES.reduce((sum, s) => sum + starCount(this.progress(s.id).stars), 0);
  }

  /** 결과 기록. 이번 판 별과 '새 기록' 여부를 돌려줍니다 */
  record(stage: StageDef, run: RunStats): { stars: Stars; newBest: boolean } {
    const stars = rateRun(stage, run);
    const prev = this.progress(stage.id);
    let newBest = false;
    if (run.cleared) {
      newBest = prev.bestTimeSec === undefined || run.timeSec < prev.bestTimeSec;
      this.state.stages[stage.id] = {
        stars: prev.stars.map((v, i) => v || stars[i]) as Stars,
        bestTimeSec: newBest ? run.timeSec : prev.bestTimeSec,
        clears: prev.clears + 1,
      };
      this.persist();
    }
    return { stars, newBest };
  }

  get soundOn(): boolean {
    return this.state.soundOn;
  }

  set soundOn(on: boolean) {
    this.state.soundOn = on;
    this.persist();
  }

  resetAll(): void {
    this.state = { version: 1, stages: {}, soundOn: this.state.soundOn };
    this.persist();
  }
}

export const SaveData = new SaveDataStore();
