import * as THREE from 'three';
import type { Anomaly } from '../types';
import { BASE_LENGTH, HALF_W } from '../../car/layout';
import { normalDoorNumbers } from '../../car/config';
import { buildPassenger } from '../../car/passenger';
import { STATIONS, nextStationIndex } from '../../core/stations';

const pick = <T>(arr: T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length)];
const _d = new THREE.Vector3();

export const adEyes: Anomaly = {
  id: 'ad-eyes',
  name: '지켜보는 광고',
  desc: '치과 광고 모델의 눈동자가 당신을 따라 움직였다.',
  difficulty: 'normal',
  update({ car, camera }) {
    const f = car.adEyeFrame;
    const max = 9 * f.scale;
    car.pupils.forEach((pm, i) => {
      const rest = car.pupilRest[i];
      _d.copy(camera.position).sub(rest).normalize();
      const du = _d.dot(f.u);
      const dv = _d.dot(f.v);
      pm.position.copy(rest).addScaledVector(f.u, du * max * 1.6).addScaledVector(f.v, dv * max);
    });
  },
};

export const ledPast: Anomaly = {
  id: 'led-past',
  name: '지나간 역',
  desc: '전광판의 다음 역이 이미 지나온 역이었다.',
  difficulty: 'normal',
  setup({ game, cfg }) {
    const past = STATIONS[Math.max(0, nextStationIndex(cfg.count) - 1)];
    game.res.led.setLines([`다음 역은 ${past}입니다`, '이 열차는 심야순환선 막차입니다', `다음 역은 ${past}입니다`]);
  },
};

export const tunnelReverse: Anomaly = {
  id: 'tunnel-reverse',
  name: '거꾸로 흐르는 불빛',
  desc: '창밖 터널 불빛이 열차가 가는 방향으로 지나가고 있었다.',
  difficulty: 'normal',
  setup({ game }) {
    game.tunnelDir = -1;
  },
};

export const stillStrap: Anomaly = {
  id: 'still-strap',
  name: '멈춘 손잡이',
  desc: '모든 손잡이가 흔들리는데 하나만 꼼짝하지 않았다.',
  difficulty: 'normal',
  setup({ game, car, rnd }) {
    // 통로 가운데쯤, 눈에 잘 띄는 긴 의자 위
    const cands = car.strapInfo.map((s, i) => ({ s, i })).filter(({ s }) => Math.abs(s.pos.z) < car.length * 0.3);
    game.frozenStrap = pick(cands, rnd).i;
  },
};

export const doorNumbers: Anomaly = {
  id: 'door-numbers',
  name: '뒤죽박죽 문 번호',
  desc: '문 위의 번호가 순서 없이 뒤섞여 있었다.',
  difficulty: 'normal',
  configure(cfg, rnd) {
    const n = normalDoorNumbers();
    const left = [...n.slice(0, 4)].sort(() => rnd() - 0.5);
    const right = [...n.slice(4)].sort(() => rnd() - 0.5);
    if (left.join() === n.slice(0, 4).join()) left.reverse();
    if (right.join() === n.slice(4).join()) right.reverse();
    const all = [...left, ...right];
    all[Math.floor(rnd() * 8)] = pick(['4-9', '0-0', '4-4', '9-4'], rnd);
    cfg.signs.doorNumbers = all;
  },
};

export const longerCar: Anomaly = {
  id: 'longer-car',
  name: '길어진 객차',
  desc: '객차가 평소보다 조금 길었다. 의자 칸 수도 늘어 있었다.',
  difficulty: 'normal',
  configure(cfg) {
    cfg.length = BASE_LENGTH * 1.24;
  },
};

export const reverseAnnounce: Anomaly = {
  id: 'reverse-announce',
  name: '거꾸로 된 안내 방송',
  desc: '안내 방송이 거꾸로 재생되고 있었다. 차임 소리부터 이상했다.',
  difficulty: 'normal',
  setup({ game }) {
    game.announceReversed = true;
  },
};

export const missingPassenger: Anomaly = {
  id: 'missing-passenger',
  name: '사라진 승객',
  desc: '셋이어야 할 승객이 둘뿐이었다.',
  difficulty: 'normal',
  configure(cfg, rnd) {
    cfg.passengers.splice(Math.floor(rnd() * cfg.passengers.length), 1);
  },
};

export const adText: Anomaly = {
  id: 'ad-text',
  name: '바뀐 광고 문구',
  desc: '국밥집 광고가 "내리지 마세요"로 바뀌어 있었다.',
  difficulty: 'normal',
  configure(cfg) {
    cfg.signs.adOverride = { ad: 2, lines: ['내리지 마세요', '24시 · 계속 타고 계세요'] };
  },
};

export const silentCar: Anomaly = {
  id: 'silent-car',
  name: '멈춘 흔들림',
  desc: '창밖은 흘러가는데 객차는 흔들리지도, 덜컹거리지도 않았다.',
  difficulty: 'normal',
  setup({ game }) {
    game.swayEnabled = false;
    game.audio.setTravel(false, 0.05);
  },
};

