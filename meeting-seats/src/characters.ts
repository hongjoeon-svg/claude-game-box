/**
 * 부서 대표 캐릭터. 외부 이미지 없이 Canvas 로 얼굴을 그려 dataURL 로 캐시한다.
 */
import { type Rng, shuffle } from './core/rng';

export interface Character {
  id: string;
  name: string;
  /** 부서 구역 색 */
  color: string;
  /** 진한 강조색 (테두리·글자) */
  ink: string;
}

export const CHARACTERS: Character[] = [
  { id: 'bujang', name: '부장님', color: '#ffa8a8', ink: '#c0392b' },
  { id: 'gwajang', name: '과장님', color: '#ffc98b', ink: '#c96b00' },
  { id: 'chajang', name: '차장님', color: '#ffe680', ink: '#a07c00' },
  { id: 'daeri', name: '대리', color: '#b8e68f', ink: '#4c8a16' },
  { id: 'jooim', name: '주임', color: '#8fd6ff', ink: '#1a74a8' },
  { id: 'mz', name: 'MZ 신입', color: '#bfaeff', ink: '#5b3fc4' },
  { id: 'intern', name: '인턴', color: '#f7b0f0', ink: '#b83a87' },
  { id: 'nephew', name: '사장님 조카', color: '#82e0cc', ink: '#13856d' },
  { id: 'couple', name: '비밀연애 중', color: '#e0c3a3', ink: '#8a5a2b' },
];

/** 부서 번호 → 캐릭터 (퍼즐마다 시드로 섞는다) */
export function assignCharacters(n: number, rng: Rng): Character[] {
  return shuffle(rng, CHARACTERS.slice()).slice(0, n);
}

const SKIN = '#ffdcb8';
const SKIN_SHADE = '#f2c29a';
const LINE = '#3b2b25';

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

