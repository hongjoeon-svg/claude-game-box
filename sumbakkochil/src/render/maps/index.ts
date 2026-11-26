// 맵 레지스트리: mapId → 그리기 함수
import type { MapId } from '../../data/stages';
import { makeRng } from '../../game/rng';
import { makeCanvas, type Ctx } from '../draw';
import { drawStore } from './store';

export const MAP_W = 1080;
export const MAP_H = 1920;

type DrawFn = (ctx: Ctx, detail: number, rng: () => number) => void;

const DRAWERS: Partial<Record<MapId, DrawFn>> = {
  store: drawStore,
};

export const MAP_NAMES: Record<MapId, string> = {
  store: '편의점',
  office: '사무실',
  subway: '지하철',
};

/** 현재 ctx 변환 상태 그대로 맵을 그림 (확대 화면에서 선명하게 다시 그릴 때 사용) */
export function drawMap(ctx: Ctx, mapId: MapId, detail: number, seed: number) {
  const fn = DRAWERS[mapId];
  if (!fn) throw new Error(`맵 없음: ${mapId}`);
  fn(ctx, detail, makeRng(seed));
}

/** 1:1 해상도 맵 캔버스 (판정·스포이드 기준) */
export function renderMap(mapId: MapId, detail: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(MAP_W, MAP_H);
  drawMap(ctx, mapId, detail, seed);
  return c;
}
