// 상단 HUD (스테이지 이름 / 단계 / 타이머)
import { box, text, type Ctx } from '../render/draw';
import { C, FONT, OUTLINE } from '../render/theme';

export const HUD_H = 160;

export function drawHud(ctx: Ctx, stageLabel: string, phaseLabel: string, timeLeft: number, total: number) {
  ctx.fillStyle = 'rgba(255,246,232,0.94)';
  ctx.fillRect(0, 0, 1080, HUD_H);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(0, HUD_H - 6, 1080, 6);

  text(ctx, stageLabel, 36, 52, { size: 34, align: 'left', weight: 700 });
  box(ctx, 36, 84, 230, 56, 28, C.lavender, OUTLINE, 5);
  text(ctx, phaseLabel, 151, 113, { size: 34 });

  // 타이머: 남은 시간 링 + 숫자
  const cx = 980, cy = 80, r = 58;
  const frac = Math.max(0, timeLeft / total);
  const danger = timeLeft <= 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r - 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  ctx.closePath();
  ctx.fillStyle = danger ? C.coral : C.mint;
  ctx.fill();
  const pulse = danger ? 1 + 0.08 * Math.sin(performance.now() / 80) : 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  text(ctx, String(Math.ceil(timeLeft)), 0, 4, { size: 54, color: OUTLINE, stroke: C.white, strokeW: 10 });
  ctx.restore();
}

/** 화면 중앙 상단 말풍선 안내 */
export function drawHint(ctx: Ctx, msg: string, y: number) {
  ctx.font = `800 36px ${FONT}`;
  const w = Math.min(1000, ctx.measureText(msg).width + 90);
  box(ctx, 540 - w / 2, y, w, 76, 38, C.white, OUTLINE, 5);
  text(ctx, msg, 540, y + 40, { size: 36 });
}
