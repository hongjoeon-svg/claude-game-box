import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/characters';
import { pickLine } from '../src/lines';
import { rngFromString } from '../src/core/rng';

describe('상황 대사', () => {
  it('항상 그 판의 캐릭터가 말하고, 같은 시드면 같은 대사', () => {
    for (let k = 0; k < 200; k++) {
      const chars = CHARACTERS.slice(k % 4, (k % 4) + 5);
      const a = pickLine(chars, rngFromString(`l${k}`));
      const b = pickLine(chars, rngFromString(`l${k}`));
      expect(a).toEqual(b);
      expect(chars).toContain(a.speaker);
      expect(a.text.length).toBeGreaterThan(5);
    }
  });
});
