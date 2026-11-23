import type { VisualKey } from '../assets';

export type ZoneId = 'hall' | 'office' | 'pantry' | 'meeting';
export type PropId = 'plant' | 'copier' | 'water' | 'box' | 'chair';
/** good = 안전, ok = 애매함(난이도에 따라 의심), bad = 수상함 */
export type Fit = 'good' | 'ok' | 'bad';

export const ZONE_NAMES: Record<ZoneId, string> = {
  hall: '복도',
  office: '사무실',
  pantry: '탕비실',
  meeting: '회의실',
};

export const PROP_NAMES: Record<PropId, string> = {
  plant: '화분',
  copier: '복합기',
  water: '정수기',
  box: '서류박스',
  chair: '의자',
};

export const PROP_VISUAL: Record<PropId, VisualKey> = {
  plant: 'prop_plant',
  copier: 'prop_copier',
  water: 'prop_water',
  box: 'prop_box',
  chair: 'prop_chair',
};

/** 장소별 소품 어울림 표 — 밸런스 조절은 여기서 */
export const PROP_FIT: Record<ZoneId, Record<PropId, Fit>> = {
  hall: { plant: 'good', water: 'good', copier: 'good', box: 'ok', chair: 'bad' },
  office: { chair: 'good', box: 'good', plant: 'good', copier: 'ok', water: 'bad' },
  pantry: { water: 'good', plant: 'good', chair: 'ok', box: 'ok', copier: 'bad' },
  meeting: { chair: 'good', plant: 'good', box: 'ok', water: 'bad', copier: 'bad' },
};

/**
 * 스테이지 난이도별 'ok' 판정 처리
 * - easy:   ok도 안전
 * - normal: ok는 천천히 의심
 * - strict: ok도 수상함(bad)으로 취급
 */
export type Strictness = 'easy' | 'normal' | 'strict';

export function effectiveFit(zone: ZoneId, prop: PropId, strictness: Strictness): Fit {
  const fit = PROP_FIT[zone][prop];
  if (fit !== 'ok') return fit;
  if (strictness === 'easy') return 'good';
  if (strictness === 'strict') return 'bad';
  return 'ok';
}
