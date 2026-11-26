// ─────────────────────────────────────────────────────────────
// 맵 1: 편의점 (정면 뷰, 1080x1920 맵 좌표)
//   천장 조명 / 냉장고 유리문(음료) / 벽 진열대(상품 박스) / 행사 매대(과자) / 바닥 타일
// detail(1~5)이 오를수록 상품이 작아지고 무늬(줄/점)가 많아집니다.
// ─────────────────────────────────────────────────────────────
import { box, rrPath, text, type Ctx } from '../draw';
import { C, OUTLINE } from '../theme';
import { pick, range, type Rng } from '../../game/rng';

const PRODUCT = [C.pink, C.mint, C.yellow, C.sky, C.lavender, C.peach, C.coral, C.green, '#ffd1e8', '#b8f0e0'];
const DRINK = ['#ff9eb5', '#8fd8ff', '#ffe066', '#9ff0b0', '#ffb07a', '#d4b8ff', '#ff7a7a', '#7fe0d0'];

export function drawStore(ctx: Ctx, detail: number, rng: Rng) {
  // ── 벽 ──
  ctx.fillStyle = '#fff1dc';
  ctx.fillRect(0, 0, 1080, 1920);
  // 벽지 세로 줄무늬
  ctx.fillStyle = '#ffe6c4';
  const wallStripe = detail >= 3 ? 30 : 60;
  for (let x = 0; x < 1080; x += wallStripe * 2) ctx.fillRect(x, 140, wallStripe, 1020);

  drawCeiling(ctx);
  drawFloor(ctx, detail);
  drawFridge(ctx, 24, 200, 516, 900, detail, rng);
  drawWallShelf(ctx, 560, 200, 496, 900, detail, rng);
  drawGondola(ctx, 40, 1260, 1000, 460, detail, rng);
}

function drawCeiling(ctx: Ctx) {
  ctx.fillStyle = '#e9e2f7';
  ctx.fillRect(0, 0, 1080, 140);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(0, 136, 1080, 8);
  // 형광등 패널
  for (let i = 0; i < 3; i++) {
    box(ctx, 70 + i * 340, 34, 260, 56, 18, '#fffbe0');
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(90 + i * 340, 56, 220, 12);
  }
}

function drawFloor(ctx: Ctx, detail: number) {
  const top = 1160;
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(0, top - 4, 1080, 8);
  const t = 120;
  for (let y = top + 4, row = 0; y < 1920; y += t, row++) {
    for (let x = 0, col = 0; x < 1080; x += t, col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#f3e8ff' : '#dff5ec';
      ctx.fillRect(x, y, t, t);
      if (detail >= 2 && (row + col) % 2 === 0) {
        // 작은 마름모 장식
        ctx.fillStyle = '#e4d4fb';
        ctx.beginPath();
        ctx.moveTo(x + t / 2, y + 30);
        ctx.lineTo(x + t - 30, y + t / 2);
        ctx.lineTo(x + t / 2, y + t - 30);
        ctx.lineTo(x + 30, y + t / 2);
        ctx.fill();
      }
    }
  }
  // 줄눈
  ctx.strokeStyle = '#cbbfe0';
  ctx.lineWidth = 3;
  for (let x = 0; x <= 1080; x += t) {
    ctx.beginPath(); ctx.moveTo(x, top + 4); ctx.lineTo(x, 1920); ctx.stroke();
  }
  for (let y = top + 4; y <= 1920; y += t) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke();
  }
}

