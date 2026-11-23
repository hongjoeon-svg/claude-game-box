import * as THREE from 'three';
import { Bucket, makeQuad } from './geo';
import type { CarConfig } from './config';
import {
  HALF_W, WALL_TOP, CEIL, COVE_X, DOOR_W, DOOR_H, END_DOOR_W, WIN_BOTTOM, WIN_TOP,
  SEAT_H, SEAT_FRONT, BAR_X, BAR_Y, doorZs, benches,
} from './layout';
import { SignAtlas, AD_EYES, AD_CELL } from './signs';
import { LedBoard } from './led';
import { makeTunnelTexture, makePlatformTexture, makeFloorTexture, TUNNEL_PERIOD } from './textures';
import { buildPassenger, type Passenger } from './passenger';

const C = {
  wall: 0xd9d6cd,
  wallLow: 0xbab6ac,
  cove: 0xe6e4dd,
  ceil: 0xf0f0ea,
  frame: 0x8d9298,
  seat: 0x34579a,
  seatPri: 0xb3485c,
  seatOdd: 0x3d6b4b,
  seatBase: 0x9aa0a7,
  metal: 0xcdd1d6,
  dark: 0x26272b,
  door: 0xb4b9bf,
  rubber: 0x18181a,
  ao: 0x34322e,
  gangway: 0x141416,
  housing: 0xdedfd9,
  duct: 0xd2d2cc,
};

/** 객차를 다시 만들 때도 재사용하는 재질·텍스처 */
export class CarResources {
  readonly staticMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  readonly floorMat: THREE.MeshLambertMaterial;
  readonly signMat: THREE.MeshBasicMaterial;
  readonly ledMat: THREE.MeshBasicMaterial;
  readonly glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  readonly tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  readonly glassMat = new THREE.MeshBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.07, depthWrite: false });
  readonly pupilMat = new THREE.MeshBasicMaterial({ color: 0x1a120e });
  readonly tunnelL: THREE.CanvasTexture;
  readonly tunnelR: THREE.CanvasTexture;
  readonly tunnelMatL: THREE.MeshBasicMaterial;
  readonly tunnelMatR: THREE.MeshBasicMaterial;
  readonly platformTex: THREE.CanvasTexture;
  readonly atlas: SignAtlas;
  readonly led = new LedBoard();

  constructor(maxAniso: number) {
    this.atlas = new SignAtlas(maxAniso);
    this.floorMat = new THREE.MeshLambertMaterial({ map: makeFloorTexture(maxAniso) });
    this.signMat = new THREE.MeshBasicMaterial({ map: this.atlas.texture });
    this.ledMat = new THREE.MeshBasicMaterial({ map: this.led.texture });
    this.tunnelR = makeTunnelTexture();
    this.tunnelL = this.tunnelR.clone();
    this.tunnelL.needsUpdate = true;
    this.tunnelMatL = new THREE.MeshBasicMaterial({ map: this.tunnelL });
    this.tunnelMatR = new THREE.MeshBasicMaterial({ map: this.tunnelR });
    this.platformTex = makePlatformTexture();
  }
}

export interface StrapInfo { pos: THREE.Vector3; phase: number; amp: number }
export interface SideDoorInfo { side: -1 | 1; z: number; dir: -1 | 1; w: number }

export interface CarBuild {
  root: THREE.Group;
  length: number;
  tubes: THREE.InstancedMesh;
  tubePositions: THREE.Vector3[];
  straps: THREE.InstancedMesh;
  strapInfo: StrapInfo[];
  passengers: Passenger[];
  pupils: THREE.Mesh[];
  pupilRest: THREE.Vector3[];
  adEyeFrame: { u: THREE.Vector3; v: THREE.Vector3; n: THREE.Vector3; scale: number };
  frontDoor: THREE.Mesh;
  backDoor: THREE.Mesh;
  sideDoors: THREE.InstancedMesh;
  sideDoorInfo: SideDoorInfo[];
  poles: { a: THREE.Vector3; b: THREE.Vector3 }[];
  windows: { side: -1 | 1; z0: number; z1: number }[];
  dispose(): void;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildCar(cfg: CarConfig, res: CarResources): CarBuild {
  const L = cfg.length;
  const half = L / 2;
  const dz = doorZs(L);
  const bs = benches(L);
  const root = new THREE.Group();
  const st = new Bucket(); // 정적 정점색 메시
  const glow = new Bucket(); // 발광(조명 무시)
  const signs = new Bucket();
  const glass = new Bucket();
  const atlas = res.atlas;
  atlas.draw(cfg.signs, cfg.count, cfg.terminal);

  // ── 바닥 ─────────────────────────────
  const floorGeo = new THREE.PlaneGeometry(HALF_W * 2, L + 0.2, 1, 1);
  floorGeo.rotateX(-Math.PI / 2);
  const uv = floorGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (L / 3));
  const floor = new THREE.Mesh(floorGeo, res.floorMat);
  root.add(floor);

