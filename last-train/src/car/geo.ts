import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function paint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

/**
 * 같은 재질(정점 색)을 쓰는 도형을 모아서 하나의 BufferGeometry로 병합 → 드로우콜 1회.
 */
export class Bucket {
  private geos: THREE.BufferGeometry[] = [];

  add(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, m?: THREE.Matrix4) {
    let geo = g.index ? g.toNonIndexed() : g;
    if (geo !== g) g.dispose();
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    if (m) geo.applyMatrix4(m);
    paint(geo, color);
    this.geos.push(geo);
    return this;
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rx = 0, ry = 0, rz = 0) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _m.compose(_p, _q, _s);
    return this.add(new THREE.BoxGeometry(w, h, d), color, _m);
  }

  /** a → b 를 잇는 원기둥 */
  rod(a: THREE.Vector3, b: THREE.Vector3, r: number, color: THREE.ColorRepresentation, seg = 8) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    _q.setFromUnitVectors(_up, dir.normalize());
    _p.copy(a).add(b).multiplyScalar(0.5);
    _m.compose(_p, _q, _s);
    return this.add(new THREE.CylinderGeometry(r, r, len, seg, 1, false), color, _m);
  }

  capsule(a: THREE.Vector3, b: THREE.Vector3, r: number, color: THREE.ColorRepresentation, scale?: THREE.Vector3) {
    const dir = b.clone().sub(a);
    const len = Math.max(0.001, dir.length());
    _q.setFromUnitVectors(_up, dir.normalize());
    _p.copy(a).add(b).multiplyScalar(0.5);
    _m.compose(_p, _q, scale ?? _s);
    return this.add(new THREE.CapsuleGeometry(r, len, 3, 8), color, _m);
  }

  sphere(r: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, sx = 1, sy = 1, sz = 1, seg = 12) {
    _p.set(x, y, z);
    _q.identity();
    _m.compose(_p, _q, new THREE.Vector3(sx, sy, sz));
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), color, _m);
  }

  /** 임의 축 사각형. center 기준, u/v 단위축, 법선 = u × v */
  quad(center: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, w: number, h: number, color: THREE.ColorRepresentation, uv?: UVRect) {
    this.add(makeQuad(center, u, v, w, h, uv), color);
    return this;
  }

  get empty() {
    return this.geos.length === 0;
  }

  build(material: THREE.Material): THREE.Mesh {
    const merged = mergeGeometries(this.geos, false)!;
    for (const g of this.geos) g.dispose();
    this.geos = [];
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }

  geometry(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.geos, false)!;
    for (const g of this.geos) g.dispose();
    this.geos = [];
    return merged;
  }
}

export interface UVRect {
  u0: number;
  v0: number; // 아래
  u1: number;
  v1: number; // 위
}

export function makeQuad(center: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, w: number, h: number, uv?: UVRect) {
  const hu = u.clone().multiplyScalar(w / 2);
  const hv = v.clone().multiplyScalar(h / 2);
  const p0 = center.clone().sub(hu).sub(hv); // 좌하
  const p1 = center.clone().add(hu).sub(hv); // 우하
  const p2 = center.clone().add(hu).add(hv); // 우상
  const p3 = center.clone().sub(hu).add(hv); // 좌상
  const n = u.clone().cross(v).normalize();
  const r = uv ?? { u0: 0, v0: 0, u1: 1, v1: 1 };
  const pos = new Float32Array([...p0.toArray(), ...p1.toArray(), ...p2.toArray(), ...p0.toArray(), ...p2.toArray(), ...p3.toArray()]);
  const nor = new Float32Array(18);
  for (let i = 0; i < 6; i++) nor.set(n.toArray(), i * 3);
  const uvs = new Float32Array([r.u0, r.v0, r.u1, r.v0, r.u1, r.v1, r.u0, r.v0, r.u1, r.v1, r.u0, r.v1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return g;
}