/** 냉장고: 유리문 3칸, 안에 음료 */
function drawFridge(ctx: Ctx, x: number, y: number, w: number, h: number, detail: number, rng: Rng) {
  box(ctx, x, y, w, h, 20, '#dbe6f3');
  // 상단 간판
  box(ctx, x + 20, y + 16, w - 40, 64, 14, C.sky);
  text(ctx, '시원한 음료', x + w / 2, y + 49, { size: 38, color: OUTLINE });

  const doors = 3;
  const gap = 14;
  const dw = (w - 40 - gap * (doors - 1)) / doors;
  const dy = y + 100;
  const dh = h - 120;
  for (let d = 0; d < doors; d++) {
    const dx = x + 20 + d * (dw + gap);
    box(ctx, dx, dy, dw, dh, 12, '#c9eef6');
    ctx.save();
    rrPath(ctx, dx + 3, dy + 3, dw - 6, dh - 6, 10);
    ctx.clip();
    // 선반 4~5단
    const shelves = detail >= 4 ? 5 : 4;
    const sh = dh / shelves;
    for (let s = 0; s < shelves; s++) {
      const sy = dy + s * sh;
      const floorY = sy + sh - 14;
      let bx = dx + 10;
      while (bx < dx + dw - 20) {
        const bw = range(rng, 22, 34) * (detail >= 3 ? 0.85 : 1);
        const bh = range(rng, sh * 0.5, sh * 0.78);
        const col = pick(rng, DRINK);
        // 병 몸통 + 뚜껑
        box(ctx, bx, floorY - bh, bw, bh, 8, col, OUTLINE, 3);
        box(ctx, bx + bw * 0.25, floorY - bh - 12, bw * 0.5, 14, 4, C.white, OUTLINE, 3);
        // 라벨
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(bx + 3, floorY - bh * 0.6, bw - 6, bh * 0.22);
        if (detail >= 2 && rng() < 0.5) {
          ctx.fillStyle = pick(rng, DRINK);
          ctx.fillRect(bx + 3, floorY - bh * 0.53, bw - 6, bh * 0.08);
        }
        bx += bw + range(rng, 4, 10);
      }
      // 선반 판
      ctx.fillStyle = '#9fb6cf';
      ctx.fillRect(dx, floorY, dw, 10);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(dx, floorY + 10, dw, 3);
    }
    // 유리 반사광 (대각선 띠)
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    for (let k = 0; k < 2; k++) {
      const ox = dx + 20 + k * 60;
      ctx.beginPath();
      ctx.moveTo(ox, dy);
      ctx.lineTo(ox + 34 - k * 14, dy);
      ctx.lineTo(ox - 120 + 34 - k * 14, dy + dh);
      ctx.lineTo(ox - 120, dy + dh);
      ctx.fill();
    }
    ctx.restore();
    // 손잡이
    box(ctx, dx + dw - 22, dy + dh * 0.35, 12, dh * 0.3, 6, '#eef3f8', OUTLINE, 4);
  }
}

/** 벽 진열대: 상품 박스 4단 + 노란 가격표 선반 */
function drawWallShelf(ctx: Ctx, x: number, y: number, w: number, h: number, detail: number, rng: Rng) {
  box(ctx, x, y, w, h, 16, '#f7d9b8');
  const rows = 4;
  const rh = (h - 30) / rows;
  for (let r = 0; r < rows; r++) {
    const ry = y + 16 + r * rh;
    const floorY = ry + rh - 30;
    // 뒷판
    ctx.fillStyle = r % 2 === 0 ? '#fde7cf' : '#fbe0c2';
    ctx.fillRect(x + 12, ry, w - 24, rh - 30);
    let bx = x + 20;
    const sizeK = detail >= 3 ? 0.75 : 1;
    while (bx < x + w - 40) {
      const bw = Math.min(range(rng, 56, 100) * sizeK, x + w - 20 - bx);
      if (bw < 24) break;
      const bh = range(rng, rh * 0.45, rh * 0.8);
      const col = pick(rng, PRODUCT);
      box(ctx, bx, floorY - bh, bw, bh, 8, col, OUTLINE, 4);
      productPattern(ctx, bx, floorY - bh, bw, bh, detail, rng);
      bx += bw + range(rng, 4, 12);
    }
    // 선반 판 (노란 가격표 줄)
    ctx.fillStyle = C.yellow;
    ctx.fillRect(x + 6, floorY, w - 12, 26);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 6, floorY, w - 12, 4);
    ctx.fillRect(x + 6, floorY + 24, w - 12, 4);
    for (let tx = x + 30; tx < x + w - 60; tx += 110) {
      ctx.fillStyle = C.white;
      ctx.fillRect(tx, floorY + 6, 54, 16);
      ctx.fillStyle = C.coral;
      ctx.fillRect(tx + 6, floorY + 11, 26, 6);
    }
  }
}

