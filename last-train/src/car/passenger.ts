import * as THREE from 'three';
import { Bucket } from './geo';
import type { PassengerSpec } from './config';
import { benches, seatPos, SEAT_H } from './layout';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SKIN = 0xb2aca2;

export interface Passenger {
  spec: PassengerSpec;
  group: THREE.Group;
  head: THREE.Mesh;
  /** 기본 머리 회전 (자세에 따른) */
  headRest: THREE.Euler;
  phoneScreen: THREE.Mesh | null;
  phoneMat: THREE.MeshBasicMaterial | null;
}

/**
 * 단순한 마네킹 실루엣. 로컬 공간에서 +z 를 바라본다.
 * 앉은 자세: 원점 = 엉덩이가 닿는 좌석 표면. 선 자세: 원점 = 바닥.
 */
export function buildPassenger(spec: PassengerSpec, length: number, mat: THREE.Material): Passenger {
  const b = new Bucket();
  const coat = spec.coat;
  const pants = spec.pants;
  const standing = spec.pose === 'stand';
  const base = standing ? 0.95 : 0; // 서 있으면 엉덩이 높이를 올림
  let neckY: number;
  if (!standing) {
    b.box(0.34, 0.16, 0.32, 0, 0.08, 0.02, pants);
    b.capsule(V(0, 0.2, -0.04), V(0, 0.55, -0.08), 0.15, coat, V(1.25, 1, 0.85));
    for (const s of [-1, 1]) {
      b.capsule(V(s * 0.1, 0.08, 0.05), V(s * 0.1, 0.08, 0.4), 0.075, pants);
      b.capsule(V(s * 0.1, 0.06, 0.44), V(s * 0.11, -SEAT_H + 0.08, 0.48), 0.062, pants);
      b.box(0.1, 0.07, 0.24, s * 0.11, -SEAT_H + 0.035, 0.54, 0x111113);
      const shoulder = V(s * 0.21, 0.6, -0.07);
      const elbow = V(s * 0.22, 0.34, 0.08);
      const hand = spec.pose === 'phone' ? V(s * 0.05, 0.3, 0.3) : V(s * 0.1, 0.15, 0.3);
      b.capsule(shoulder, elbow, 0.055, coat);
      b.capsule(elbow, hand, 0.048, coat);
      b.sphere(0.04, hand.x, hand.y, hand.z, SKIN);
    }
    if (spec.pose === 'phone') b.box(0.075, 0.012, 0.14, 0, 0.31, 0.32, 0x101010, -0.7);
    neckY = 0.7;
  } else {
    b.box(0.34, 0.18, 0.24, 0, base, 0, pants);
    b.capsule(V(0, base + 0.15, 0), V(0, base + 0.5, 0), 0.15, coat, V(1.25, 1, 0.8));
    for (const s of [-1, 1]) {
      b.capsule(V(s * 0.1, base, 0), V(s * 0.1, 0.08, 0.02), 0.07, pants);
      b.box(0.1, 0.07, 0.24, s * 0.1, 0.035, 0.07, 0x111113);
      b.capsule(V(s * 0.21, base + 0.56, 0), V(s * 0.24, base - 0.1, 0.03), 0.052, coat);
      b.sphere(0.042, s * 0.24, base - 0.14, 0.03, SKIN);
    }
    neckY = base + 0.68;
  }
  b.rod(V(0, neckY - 0.06, -0.03), V(0, neckY + 0.06, -0.02), 0.045, SKIN);
  const body = b.build(mat);

  // 머리 (회전 가능하도록 따로)
  const h = new Bucket();
  h.sphere(0.105, 0, 0.11, 0, SKIN, 0.92, 1.15, 1, 14);
  h.sphere(0.11, 0, 0.14, -0.02, spec.hair, 0.97, 1.05, 0.98, 12); // 머리카락 (뒤통수)
  h.box(0.17, 0.08, 0.08, 0, 0.2, 0.05, spec.hair); // 앞머리
  for (const s of [-1, 1]) h.sphere(0.0095, s * 0.036, 0.118, 0.094, 0x050505, 1.3, 0.8, 0.5, 8);
  h.box(0.012, 0.03, 0.012, 0, 0.09, 0.1, SKIN);
  const head = h.build(mat);
  head.matrixAutoUpdate = true;
  head.position.set(0, neckY + 0.04, -0.02);
  const headRest = new THREE.Euler(0, 0, 0, 'YXZ');
  if (spec.pose === 'phone') headRest.set(0.55, 0, 0, 'YXZ');
  if (spec.pose === 'sleep') headRest.set(0.35, 0.15, 0.38, 'YXZ');
  head.rotation.copy(headRest);

  const group = new THREE.Group();
  group.add(body, head);

  let phoneScreen: THREE.Mesh | null = null;
  let phoneMat: THREE.MeshBasicMaterial | null = null;
  if (spec.pose === 'phone') {
    phoneMat = new THREE.MeshBasicMaterial({ color: 0x9cc4ff });
    phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.12), phoneMat);
    // 휴대폰 화면은 몸체 박스(x축 -0.7 회전)의 윗면 법선 (0, .76, -.64) 방향을 향한다
    phoneScreen.position.set(0, 0.31 + 0.0055, 0.32 - 0.0046);
    phoneScreen.rotation.x = Math.PI + 0.87;
    group.add(phoneScreen);
  }

  if (standing) {
    group.position.set(spec.x ?? 0, 0, spec.z ?? 0);
    group.rotation.y = spec.yaw ?? 0;
  } else {
    const bench = benches(length).find((bb) => bb.id === spec.bench)!;
    const p = seatPos(bench, Math.min(spec.slot, bench.seats - 1));
    group.position.set(p.x + bench.side * 0.02, SEAT_H, p.z);
    group.rotation.y = bench.side > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  return { spec, group, head, headRest, phoneScreen, phoneMat };
}

const _v = new THREE.Vector3();
/** 머리를 대상 쪽으로 돌린다 (부자연스럽게 많이 돌아갈 수 있음) */
export function headLookAt(p: Passenger, target: THREE.Vector3, maxYaw = 2.6) {
  _v.copy(target);
  p.group.worldToLocal(_v);
  _v.sub(p.head.position);
  const yaw = THREE.MathUtils.clamp(Math.atan2(_v.x, _v.z), -maxYaw, maxYaw);
  const pitch = -Math.atan2(_v.y - 0.1, Math.hypot(_v.x, _v.z));
  p.head.rotation.set(pitch, yaw, 0, 'YXZ');
}
