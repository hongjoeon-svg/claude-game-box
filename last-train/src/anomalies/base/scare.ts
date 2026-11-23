import * as THREE from 'three';
import type { Anomaly } from '../types';
import { buildPassenger } from '../../car/passenger';

// 갑자기 놀라게 하는 이상현상 — 전체 26종 중 2종(약 8%)만.

let faceTex: THREE.CanvasTexture | null = null;
function faceTexture() {
  if (faceTex) return faceTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  const grd = g.createRadialGradient(128, 120, 10, 128, 130, 120);
  grd.addColorStop(0, '#e9e4da');
  grd.addColorStop(0.7, '#a9a39a');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(128, 130, 92, 118, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#050505';
  for (const x of [92, 164]) {
    g.beginPath();
    g.ellipse(x, 112, 20, 26, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.ellipse(128, 196, 22, 34, 0, 0, Math.PI * 2);
  g.fill();
  faceTex = new THREE.CanvasTexture(c);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  return faceTex;
}

let face: THREE.Mesh | null = null;
let faceT = -1;
export const windowFace: Anomaly = {
  id: 'window-face',
  name: '창에 붙은 얼굴',
  desc: '앞 칸 문으로 다가가자 창에 하얀 얼굴이 들러붙었다.',
  difficulty: 'easy',
  jumpscare: true,
  setup({ car }) {
    const mat = new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true, depthWrite: false });
    face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.5), mat);
    face.position.set(0, 1.4, -(car.length / 2 + 0.085));
    face.visible = false;
    car.root.add(face);
    faceT = -1;
  },
  update({ car, game }, dt) {
    if (!face) return;
    if (faceT < 0 && game.mode === 'playing' && game.player.pos.z < -car.length / 2 + 3.4) {
      faceT = 0;
      face.visible = true;
      game.audio.sting();
      game.haptics.impact('HEAVY');
      game.kick(0.12);
    }
    if (faceT >= 0) {
      faceT += dt;
      const k = Math.min(1, faceT / 0.08);
      face.scale.setScalar(0.5 + k * 0.5 + Math.sin(faceT * 40) * 0.01 * Math.max(0, 1 - faceT));
    }
  },
};

let boT = -1;
let figure: THREE.Group | null = null;
export const blackout: Anomaly = {
  id: 'blackout',
  name: '정전',
  desc: '불이 꺼졌다 켜지자 눈앞에 누군가 서 있었다.',
  difficulty: 'easy',
  jumpscare: true,
  setup() {
    boT = -1;
    figure = null;
  },
  update({ car, game }, dt) {
    if (boT < 0) {
      if (game.mode === 'playing' && game.player.pos.z < car.length * 0.12) {
        boT = 0;
        game.setLights(false);
        game.audio.click();
        game.audio.setHum(false);
        game.audio.drone(2.2);
      }
      return;
    }
    const before = boT;
    boT += dt;
    if (before < 1.4 && boT >= 1.4) {
      const p = game.player;
      const fx = -Math.sin(p.yaw);
      const fz = -Math.cos(p.yaw);
      const fig = buildPassenger(
        { key: 'f', bench: 0, slot: 0, pose: 'stand', coat: 0x101012, pants: 0x0c0c0e, hair: 0x030303, x: p.pos.x + fx * 1.0, z: p.pos.z + fz * 1.0, yaw: Math.atan2(-fx, -fz) },
        car.length,
        game.res.staticMat,
      );
      // 머리를 살짝 기울여 더 불길하게
      fig.head.rotation.set(0.15, 0, 0.35);
      car.root.add(fig.group);
      figure = fig.group;
      game.setLights(true);
      game.audio.click();
      game.audio.setHum(true);
      game.audio.sting();
      game.haptics.impact('HEAVY');
      game.kick(0.1);
    }
    if (figure && boT > 1.4) figure.visible = true;
  },
};

export const SCARE: Anomaly[] = [windowFace, blackout];