/** roundRect 미지원(iOS 15 이하) 대비 */
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function eyes(g: CanvasRenderingContext2D, y: number, opts: { r?: number; gap?: number; closed?: boolean } = {}) {
  const r = opts.r ?? 5.5;
  const gap = opts.gap ?? 19;
  if (opts.closed) {
    g.strokeStyle = LINE;
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(64 + s * gap, y + 2, 7, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
    return;
  }
  for (const s of [-1, 1]) {
    circle(g, 64 + s * gap, y, r, LINE);
    circle(g, 64 + s * gap + r * 0.35, y - r * 0.35, r * 0.32, '#fff');
  }
}

function mouth(g: CanvasRenderingContext2D, kind: 'smile' | 'flat' | 'o' | 'smirk' | 'frown' | 'grin', y = 88) {
  g.strokeStyle = LINE;
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.beginPath();
  switch (kind) {
    case 'smile': g.arc(64, y - 8, 12, Math.PI * 0.2, Math.PI * 0.8); break;
    case 'grin':
      g.arc(64, y - 6, 13, Math.PI * 0.1, Math.PI * 0.9);
      g.closePath();
      g.fillStyle = '#fff';
      g.fill();
      break;
    case 'flat': g.moveTo(54, y); g.lineTo(74, y); break;
    case 'o': g.ellipse(64, y, 5, 6, 0, 0, Math.PI * 2); break;
    case 'smirk': g.moveTo(54, y + 1); g.quadraticCurveTo(68, y + 4, 76, y - 5); break;
    case 'frown': g.arc(64, y + 10, 11, Math.PI * 1.2, Math.PI * 1.8); break;
  }
  g.stroke();
}

function cheeks(g: CanvasRenderingContext2D, color = 'rgba(255,120,140,.45)') {
  circle(g, 38, 80, 8, color);
  circle(g, 90, 80, 8, color);
}

function glasses(g: CanvasRenderingContext2D, y: number, round = true) {
  g.strokeStyle = LINE;
  g.lineWidth = 3.5;
  for (const s of [-1, 1]) {
    g.beginPath();
    if (round) g.arc(64 + s * 19, y, 11, 0, Math.PI * 2);
    else g.rect(64 + s * 19 - 12, y - 8, 24, 16);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(57, y);
  g.lineTo(71, y);
  g.stroke();
}

function head(g: CanvasRenderingContext2D) {
  // 귀
  circle(g, 22, 70, 9, SKIN_SHADE);
  circle(g, 106, 70, 9, SKIN_SHADE);
  g.beginPath();
  g.ellipse(64, 68, 42, 46, 0, 0, Math.PI * 2);
  g.fillStyle = SKIN;
  g.fill();
}

function drawFace(g: CanvasRenderingContext2D, id: string) {
  g.clearRect(0, 0, 128, 128);
  head(g);
  switch (id) {
    case 'bujang': {
      // 반짝이는 정수리 + 옆머리, 콧수염, 근엄
      g.fillStyle = '#4a4a4a';
      g.beginPath(); g.ellipse(26, 52, 10, 18, -0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(102, 52, 10, 18, 0.3, 0, Math.PI * 2); g.fill();
      circle(g, 52, 34, 6, 'rgba(255,255,255,.7)');
      g.strokeStyle = LINE; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(36, 54); g.lineTo(54, 58); g.moveTo(92, 54); g.lineTo(74, 58); g.stroke();
      eyes(g, 66);
      g.fillStyle = '#4a4a4a';
      g.beginPath(); g.ellipse(55, 84, 12, 5, 0.2, 0, Math.PI * 2); g.ellipse(73, 84, 12, 5, -0.2, 0, Math.PI * 2); g.fill();
      mouth(g, 'flat', 96);
      break;
    }
    case 'gwajang': {
      // 가르마 머리 + 사각 안경
      g.fillStyle = '#2d2420';
      g.beginPath(); g.ellipse(64, 34, 44, 22, 0, Math.PI, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(22, 36); g.quadraticCurveTo(50, 20, 58, 46); g.quadraticCurveTo(80, 22, 106, 40); g.lineTo(106, 30); g.lineTo(22, 30); g.fill();
      eyes(g, 66, { r: 4.5 });
      glasses(g, 66, false);
      mouth(g, 'smile');
      break;
    }
    case 'chajang': {
      // 희끗한 머리, 넥타이
      g.fillStyle = '#b9b9c3';
      g.beginPath(); g.ellipse(64, 36, 45, 24, 0, Math.PI, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(64, 34, 40, 12, 0, 0, Math.PI); g.fill();
      eyes(g, 66, { closed: true });
      mouth(g, 'grin');
      g.fillStyle = '#d33';
      g.beginPath(); g.moveTo(58, 114); g.lineTo(70, 114); g.lineTo(66, 128); g.lineTo(62, 128); g.fill();
      break;
    }
    case 'daeri': {
      // 피곤한 눈 + 다크서클, 삐친 머리
      g.fillStyle = '#3a2a22';
      g.beginPath(); g.ellipse(64, 34, 44, 22, 0, Math.PI, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(60, 14); g.quadraticCurveTo(72, 2, 80, 10); g.quadraticCurveTo(70, 10, 66, 18); g.fill();
      g.fillStyle = 'rgba(120,90,160,.35)';
      g.beginPath(); g.ellipse(45, 74, 10, 5, 0, 0, Math.PI * 2); g.ellipse(83, 74, 10, 5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = LINE; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(36, 66); g.lineTo(54, 66); g.moveTo(74, 66); g.lineTo(92, 66); g.stroke();
      circle(g, 45, 68, 3.5, LINE); circle(g, 83, 68, 3.5, LINE);
      mouth(g, 'frown', 92);
      break;
    }
    case 'jooim': {
      // 단발머리 + 생글
      g.fillStyle = '#5a3a28';
      g.beginPath(); g.ellipse(64, 50, 50, 44, 0, Math.PI * 1.02, Math.PI * 1.98); g.fill();
      g.fillRect(14, 48, 16, 40); g.fillRect(98, 48, 16, 40);
      g.beginPath(); g.ellipse(64, 34, 44, 16, 0, 0, Math.PI); g.fill();
      eyes(g, 68);
      cheeks(g);
      mouth(g, 'smile');
      break;
    }
    case 'mz': {
      // 투블럭 + 무선 이어폰 + 무심한 표정
      g.fillStyle = '#1f1f2e';
      g.beginPath(); g.moveTo(22, 46); g.quadraticCurveTo(30, 10, 70, 14); g.quadraticCurveTo(110, 16, 108, 44); g.quadraticCurveTo(80, 30, 22, 46); g.fill();
      g.fillStyle = '#fff'; g.strokeStyle = '#bbb'; g.lineWidth = 2;
      for (const x of [18, 110]) { g.beginPath(); g.ellipse(x, 72, 6, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillRect(x - 2, 78, 4, 12); }
      g.strokeStyle = LINE; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(36, 64); g.lineTo(54, 66); g.moveTo(74, 66); g.lineTo(92, 64); g.stroke();
      circle(g, 46, 70, 4, LINE); circle(g, 82, 70, 4, LINE);
      mouth(g, 'flat', 90);
      break;
    }
    case 'intern': {
      // 동그란 눈 + 식은땀
      g.fillStyle = '#6b4a2e';
      g.beginPath(); g.ellipse(64, 36, 45, 24, 0, Math.PI, Math.PI * 2); g.fill();
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(28 + i * 18, 38, 10, 0, Math.PI); g.fill(); }
      eyes(g, 68, { r: 7.5 });
      mouth(g, 'o', 90);
      g.fillStyle = '#7fc8ff';
      g.beginPath(); g.moveTo(98, 36); g.quadraticCurveTo(108, 52, 98, 56); g.quadraticCurveTo(88, 52, 98, 36); g.fill();
      break;
    }
    case 'nephew': {
      // 넘긴 머리 + 선글라스 + 거만한 미소
      g.fillStyle = '#c99a2e';
      g.beginPath(); g.moveTo(20, 50); g.quadraticCurveTo(24, 6, 74, 12); g.quadraticCurveTo(112, 18, 108, 50); g.quadraticCurveTo(90, 24, 20, 50); g.fill();
      g.fillStyle = '#111';
      g.beginPath(); rrect(g, 32, 56, 28, 18, 6); rrect(g, 68, 56, 28, 18, 6); g.fill();
      g.fillRect(58, 60, 12, 4);
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(36, 59, 8, 3); g.fillRect(72, 59, 8, 3);
      mouth(g, 'smirk', 90);
      break;
    }
    case 'couple': {
      // 하트 눈 + 홍조
      g.fillStyle = '#8a3b4a';
      g.beginPath(); g.ellipse(64, 36, 45, 25, 0, Math.PI, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(46, 34, 24, 10, 0.3, 0, Math.PI); g.fill();
      for (const s of [-1, 1]) {
        const x = 64 + s * 19;
        const y = 64;
        g.fillStyle = '#ff3b6b';
        g.beginPath();
        g.moveTo(x, y + 9);
        g.bezierCurveTo(x - 14, y, x - 8, y - 10, x, y - 3);
        g.bezierCurveTo(x + 8, y - 10, x + 14, y, x, y + 9);
        g.fill();
      }
      cheeks(g, 'rgba(255,90,120,.55)');
      mouth(g, 'smile');
      break;
    }
  }
}

const faceCache = new Map<string, string>();

export function faceURL(id: string): string {
  let url = faceCache.get(id);
  if (url) return url;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  drawFace(g, id);
  url = cv.toDataURL('image/png');
  faceCache.set(id, url);
  return url;
}

export function faceImg(id: string, cls = 'face'): HTMLImageElement {
  const img = new Image();
  img.src = faceURL(id);
  img.className = cls;
  img.alt = '';
  img.draggable = false;
  return img;
}
