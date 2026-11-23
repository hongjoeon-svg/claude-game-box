import * as THREE from 'three';
import { AISLE_HALF, DOOR_W, EYE_HEIGHT, HALF_W, doorZs } from '../car/layout';

export const WALK_SPEED = 1.15; // m/s — 일부러 느리게, 달리기 없음

export class Player {
  readonly pos = new THREE.Vector3();
  yaw = 0; // 0 = -z (진행 방향)
  pitch = 0;
  private vel = new THREE.Vector2();
  bobPhase = 0;
  moving = 0; // 0~1 걷는 정도
  /** 오른쪽 옆문으로 나갈 수 있는지 (종착역) */
  rightDoorsOpen = false;

  reset(length: number) {
    this.pos.set(0, 0, length / 2 - 1.15);
    this.yaw = 0;
    this.pitch = -0.04;
    this.vel.set(0, 0);
  }

  look(dx: number, dy: number, sens: number) {
    const k = 0.0042 * sens;
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -1.1, 1.1);
  }

  update(dt: number, mx: number, my: number, length: number) {
    // 카메라 기준 앞/옆
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = -fz;
    const rz = fx;
    const tx = (fx * my + rx * mx) * WALK_SPEED;
    const tz = (fz * my + rz * mx) * WALK_SPEED;
    const a = 1 - Math.exp(-dt * 6);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.y += (tz - this.vel.y) * a;
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.y * dt;
    if (this.valid(nx, this.pos.z, length)) this.pos.x = nx;
    else this.vel.x = 0;
    if (this.valid(this.pos.x, nz, length)) this.pos.z = nz;
    else this.vel.y = 0;
    const speed = this.vel.length();
    this.moving = Math.min(1, speed / WALK_SPEED);
    this.bobPhase += speed * dt * 5.2;
  }

  private valid(x: number, z: number, length: number) {
    const half = length / 2;
    if (Math.abs(z) > half - 0.32) return false;
    if (Math.abs(x) <= AISLE_HALF) return true;
    // 옆문 앞은 조금 더 벽 쪽으로 다가갈 수 있음
    const inDoor = doorZs(length).some((d) => Math.abs(z - d) < DOOR_W / 2 - 0.22);
    if (!inDoor) return false;
    if (x > 0 && this.rightDoorsOpen) return x < 4.8;
    return Math.abs(x) <= HALF_W - 0.28;
  }

  eye() {
    return EYE_HEIGHT;
  }
}
