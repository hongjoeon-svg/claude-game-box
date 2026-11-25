import type { Anomaly } from '../types';

const pick = <T>(arr: T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length)];

export const oddSeat: Anomaly = {
  id: 'odd-seat',
  name: '색이 다른 좌석',
  desc: '파란 의자들 사이에 한 칸만 초록색 좌석이 있었다.',
  difficulty: 'subtle',
  configure(cfg, rnd) {
    cfg.oddSeat = { bench: pick([1, 3, 7, 8], rnd), slot: 2 + Math.floor(rnd() * 3) };
  },
};

export const phoneRed: Anomaly = {
  id: 'phone-red',
  name: '붉은 화면',
  desc: '휴대폰을 보던 승객의 화면이 새빨갛게 빛나고 있었다.',
  difficulty: 'subtle',
  setup({ car }) {
    for (const p of car.passengers) p.phoneMat?.color.set(0xff1e1e);
  },
};

export const bentPole: Anomaly = {
  id: 'bent-pole',
  name: '휘어진 기둥',
  desc: '손잡이 기둥 하나가 가운데에서 꺾여 있었다.',
  difficulty: 'subtle',
  configure(cfg, rnd) {
    cfg.bentPole = 2 + Math.floor(rnd() * 12);
  },
};

export const movedPassenger: Anomaly = {
  id: 'moved-passenger',
  name: '자리를 옮긴 승객',
  desc: '승객 한 명이 원래와 다른 자리에 앉아 있었다.',
  difficulty: 'subtle',
  configure(cfg, rnd) {
    const moves = [
      { key: 'a', bench: 7, slot: 3 },
      { key: 'b', bench: 1, slot: 1 },
      { key: 'c', bench: 3, slot: 4 },
      { key: 'a', bench: 2, slot: 5 },
    ];
    const m = pick(moves, rnd);
    const p = cfg.passengers.find((pp) => pp.key === m.key);
    if (p) {
      p.bench = m.bench;
      p.slot = m.slot;
    }
  },
};

export const mirrorSticker: Anomaly = {
  id: 'mirror-sticker',
  name: '뒤집힌 안내문',
  desc: '문 옆 "기대지 마세요" 스티커의 글자가 모두 좌우로 뒤집혀 있었다.',
  difficulty: 'subtle',
  configure(cfg) {
    cfg.signs.mirrorStickers = true;
  },
};

export const carNumber: Anomaly = {
  id: 'car-number',
  name: '4444',
  desc: '벽에 붙은 차량 번호가 4012가 아니라 4444였다.',
  difficulty: 'subtle',
  configure(cfg) {
    cfg.signs.carNumber = '4444';
  },
};

export const SUBTLE: Anomaly[] = [oddSeat, phoneRed, bentPole, movedPassenger, mirrorSticker, carNumber];
