import { generateLevel, generateDaily } from '../src/core/levels';
let worst = 0, wl = 0, total = 0;
for (let L = 1; L <= 200; L++) { const t = performance.now(); generateLevel(L); const d = performance.now() - t; total += d; if (d > worst) { worst = d; wl = L; } }
console.log(`levels: avg ${(total / 200).toFixed(1)}ms, worst ${worst.toFixed(0)}ms (level ${wl})`);
let dw = 0; for (let i = 0; i < 60; i++) { const d = new Date(2026, 0, 1 + i); const k = d.toISOString().slice(0, 10); const t = performance.now(); generateDaily(k); dw = Math.max(dw, performance.now() - t); }
console.log(`daily worst ${dw.toFixed(0)}ms`);
