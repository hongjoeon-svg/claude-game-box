import type { Character } from './characters';
import type { Rng } from './core/rng';
export interface Line { speaker: Character; text: string }
export function pickLine(chars: Character[], _rng: Rng): Line {
  return { speaker: chars[0], text: '각 줄·각 칸·각 부서에 한 명씩, 붙어 앉지 않게!' };
}
