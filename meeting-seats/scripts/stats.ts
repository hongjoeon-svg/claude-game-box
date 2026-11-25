import { generatePuzzle } from '../src/core/generator';
import { grade } from '../src/core/logic';
import { mulberry32 } from '../src/core/rng';
for (let n = 5; n <= 9; n++) {
  const rng = mulberry32(n * 1000);
  const tiers = [0, 0, 0, 0, 0];
  const t0 = performance.now();
  let gt = 0;
  const K = 60;
  for (let i = 0; i < K; i++) {
    const p = generatePuzzle(n, rng);
    const a = performance.now();
    tiers[grade(p).tier]++;
    gt += performance.now() - a;
  }
  const ms = (performance.now() - t0) / K;
  console.log(`n=${n} tiers(1..4)=${tiers.slice(1).join('/')}  avg ${ms.toFixed(1)}ms (grade ${(gt / K).toFixed(1)}ms)`);
}