  // ── 천장 / 코브 ──────────────────────
  st.quad(V(0, CEIL, 0), V(1, 0, 0), V(0, 0, 1), COVE_X * 2, L, C.ceil);
  const coveLen = Math.hypot(HALF_W - COVE_X, CEIL - WALL_TOP);
  const coveV = (s: number) => V(-s * (HALF_W - COVE_X), CEIL - WALL_TOP, 0).normalize();
  const coveN = (s: number) => V(0, 0, s).cross(coveV(s)).normalize();
  const coveAt = (s: number, f: number, z: number) =>
    V(s * HALF_W, WALL_TOP, z).add(coveV(s).multiplyScalar(coveLen * f)).add(coveN(s).multiplyScalar(0.004));
  for (const s of [-1, 1]) {
    st.quad(V((s * (HALF_W + COVE_X)) / 2, (WALL_TOP + CEIL) / 2, 0), V(0, 0, s), coveV(s), L, coveLen, C.cove);
  }
  // 에어컨 덕트 + 조명 하우징
  st.box(0.46, 0.03, L, 0, CEIL - 0.015, 0, C.duct);
  for (let z = -half + 1.5; z < half - 1; z += 2.2) st.box(0.24, 0.004, 0.32, 0, CEIL - 0.031, z, 0xa9acaf);
  for (const s of [-1, 1]) st.box(0.24, 0.045, L, s * 0.66, CEIL - 0.0225, 0, C.housing);

  // 형광등 (인스턴스, 하나씩 색을 바꿀 수 있음)
  const tubePositions: THREE.Vector3[] = [];
  const nTubes = Math.floor((L - 0.6) / 1.3);
  const t0 = -((nTubes - 1) * 1.3) / 2;
  for (const s of [-1, 1]) for (let i = 0; i < nTubes; i++) tubePositions.push(V(s * 0.66, CEIL - 0.055, t0 + i * 1.3));
  const tubeGeo = new THREE.BoxGeometry(0.15, 0.025, 1.18);
  const tubes = new THREE.InstancedMesh(tubeGeo, res.tubeMat, tubePositions.length);
  const m4 = new THREE.Matrix4();
  const white = new THREE.Color(0xffffff);
  tubePositions.forEach((p, i) => {
    tubes.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
    tubes.setColorAt(i, white);
  });
  root.add(tubes);