// ── 데칼(발자국·손자국) ────────────────────────
let footTex: THREE.CanvasTexture | null = null;
function footprintTexture() {
  if (footTex) return footTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(20,14,10,0.85)';
  g.beginPath();
  g.ellipse(32, 44, 20, 34, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(32, 102, 15, 20, 0, 0, Math.PI * 2);
  g.fill();
  footTex = new THREE.CanvasTexture(c);
  footTex.colorSpace = THREE.SRGBColorSpace;
  return footTex;
}

export const footprints: Anomaly = {
  id: 'footprints',
  name: '젖은 발자국',
  desc: '문에서 시작된 젖은 발자국이 뒤 칸 쪽으로 이어져 있었다.',
  difficulty: 'normal',
  setup({ car }) {
    const mat = new THREE.MeshBasicMaterial({ map: footprintTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const geo = new THREE.PlaneGeometry(0.11, 0.24);
    geo.rotateX(-Math.PI / 2);
    const half = car.length / 2;
    const steps: { x: number; z: number; a: number }[] = [];
    // 왼쪽 가운데 문에서 나와 통로를 따라 뒤(+z)로
    const startZ = -car.length * 0.125;
    let i = 0;
    for (let z = startZ; z < half - 0.6; z += 0.36, i++) {
      const k = Math.min(1, (z - startZ) / 2.2);
      const cx = -1.2 + k * 1.2;
      steps.push({ x: cx + (i % 2 ? 0.1 : -0.1), z, a: k < 1 ? -0.5 * (1 - k) : 0 });
    }
    const inst = new THREE.InstancedMesh(geo, mat, steps.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    steps.forEach((s, j) => {
      // 발끝이 +z(뒤 칸) 쪽을 향하게
      q.setFromEuler(new THREE.Euler(0, Math.PI + s.a, 0));
      m.compose(new THREE.Vector3(s.x, 0.006, s.z), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(j, m);
    });
    car.root.add(inst);
  },
};

let watcherVanished = false;
let watcher: THREE.Group | null = null;
export const watcher_: Anomaly = {
  id: 'watcher',
  name: '문 너머의 사람',
  desc: '앞 칸 연결 통로에 누군가 서서 이쪽을 보고 있었다. 다가가자 사라졌다.',
  difficulty: 'normal',
  setup({ car, game }) {
    const p = buildPassenger(
      { key: 'w', bench: 0, slot: 0, pose: 'stand', coat: 0x16171a, pants: 0x121215, hair: 0x050505, x: 0.05, z: -(car.length / 2 + 0.62), yaw: 0 },
      car.length,
      game.res.staticMat,
    );
    car.root.add(p.group);
    watcher = p.group;
    watcherVanished = false;
  },
  update({ car, game }) {
    if (!watcher || watcherVanished) return;
    if (game.player.pos.z < -car.length / 2 + 3.2) {
      watcher.visible = false;
      watcherVanished = true;
    }
  },
};

let handTex: THREE.CanvasTexture | null = null;
function handprintTexture() {
  if (handTex) return handTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  const hand = (x: number, y: number, r: number, s: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(r);
    g.scale(s, s);
    g.fillStyle = 'rgba(220,215,205,0.55)';
    g.beginPath();
    g.ellipse(0, 10, 18, 22, 0, 0, Math.PI * 2);
    g.fill();
    for (const [fx, fy, len, a] of [[-14, -14, 22, -0.25], [-5, -20, 27, -0.08], [5, -20, 28, 0.06], [14, -15, 24, 0.22], [20, 12, 18, 1.0]] as const) {
      g.save();
      g.translate(fx, fy);
      g.rotate(a);
      g.beginPath();
      g.ellipse(0, -len / 2, 4.5, len / 2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.restore();
  };
  hand(70, 90, -0.2, 1.4);
  hand(150, 70, 0.15, 1.3);
  hand(200, 160, 0.3, 1.2);
  hand(100, 180, -0.4, 1.1);
  g.fillStyle = 'rgba(220,215,205,0.2)';
  for (let i = 0; i < 6; i++) g.fillRect(60 + i * 18, 110, 3, 60 + Math.random() * 60);
  handTex = new THREE.CanvasTexture(c);
  handTex.colorSpace = THREE.SRGBColorSpace;
  return handTex;
}

export const handprints: Anomaly = {
  id: 'handprints',
  name: '창문의 손자국',
  desc: '터널 쪽에서 누군가 창문을 짚은 손자국이 남아 있었다.',
  difficulty: 'normal',
  setup({ car, rnd }) {
    const mid = car.windows.filter((w) => Math.abs((w.z0 + w.z1) / 2) < car.length * 0.32);
    const w = pick(mid, rnd);
    const mat = new THREE.MeshBasicMaterial({ map: handprintTexture(), transparent: true, depthWrite: false });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), mat);
    q.position.set(w.side * (HALF_W + 0.012), 1.38, (w.z0 + w.z1) / 2);
    q.rotation.y = w.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    q.renderOrder = 3;
    car.root.add(q);
  },
};

export const NORMAL: Anomaly[] = [
  adEyes, ledPast, tunnelReverse, stillStrap, doorNumbers, longerCar, reverseAnnounce,
  missingPassenger, adText, silentCar, footprints, watcher_, handprints,
];