/** 상품 포장 무늬 */
function productPattern(ctx: Ctx, x: number, y: number, w: number, h: number, detail: number, rng: Rng) {
  ctx.save();
  rrPath(ctx, x + 2, y + 2, w - 4, h - 4, 6);
  ctx.clip();
  const kind = Math.floor(rng() * (detail >= 2 ? 4 : 2));
  const accent = pick(rng, PRODUCT);
  if (kind === 0) {
    // 가운데 라벨 띠
    ctx.fillStyle = C.white;
    ctx.fillRect(x, y + h * 0.35, w, h * 0.25);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.475, Math.min(w, h) * 0.12, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 1) {
    // 위쪽 색 블록
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, w, h * 0.3);
  } else if (kind === 2) {
    // 가로 줄무늬
    ctx.fillStyle = accent;
    const st = detail >= 4 ? 10 : 16;
    for (let yy = y; yy < y + h; yy += st * 2) ctx.fillRect(x, yy, w, st);
  } else {
    // 물방울 무늬
    ctx.fillStyle = accent;
    const st = detail >= 4 ? 16 : 24;
    for (let yy = y + 8; yy < y + h; yy += st)
      for (let xx = x + 8 + ((yy / st) % 2) * (st / 2); xx < x + w; xx += st) {
        ctx.beginPath();
        ctx.arc(xx, yy, st * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  ctx.restore();
}

/** 가운데 행사 매대 (1+1 간판, 과자 봉지 2단) */
function drawGondola(ctx: Ctx, x: number, y: number, w: number, h: number, detail: number, rng: Rng) {
  box(ctx, x, y, w, h, 18, '#ffd6e0');
  // 행사 간판
  box(ctx, x + w / 2 - 190, y - 70, 380, 90, 22, C.coral);
  text(ctx, '1+1 행사중!', x + w / 2, y - 25, { size: 50, color: C.white, stroke: OUTLINE, strokeW: 8 });

  const rows = 2;
  const rh = (h - 60) / rows;
  for (let r = 0; r < rows; r++) {
    const ry = y + 24 + r * rh;
    const floorY = ry + rh - 26;
    let bx = x + 22;
    while (bx < x + w - 60) {
      const bw = range(rng, 70, 110) * (detail >= 3 ? 0.8 : 1);
      if (bx + bw > x + w - 20) break;
      const bh = range(rng, rh * 0.55, rh * 0.85);
      snackBag(ctx, bx, floorY - bh, bw, bh, pick(rng, PRODUCT), pick(rng, PRODUCT), detail, rng);
      bx += bw + range(rng, 6, 14);
    }
    // 빨강/흰 가격 띠
    const sy = floorY;
    ctx.fillStyle = C.white;
    ctx.fillRect(x + 8, sy, w - 16, 24);
    ctx.fillStyle = C.coral;
    for (let sx = x + 8; sx < x + w - 16; sx += 48) ctx.fillRect(sx, sy, 24, 24);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 8, sy, w - 16, 4);
    ctx.fillRect(x + 8, sy + 22, w - 16, 4);
  }
  // 하단 걸레받이
  box(ctx, x + 10, y + h - 40, w - 20, 30, 8, '#e7b3c4', OUTLINE, 4);
}

/** 과자 봉지: 위아래가 톱니 모양 */
function snackBag(
  ctx: Ctx, x: number, y: number, w: number, h: number,
  col: string, accent: string, detail: number, rng: Rng,
) {
  const teeth = 6;
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  for (let i = 0; i <= teeth; i++) ctx.lineTo(x + (w * i) / teeth, y + (i % 2 === 0 ? 8 : 0));
  ctx.quadraticCurveTo(x + w + 6, y + h / 2, x + w, y + h - 8);
  for (let i = teeth; i >= 0; i--) ctx.lineTo(x + (w * i) / teeth, y + h - (i % 2 === 0 ? 8 : 0));
  ctx.quadraticCurveTo(x - 6, y + h / 2, x, y + 8);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // 가운데 동그란 로고
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.45, w * 0.32, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.45, w * 0.18, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  if (detail >= 2 && rng() < 0.6) {
    ctx.fillStyle = accent;
    ctx.fillRect(x + 6, y + h * 0.75, w - 12, h * 0.08);
  }
}