  // ── 옆벽 (문·창문 구멍) ───────────────
  const windows: CarBuild['windows'] = [];
  for (const s of [-1, 1] as const) {
    const openings: { z0: number; z1: number; y0: number; y1: number }[] = [];
    for (const z of dz) openings.push({ z0: z - DOOR_W / 2, z1: z + DOOR_W / 2, y0: 0, y1: DOOR_H });
    for (const b of bs.filter((bb) => bb.side === s)) {
      const z0 = b.z0 + 0.08;
      const z1 = b.z1 - 0.08;
      const n = Math.max(1, Math.round((z1 - z0) / 1.45));
      const pw = (z1 - z0 - (n - 1) * 0.1) / n;
      for (let i = 0; i < n; i++) {
        const a = z0 + i * (pw + 0.1);
        openings.push({ z0: a, z1: a + pw, y0: WIN_BOTTOM, y1: WIN_TOP });
        windows.push({ side: s, z0: a, z1: a + pw });
      }
    }
    const edges = [...new Set([-half, half, ...openings.flatMap((o) => [o.z0, o.z1])])].sort((a, b) => a - b);
    const wx = s * (HALF_W + 0.04);
    const seg = (za: number, zb: number, y0: number, y1: number) => {
      if (y1 - y0 < 0.001) return;
      // 창 아래는 조금 어두운 판넬
      const cut = Math.min(Math.max(WIN_BOTTOM, y0), y1);
      if (cut > y0) st.box(0.08, cut - y0, zb - za, wx, (y0 + cut) / 2, (za + zb) / 2, C.wallLow);
      if (y1 > cut) st.box(0.08, y1 - cut, zb - za, wx, (cut + y1) / 2, (za + zb) / 2, C.wall);
    };
    for (let i = 0; i < edges.length - 1; i++) {
      const za = edges[i];
      const zb = edges[i + 1];
      const mid = (za + zb) / 2;
      const o = openings.find((op) => mid > op.z0 && mid < op.z1);
      if (!o) seg(za, zb, 0, WALL_TOP);
      else {
        seg(za, zb, 0, o.y0);
        seg(za, zb, o.y1, WALL_TOP);
      }
    }
    // 창틀 + 유리
    for (const o of openings.filter((op) => op.y0 > 0)) {
      const zc = (o.z0 + o.z1) / 2;
      const zl = o.z1 - o.z0;
      const fx = s * (HALF_W - 0.005);
      st.box(0.03, 0.04, zl + 0.04, fx, o.y0 - 0.005, zc, C.frame);
      st.box(0.03, 0.04, zl + 0.04, fx, o.y1 + 0.005, zc, C.frame);
      st.box(0.03, o.y1 - o.y0, 0.04, fx, (o.y0 + o.y1) / 2, o.z0 - 0.005, C.frame);
      st.box(0.03, o.y1 - o.y0, 0.04, fx, (o.y0 + o.y1) / 2, o.z1 + 0.005, C.frame);
      glass.quad(V(s * (HALF_W + 0.02), (o.y0 + o.y1) / 2, zc), V(0, 0, s), V(0, 1, 0), zl, o.y1 - o.y0, 0xffffff);
      // 창턱
      st.box(0.07, 0.025, zl, s * (HALF_W - 0.03), o.y0 - 0.012, zc, C.frame);
    }
    // 문 테두리 고무
    for (const z of dz) {
      st.box(0.05, DOOR_H, 0.05, s * (HALF_W - 0.01), DOOR_H / 2, z - DOOR_W / 2 - 0.02, C.rubber);
      st.box(0.05, DOOR_H, 0.05, s * (HALF_W - 0.01), DOOR_H / 2, z + DOOR_W / 2 + 0.02, C.rubber);
      st.box(0.05, 0.05, DOOR_W + 0.09, s * (HALF_W - 0.01), DOOR_H + 0.02, z, C.rubber);
      // 문 앞 바닥 노란 경고선
      st.box(0.18, 0.004, DOOR_W, s * (HALF_W - 0.1), 0.003, z, 0xc9a227);
    }
  }

  // ── 옆문 (인스턴스: 종착역에서 열림) ─────
  const leafW = DOOR_W / 2;
  const lb = new Bucket();
  const hy0 = 0.98;
  const hy1 = 1.66;
  const hz = 0.07;
  lb.box(0.04, hy0, leafW, 0, hy0 / 2, 0, C.door);
  lb.box(0.04, DOOR_H - hy1, leafW, 0, (DOOR_H + hy1) / 2, 0, C.door);
  lb.box(0.04, hy1 - hy0, hz, 0, (hy0 + hy1) / 2, -leafW / 2 + hz / 2, C.door);
  lb.box(0.04, hy1 - hy0, hz, 0, (hy0 + hy1) / 2, leafW / 2 - hz / 2, C.door);
  lb.box(0.05, hy1 - hy0 + 0.02, 0.012, 0, (hy0 + hy1) / 2, -leafW / 2 + hz, C.rubber);
  lb.box(0.05, hy1 - hy0 + 0.02, 0.012, 0, (hy0 + hy1) / 2, leafW / 2 - hz, C.rubber);
  const leafGeo = lb.geometry();
  const sideDoorInfo: SideDoorInfo[] = [];
  for (const s of [-1, 1] as const) for (const z of dz) for (const dir of [-1, 1] as const) sideDoorInfo.push({ side: s, z, dir, w: leafW });
  const sideDoors = new THREE.InstancedMesh(leafGeo, res.staticMat, sideDoorInfo.length);
  sideDoorInfo.forEach((d, i) => sideDoors.setMatrixAt(i, m4.makeTranslation(d.side * (HALF_W - 0.03), 0, d.z + (d.dir * leafW) / 2)));
  root.add(sideDoors);

