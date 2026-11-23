import * as THREE from 'three';
import type { Anomaly } from '../types';
import { headLookAt } from '../../car/passenger';
import { STATIONS, nextStationIndex } from '../../core/stations';

const pick = <T>(arr: T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length)];

let stareIdx = 0;
export const passengerStare: Anomaly = {
  id: 'passenger-stare',
  name: '돌아보는 승객',
  desc: '승객 한 명이 고개를 돌려 당신을 계속 보고 있었다.',
  difficulty: 'easy',
  setup({ car, rnd }) {
    stareIdx = Math.floor(rnd() * car.passengers.length);
  },
  update({ car, camera }) {
    const p = car.passengers[stareIdx];
    if (p) headLookAt(p, camera.position);
  },
};

export const extraPassenger: Anomaly = {
  id: 'extra-passenger',
  name: '한 명 더',
  desc: '처음엔 셋이었던 승객이 넷이 되어 있었다.',
  difficulty: 'easy',
  configure(cfg, rnd) {
    const slot = pick(
      [
        { bench: 3, slot: 3 },
        { bench: 7, slot: 2 },
        { bench: 1, slot: 4 },
        { bench: 9, slot: 1 },
        { bench: 0, slot: 1 },
      ],
      rnd,
    );
    cfg.passengers.push({ key: 'x', ...slot, pose: rnd() < 0.5 ? 'straight' : 'sleep', coat: 0x24262b, pants: 0x1b1b1f, hair: 0x0e0e10 });
  },
};

let redTube = 0;
export const redLight: Anomaly = {
  id: 'red-light',
  name: '붉은 형광등',
  desc: '형광등 하나가 핏빛으로 빛나고 있었다.',
  difficulty: 'easy',
  setup({ car, game, rnd }) {
    const n = car.tubePositions.length / 2;
    const i = Math.floor(n * 0.25 + rnd() * n * 0.5) + (rnd() < 0.5 ? 0 : n);
    redTube = i;
    car.tubes.setColorAt(i, new THREE.Color(0xff1010));
    car.tubes.instanceColor!.needsUpdate = true;
    const p = car.tubePositions[i];
    game.accent.color.set(0xff1a1a);
    game.accent.position.set(p.x * 0.8, 2.0, p.z);
    game.accent.intensity = 3.5;
  },
  update({ game }) {
    // 가끔 미세하게 떨린다
    game.accent.intensity = 3.3 + Math.sin(game.t * 23 + redTube) * 0.15;
  },
};

export const missingSeat: Anomaly = {
  id: 'missing-seat',
  name: '사라진 좌석',
  desc: '긴 의자 하나가 통째로 없어져 있었다.',
  difficulty: 'easy',
  configure(cfg, rnd) {
    const used = new Set(cfg.passengers.map((p) => p.bench));
    cfg.missingBench = pick([1, 3, 7].filter((b) => !used.has(b)), rnd);
  },
};

export const routeGoBack: Anomaly = {
  id: 'route-goback',
  name: '돌아가',
  desc: '노선도의 역 이름 하나가 "돌아가"로 바뀌어 있었다.',
  difficulty: 'easy',
  configure(cfg, rnd) {
    const next = nextStationIndex(cfg.count);
    const choices = STATIONS.map((_, i) => i).filter((i) => i !== next);
    cfg.signs.routeOverride = { panel: Math.floor(rnd() * 8), station: pick(choices, rnd), text: '돌아가' };
  },
};

export const EASY: Anomaly[] = [passengerStare, extraPassenger, redLight, missingSeat, routeGoBack];
