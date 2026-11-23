import type { Anomaly, AnomalyPack } from './types';
import { EASY } from './base/easy';
import { NORMAL } from './base/normal';
import { SUBTLE } from './base/subtle';
import { SCARE } from './base/scare';

export const ANOMALY_CHANCE = 0.6;

export const PACKS: AnomalyPack[] = [
  {
    id: 'base',
    name: '심야순환선',
    desc: '자정역을 출발해 새벽역으로 향하는 막차.',
    productId: null,
    anomalies: [...EASY, ...NORMAL, ...SUBTLE, ...SCARE],
  },
];

export function allAnomalies(): Anomaly[] {
  return PACKS.flatMap((p) => p.anomalies);
}

export function findAnomaly(id: string): Anomaly | undefined {
  return allAnomalies().find((a) => a.id === id);
}

/**
 * 약 60% 확률로 이상현상 하나를 고른다. 직전과 같은 이상현상은 나오지 않는다.
 */
export function rollAnomaly(pool: Anomaly[], lastId: string | null, rnd: () => number = Math.random): Anomaly | null {
  if (pool.length === 0 || rnd() >= ANOMALY_CHANCE) return null;
  const candidates = pool.length > 1 ? pool.filter((a) => a.id !== lastId) : pool;
  return candidates[Math.floor(rnd() * candidates.length)];
}
