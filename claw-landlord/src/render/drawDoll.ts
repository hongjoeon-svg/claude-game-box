// =====================================================================
//  인형 그리기 — 이미지가 없으면 도형으로 그린 플레이스홀더
// =====================================================================
import { getSprite } from '../assets';
import type { DollDef } from '../data/dolls';

/** 인형 하나를 (0,0) 중심, 회전 적용된 상태의 ctx 에 그립니다 */
export function drawDoll(ctx: CanvasRenderingContext2D, def: DollDef, blink = false): void {
  const s = def.size;
  const hh = def.shape === 'box' ? s * (def.aspect ?? 1) : s;

  const img = getSprite(def.id);
  if (img) {
    const big = Math.max(s, hh);
    ctx.drawImage(img, -big, -big, big * 2, big * 2);
    return;
  }

  const outline = shade(def.color, -0.35);
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline;

  // ---- 귀/머리 장식 (몸통 뒤) ----
  ctx.fillStyle = def.color;
  const top = -hh;
  switch (def.ears) {
    case 'round':
      for (const sx of [-1, 1]) {
        circle(ctx, sx * s * 0.62, top + s * 0.18, s * 0.34);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = def.accent;
        circle(ctx, sx * s * 0.62, top + s * 0.18, s * 0.17);
        ctx.fill();
        ctx.fillStyle = def.color;
      }
      break;
    case 'long':
      for (const sx of [-1, 1]) {
        ctx.save();
        ctx.translate(sx * s * 0.38, top + s * 0.1);
        ctx.rotate(sx * 0.22);
        ellipse(ctx, 0, -s * 0.55, s * 0.2, s * 0.62);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = def.accent;
        ellipse(ctx, 0, -s * 0.5, s * 0.09, s * 0.42);
        ctx.fill();
        ctx.fillStyle = def.color;
        ctx.restore();
      }
      break;
    case 'pointy':
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * s * 0.85, top + s * 0.35);
        ctx.lineTo(sx * s * 0.62, top - s * 0.38);
        ctx.lineTo(sx * s * 0.2, top + s * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    case 'leaf': // 만두 주름
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, top + s * 0.25);
      ctx.quadraticCurveTo(0, top - s * 0.45, s * 0.35, top + s * 0.25);
      ctx.fill();
      ctx.stroke();
      break;
    case 'antenna':
      ctx.strokeStyle = outline;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * s * 0.25, top + s * 0.2);
        ctx.lineTo(sx * s * 0.45, top - s * 0.45);
        ctx.stroke();
        ctx.fillStyle = def.accent;
        circle(ctx, sx * s * 0.45, top - s * 0.45, s * 0.12);
        ctx.fill();
      }
      ctx.fillStyle = def.color;
      break;
    case 'none':
      break;
  }

  // ---- 몸통 ----
  ctx.fillStyle = def.color;
  if (def.shape === 'circle') {
    circle(ctx, 0, 0, s);
  } else {
    roundRect(ctx, -s, -hh, s * 2, hh * 2, Math.min(s, hh) * 0.55);
  }
  ctx.fill();
  ctx.stroke();

  // 개별 특징
  if (def.id === 'waddle_peng') {
    ctx.fillStyle = def.accent;
    ellipse(ctx, 0, hh * 0.25, s * 0.62, hh * 0.62);
    ctx.fill();
    ctx.fillStyle = '#f6b13c';
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -hh * 0.12);
    ctx.lineTo(s * 0.16, -hh * 0.12);
    ctx.lineTo(0, hh * 0.05);
    ctx.fill();
  }
  if (def.id === 'snail_post') {
    ctx.fillStyle = def.accent;
    circle(ctx, s * 0.42, s * 0.1, s * 0.5);
    ctx.fill();
    ctx.strokeStyle = shade(def.accent, -0.35);
    ctx.beginPath();
    ctx.arc(s * 0.42, s * 0.1, s * 0.25, 0, Math.PI * 1.6);
    ctx.stroke();
  }
  if (def.id === 'loaf_cat') {
    ctx.fillStyle = def.accent;
    roundRect(ctx, -s * 0.7, hh * 0.2, s * 1.4, hh * 0.65, hh * 0.3);
    ctx.fill();
  }

  // ---- 얼굴 ----
  const faceX = def.id === 'snail_post' ? -s * 0.3 : 0;
  const faceY = def.id === 'waddle_peng' ? -hh * 0.3 : -hh * 0.05;
  const eyeGap = s * 0.32;
  ctx.fillStyle = '#2b2233';
  ctx.strokeStyle = '#2b2233';
  ctx.lineWidth = 1.8;
  const sleepy = def.id === 'sleepy_bunny' || blink;
  for (const sx of [-1, 1]) {
    const ex = faceX + sx * eyeGap;
    if (sleepy) {
      ctx.beginPath();
      ctx.arc(ex, faceY, s * 0.09, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else if (def.id === 'gaegul') {
      ctx.fillStyle = '#fff';
      circle(ctx, ex, faceY - s * 0.38, s * 0.2);
      ctx.fill();
      ctx.fillStyle = '#2b2233';
      circle(ctx, ex, faceY - s * 0.36, s * 0.09);
      ctx.fill();
    } else {
      circle(ctx, ex, faceY, s * 0.085);
      ctx.fill();
    }
  }
  // 볼터치
  ctx.fillStyle = 'rgba(255, 120, 150, 0.45)';
  for (const sx of [-1, 1]) {
    ellipse(ctx, faceX + sx * s * 0.55, faceY + s * 0.2, s * 0.14, s * 0.08);
    ctx.fill();
  }
  // 입
  ctx.strokeStyle = '#2b2233';
  ctx.beginPath();
  if (def.id === 'gaegul') {
    ctx.arc(faceX, faceY + s * 0.05, s * 0.35, 0.15 * Math.PI, 0.85 * Math.PI);
  } else {
    ctx.arc(faceX - s * 0.07, faceY + s * 0.14, s * 0.07, 0, Math.PI);
    ctx.arc(faceX + s * 0.07, faceY + s * 0.14, s * 0.07, 0, Math.PI);
  }
  ctx.stroke();
}

// ---- 그리기 도우미 ----
export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}
export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 색을 밝게(+)/어둡게(-) */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  r = f(r);
  g = f(g);
  b = f(b);
  return `rgb(${r},${g},${b})`;
}
