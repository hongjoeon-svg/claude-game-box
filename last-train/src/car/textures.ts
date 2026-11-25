import * as THREE from 'three';
import { font } from './font';

/** 터널 벽: 12m 길이 한 주기에 조명 1개, 케이블, 이음매. 가로로 반복 + 오프셋 스크롤 */
export const TUNNEL_PERIOD = 12;

export function makeTunnelTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#07080a');
  grd.addColorStop(0.5, '#121315');
  grd.addColorStop(1, '#060607');
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 256);
  // 콘크리트 얼룩
  for (let i = 0; i < 900; i++) {
    const v = Math.random() * 22;
    g.fillStyle = `rgba(${v + 20},${v + 20},${v + 22},0.25)`;
    g.fillRect(Math.random() * 1024, Math.random() * 256, 2 + Math.random() * 10, 1 + Math.random() * 4);
  }
  // 세그먼트 이음매
  g.fillStyle = 'rgba(0,0,0,0.6)';
  for (let x = 0; x < 1024; x += 128) g.fillRect(x, 0, 3, 256);
  // 케이블 다발
  for (const [y, h] of [[88, 4], [96, 3], [104, 5], [190, 4]] as const) {
    g.fillStyle = '#030303';
    g.fillRect(0, y, 1024, h);
    g.fillStyle = 'rgba(70,70,70,0.25)';
    g.fillRect(0, y, 1024, 1);
  }
  // 조명 (나트륨 등)
  const lx = 300;
  const ly = 64;
  const glow = g.createRadialGradient(lx, ly, 2, lx, ly, 90);
  glow.addColorStop(0, 'rgba(255,214,150,0.95)');
  glow.addColorStop(0.2, 'rgba(255,170,90,0.35)');
  glow.addColorStop(1, 'rgba(255,150,70,0)');
  g.fillStyle = glow;
  g.fillRect(lx - 100, ly - 90, 200, 180);
  g.fillStyle = '#fff4dc';
  g.fillRect(lx - 22, ly - 5, 44, 10);
  // 비상구 표지
  g.fillStyle = '#082a14';
  g.fillRect(770, 136, 46, 20);
  g.fillStyle = '#2fae5c';
  g.font = font(12, 800);
  g.fillText('비상구', 775, 151);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** 종착역 승강장 벽 */
export function makePlatformTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9c6bd';
  g.fillRect(0, 0, 1024, 256);
  for (let x = 0; x < 1024; x += 64) {
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = (x / 64 + y / 32) % 2 ? '#d3d0c7' : '#c4c1b8';
      g.fillRect(x + 1, y + 1, 62, 30);
    }
  }
  g.fillStyle = '#7b55d6';
  g.fillRect(0, 150, 1024, 14);
  g.fillStyle = '#1f2430';
  g.fillRect(330, 40, 360, 96);
  g.fillStyle = '#fff';
  g.font = font(64, 900);
  g.textAlign = 'center';
  g.fillText('새벽', 512, 108);
  g.font = font(18, 600);
  g.fillText('심야순환선 종착역', 512, 130);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function makeFloorTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6d6a64';
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 4000; i++) {
    const v = 80 + Math.random() * 60;
    g.fillStyle = `rgba(${v},${v - 3},${v - 8},0.35)`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 1.5, 1.5);
  }
  // 통로 가운데 밝은 띠
  g.fillStyle = 'rgba(200,190,170,0.18)';
  g.fillRect(96, 0, 64, 512);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(95, 0, 2, 512);
  g.fillRect(159, 0, 2, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(4, maxAniso);
  return t;
}