  // ── 의자 / 봉 / 칸막이 ─────────────────
  const poles: CarBuild['poles'] = [];
  for (const b of bs) {
    const s = b.side;
    const len = b.z1 - b.z0;
    const zc = (b.z0 + b.z1) / 2;
    const missing = cfg.missingBench === b.id;
    if (!missing) {
      st.box(0.36, 0.26, len, s * (HALF_W - 0.22), 0.26, zc, C.seatBase);
      st.box(0.62, 0.004, len + 0.1, s * (HALF_W - 0.31), 0.003, zc, C.ao);
      const sw = len / b.seats;
      for (let i = 0; i < b.seats; i++) {
        const z = b.z0 + sw * (i + 0.5);
        const odd = cfg.oddSeat && cfg.oddSeat.bench === b.id && cfg.oddSeat.slot === i;
        const col = odd ? C.seatOdd : b.priority ? C.seatPri : C.seat;
        st.box(HALF_W - SEAT_FRONT - 0.02, 0.07, sw - 0.012, s * ((HALF_W + SEAT_FRONT) / 2 - 0.01), SEAT_H - 0.035, z, col);
        st.box(0.07, 0.46, sw - 0.012, s * (HALF_W - 0.07), SEAT_H + 0.27, z, col, 0, 0, -s * 0.13);
      }
    }
    // 칸막이 + 수직 봉 (문 쪽 끝에만)
    const ends: number[] = [];
    if (b.seg !== 0) ends.push(b.z0);
    if (b.seg !== 4) ends.push(b.z1);
    for (const ez of ends) {
      const out = ez === b.z0 ? -1 : 1;
      st.box(0.46, 0.72, 0.035, s * (HALF_W - 0.26), SEAT_H + 0.34, ez + out * 0.02, C.metal);
      st.box(0.46, 0.035, 0.05, s * (HALF_W - 0.26), SEAT_H + 0.7, ez + out * 0.02, C.frame);
      poles.push({ a: V(s * BAR_X, 0, ez + out * 0.06), b: V(s * BAR_X, BAR_Y, ez + out * 0.06) });
    }
    // 손잡이 가로봉 + 코브로 가는 지지대
    st.rod(V(s * BAR_X, BAR_Y, b.z0 - 0.06), V(s * BAR_X, BAR_Y, b.z1 + 0.06), 0.016, C.metal);
    for (const z of [b.z0 + 0.25, b.z1 - 0.25]) st.rod(V(s * BAR_X, BAR_Y, z), V(s * (HALF_W - 0.04), WALL_TOP + 0.04, z), 0.012, C.metal);
    // 선반(짐받이)
    st.box(0.32, 0.02, len, s * (HALF_W - 0.17), WIN_TOP + 0.12, zc, C.metal);
  }
  poles.forEach((p, i) => {
    st.box(0.08, 0.02, 0.08, p.a.x, 0.01, p.a.z, C.dark);
    if (cfg.bentPole === i) {
      const k = V(p.a.x - Math.sign(p.a.x) * 0.13, 1.05, p.a.z);
      st.rod(p.a, k, 0.018, C.metal);
      st.rod(k, p.b, 0.018, C.metal);
      st.sphere(0.018, k.x, k.y, k.z, C.metal, 1, 1, 1, 8);
    } else st.rod(p.a, p.b, 0.018, C.metal);
  });

  // 손잡이 (인스턴스, 흔들림)
  const strapInfo: StrapInfo[] = [];
  for (const b of bs) {
    for (let z = b.z0 + 0.2; z < b.z1 - 0.1; z += 0.34) {
      strapInfo.push({ pos: V(b.side * BAR_X, BAR_Y - 0.01, z), phase: Math.random() * 0.6, amp: 0.85 + Math.random() * 0.3 });
    }
  }
  const sb = new Bucket();
  sb.box(0.028, 0.24, 0.006, 0, -0.12, 0, 0xe9e7e0);
  sb.box(0.04, 0.035, 0.03, 0, -0.01, 0, 0x9aa0a7);
  // 삼각 손잡이
  const tri = [V(0, -0.24, 0), V(-0.065, -0.35, 0), V(0.065, -0.35, 0)];
  for (let i = 0; i < 3; i++) sb.rod(tri[i], tri[(i + 1) % 3], 0.011, 0xf2efe6, 6);
  const straps = new THREE.InstancedMesh(sb.geometry(), res.staticMat, strapInfo.length);
  straps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  strapInfo.forEach((si, i) => straps.setMatrixAt(i, m4.makeTranslation(si.pos.x, si.pos.y, si.pos.z)));
  root.add(straps);

  // ── 양 끝 벽 + 연결 통로 ────────────────
  const endDoors: THREE.Mesh[] = [];
  for (const e of [-1, 1] as const) {
    const ez = e * (half + 0.04);
    const dw = END_DOOR_W;
    const sideW = HALF_W - dw / 2;
    st.box(sideW, WALL_TOP, 0.08, -(dw / 2 + sideW / 2), WALL_TOP / 2, ez, C.wall);
    st.box(sideW, WALL_TOP, 0.08, dw / 2 + sideW / 2, WALL_TOP / 2, ez, C.wall);
    st.box(dw, WALL_TOP - DOOR_H, 0.08, 0, (WALL_TOP + DOOR_H) / 2, ez, C.wall);
    st.box(HALF_W * 2, CEIL - WALL_TOP + 0.02, 0.08, 0, (WALL_TOP + CEIL) / 2, ez, C.wall);
    // 문틀
    const fz = e * (half - 0.005);
    st.box(0.05, DOOR_H, 0.03, -dw / 2 - 0.02, DOOR_H / 2, fz, C.frame);
    st.box(0.05, DOOR_H, 0.03, dw / 2 + 0.02, DOOR_H / 2, fz, C.frame);
    st.box(dw + 0.09, 0.05, 0.03, 0, DOOR_H + 0.02, fz, C.frame);
    // 전광판 하우징
    st.box(1.12, 0.17, 0.06, 0, 2.1, e * (half - 0.03), C.dark);
    // 소화기함
    st.box(0.3, 0.5, 0.04, -1.05, 0.5, e * (half - 0.02), 0xb8bcc1);
    st.box(0.26, 0.08, 0.045, -1.05, 0.68, e * (half - 0.02), 0xc33a32);
    // 연결 통로 (어두운 주름막)
    const gz0 = e * (half + 0.08);
    const gz1 = e * (half + 1.1);
    const gc = (gz0 + gz1) / 2;
    const gl = Math.abs(gz1 - gz0);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) st.box(0.06, DOOR_H + 0.1, gl / 6 - 0.02, s * (dw / 2 + 0.12), (DOOR_H + 0.1) / 2, gz0 + (e * gl * (k + 0.5)) / 6, k % 2 ? C.gangway : 0x1d1d20);
    }
    st.box(dw + 0.3, 0.06, gl, 0, DOOR_H + 0.12, gc, C.gangway);
    st.box(dw + 0.3, 0.02, gl, 0, 0.0, gc, 0x2b2a28);
    // 다음 칸의 문 (창 너머는 밝은 객차)
    const nz = e * (half + 1.12);
    st.box(dw + 0.4, DOOR_H + 0.3, 0.05, 0, (DOOR_H + 0.3) / 2 - 0.0001, nz + e * 0.04, C.door);
    glow.quad(V(0, 1.36, nz - e * 0.001), V(-e, 0, 0), V(0, 1, 0), 0.5, 0.62, 0xd8dccf);
    // 이 칸의 끝문 (미닫이)
    const db = new Bucket();
    const w = dw;
    db.box(w, 1.05, 0.04, 0, 0.525, 0, C.door);
    db.box(w, DOOR_H - 1.72, 0.04, 0, (DOOR_H + 1.72) / 2, 0, C.door);
    db.box(0.18, 0.67, 0.04, -w / 2 + 0.09, 1.385, 0, C.door);
    db.box(0.18, 0.67, 0.04, w / 2 - 0.09, 1.385, 0, C.door);
    db.box(w - 0.32, 0.015, 0.05, 0, 1.05, 0, C.rubber);
    db.box(w - 0.32, 0.015, 0.05, 0, 1.72, 0, C.rubber);
    db.box(0.03, 0.18, 0.05, w / 2 - 0.06, 0.95, -e * 0.02, C.dark); // 손잡이
    const door = db.build(res.staticMat);
    door.matrixAutoUpdate = true;
    door.position.set(0, 0, ez);
    root.add(door);
    endDoors.push(door);
  }

  // ── 표지 (아틀라스 1장) ───────────────
  for (const s of [-1, 1] as const) {
    const u = V(0, 0, s);
    dz.forEach((z, di) => {
      // 노선도 (문 위 코브)
      const panel = (s < 0 ? 0 : 4) + di;
      const ov = cfg.signs.routeOverride;
      const cell = ov && ov.panel === panel ? 'routeAlt' : 'route';
      const c = coveAt(s, 0.47, z);
      st.quad(c.clone().sub(coveN(s).multiplyScalar(0.002)), u, coveV(s), 1.2, 0.25, C.frame);
      signs.quad(c, u, coveV(s), 1.12, 0.21, 0xffffff, atlas.uv(cell));
      // 문 번호
      signs.quad(V(s * (HALF_W - 0.006), 1.925, z), u, V(0, 1, 0), 0.2, 0.1, 0xffffff, atlas.uv('door' + panel));
      // 스티커 (문 옆 기둥)
      if (!cfg.terminal) {
        for (const side of [-1, 1]) {
          signs.quad(V(s * (HALF_W - 0.006), 1.35, z + side * (DOOR_W / 2 + 0.135)), u, V(0, 1, 0), 0.2, 0.1, 0xffffff, atlas.uv('sticker'));
        }
      }
    });
    // 배려석 표지
    for (const b of bs.filter((bb) => bb.side === s && bb.priority)) {
      signs.quad(V(s * (HALF_W - 0.006), 1.89, (b.z0 + b.z1) / 2), u, V(0, 1, 0), 0.42, 0.105, 0xffffff, atlas.uv('priority'));
    }
  }
  // 광고 (코브)
  const adSlots: { s: -1 | 1; seg: number; cell: string }[] = [
    { s: 1, seg: 1, cell: 'ad0' },
    { s: -1, seg: 1, cell: 'ad1' },
    { s: 1, seg: 2, cell: 'ad2' },
    { s: -1, seg: 3, cell: 'ad1' },
    { s: 1, seg: 3, cell: 'ad1' },
  ];
  const adW = 0.84;
  const adH = 0.42;
  const pupils: THREE.Mesh[] = [];
  const pupilRest: THREE.Vector3[] = [];
  let adEyeFrame: CarBuild['adEyeFrame'] = { u: V(0, 0, 1), v: V(0, 1, 0), n: V(-1, 0, 0), scale: adW / AD_CELL.w };
  for (const a of adSlots) {
    const b = bs.find((bb) => bb.side === a.s && bb.seg === a.seg)!;
    const zc = (b.z0 + b.z1) / 2;
    const c = coveAt(a.s, 0.5, zc);
    const u = V(0, 0, a.s);
    const v = coveV(a.s);
    st.quad(c.clone().sub(coveN(a.s).multiplyScalar(0.002)), u, v, adW + 0.05, Math.min(adH + 0.04, coveLen - 0.02), C.frame);
    signs.quad(c, u, v, adW, adH, 0xffffff, atlas.uv(a.cell));
    if (a.cell === 'ad0') {
      const n = coveN(a.s);
      const scale = adW / AD_CELL.w;
      adEyeFrame = { u, v, n, scale };
      for (const e of AD_EYES) {
        const p = c
          .clone()
          .add(u.clone().multiplyScalar((e.x - AD_CELL.w / 2) * scale))
          .add(v.clone().multiplyScalar((AD_CELL.h / 2 - e.y) * scale))
          .add(n.clone().multiplyScalar(0.003));
        const pm = new THREE.Mesh(new THREE.CircleGeometry(e.r * 0.62 * scale, 14), res.pupilMat);
        pm.position.copy(p);
        pm.lookAt(p.clone().add(n));
        root.add(pm);
        pupils.push(pm);
        pupilRest.push(p.clone());
      }
    }
  }
  // 끝 벽 표지 + 전광판
  const led = new Bucket();
  for (const e of [-1, 1] as const) {
    const u = V(-e, 0, 0);
    const wz = e * (half - 0.006);
    signs.quad(V(0.66 * -e, 1.62, wz), u, V(0, 1, 0), 0.24, 0.09, 0xffffff, atlas.uv('plate'));
    signs.quad(V(-0.66 * -e, 1.4, wz), u, V(0, 1, 0), 0.22, 0.11, 0xffffff, atlas.uv('intercom'));
    led.quad(V(0, 2.1, e * (half - 0.064)), u, V(0, 1, 0), 1.04, 0.13, 0xffffff);
  }

  // ── 창밖: 터널 or 승강장 ───────────────
  const outLen = L + 10;
  const tunnelL = new THREE.Mesh(new THREE.PlaneGeometry(outLen, 3.6), res.tunnelMatL);
  tunnelL.position.set(-2.3, 1.2, 0);
  tunnelL.rotation.y = Math.PI / 2;
  root.add(tunnelL);
  res.tunnelL.repeat.set(outLen / TUNNEL_PERIOD, 1);
  res.tunnelR.repeat.set(outLen / TUNNEL_PERIOD, 1);
  if (!cfg.terminal) {
    const tunnelR = new THREE.Mesh(new THREE.PlaneGeometry(outLen, 3.6), res.tunnelMatR);
    tunnelR.position.set(2.3, 1.2, 0);
    tunnelR.rotation.y = -Math.PI / 2;
    root.add(tunnelR);
  } else {
    const pm = new THREE.MeshLambertMaterial({ map: res.platformTex });
    res.platformTex.repeat.set(outLen / 8, 1);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(outLen, 4), pm);
    wall.position.set(5.2, 1.6, 0);
    wall.rotation.y = -Math.PI / 2;
    root.add(wall);
    st.box(3.6, 0.3, outLen, HALF_W + 0.1 + 1.8, -0.15, 0, 0x8d8a83);
    st.box(0.3, 0.005, outLen, HALF_W + 0.35, 0.002, 0, 0xe0b52a);
    st.box(3.8, 0.05, outLen, HALF_W + 1.9, 3.3, 0, 0x6c6a66);
    for (let z = -half; z <= half; z += 3) glow.box(0.2, 0.03, 1.4, HALF_W + 2.2, 3.26, z, 0xfff6e0);
    for (const z of [-4, 4]) {
      st.box(1.5, 0.08, 0.45, 4.3, 0.45, z, 0x6b4a33);
      st.box(0.08, 0.45, 0.08, 4.3, 0.22, z - 0.6, C.metal);
    }
  }

  // ── 승객 ──────────────────────────────
  const passengers = cfg.passengers.map((p) => buildPassenger(p, L, res.staticMat));
  for (const p of passengers) root.add(p.group);

  // ── 메시 확정 ──────────────────────────
  const staticMesh = st.build(res.staticMat);
  root.add(staticMesh);
  if (!glow.empty) root.add(glow.build(res.glowMat));
  root.add(signs.build(res.signMat));
  root.add(led.build(res.ledMat));
  const glassMesh = glass.build(res.glassMat);
  glassMesh.renderOrder = 2;
  root.add(glassMesh);

  return {
    root,
    length: L,
    tubes,
    tubePositions,
    straps,
    strapInfo,
    passengers,
    pupils,
    pupilRest,
    adEyeFrame,
    frontDoor: endDoors[0],
    backDoor: endDoors[1],
    sideDoors,
    sideDoorInfo,
    poles,
    windows,
    dispose() {
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        // 승객 휴대폰·승강장처럼 빌드마다 새로 만든 재질만 정리
        if (mat && !isShared(mat, res)) mat.dispose();
      });
    },
  };
}

function isShared(m: THREE.Material, r: CarResources) {
  return [r.staticMat, r.floorMat, r.signMat, r.ledMat, r.glowMat, r.tubeMat, r.glassMat, r.pupilMat, r.tunnelMatL, r.tunnelMatR].includes(m as never);
}

export { makeQuad };
