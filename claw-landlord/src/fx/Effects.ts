// =====================================================================
//  화면 연출 — 파티클, 떠오르는 글자, 배너, 화면 흔들림
//  좌표는 모두 기계 내부 좌표 기준
// =====================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: 'coin' | 'confetti' | 'puff' | 'star';
  rot: number;
  vr: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

interface Banner {
  text: string;
  sub: string;
  color: string;
  life: number;
  max: number;
}

const MAX_PARTICLES = 220; // 성능 보호: 파티클 상한

export class Effects {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  banner: Banner | null = null;
  private shakeAmp = 0;
  private shakeT = 0;

  shake(amount: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  /** 현재 흔들림 오프셋 */
  shakeOffset(): { x: number; y: number } {
    if (this.shakeAmp < 0.1) return { x: 0, y: 0 };
    return {
      x: Math.sin(this.shakeT * 61) * this.shakeAmp,
      y: Math.cos(this.shakeT * 47) * this.shakeAmp * 0.7,
    };
  }

  floatText(x: number, y: number, text: string, color = '#ffe14d', size = 22): void {
    this.texts.push({ x, y, text, color, size, life: 1.2, max: 1.2 });
  }

  showBanner(text: string, sub = '', color = '#ffffff', time = 1.5): void {
    this.banner = { text, sub, color, life: time, max: time };
  }

  coins(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.add({
        x, y,
        vx: (Math.random() - 0.5) * 160,
        vy: -120 - Math.random() * 200,
        life: 1, max: 1, color: '#ffd23f', size: 6 + Math.random() * 3, kind: 'coin', rot: 0, vr: 0,
      });
    }
  }

  confetti(x: number, y: number, n: number): void {
    const colors = ['#ff5d8f', '#ffd23f', '#5ce1e6', '#9b7bff', '#7ee081'];
    for (let i = 0; i < n; i++) {
      this.add({
        x, y,
        vx: (Math.random() - 0.5) * 300,
        vy: -150 - Math.random() * 250,
        life: 1.4, max: 1.4, color: colors[i % colors.length], size: 4 + Math.random() * 3,
        kind: 'confetti', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
      });
    }
  }

  puff(x: number, y: number, n = 8): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({
        x, y,
        vx: Math.cos(a) * 60, vy: Math.sin(a) * 40 - 20,
        life: 0.5, max: 0.5, color: 'rgba(255,255,255,0.8)', size: 5 + Math.random() * 5, kind: 'puff', rot: 0, vr: 0,
      });
    }
  }

  stars(x: number, y: number, n = 5): void {
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40,
        life: 0.7, max: 0.7, color: '#fff7a8', size: 4 + Math.random() * 3, kind: 'star', rot: 0, vr: 3,
      });
    }
  }

  private add(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(p);
  }

  update(dt: number): void {
    this.shakeT += dt;
    this.shakeAmp *= Math.pow(0.0015, dt); // 빠르게 감쇠
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'puff' ? 0 : 520) * dt;
      p.vx *= p.kind === 'confetti' ? 0.985 : 0.995;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 38 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D, viewW: number): void {
    for (const p of this.particles) {
      const a = Math.min(1, p.life / (p.max * 0.4));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 'coin') {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * Math.abs(Math.cos(p.life * 9)) + 1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c99400';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.kind === 'star') {
        drawStar(ctx, p.x, p.y, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.4 - p.life / p.max * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.max;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      const pop = 1 + Math.max(0, (k - 0.85) * 3);
      ctx.font = `900 ${t.size * pop}px "Pretendard", "Apple SD Gothic Neo", sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(40,20,50,0.85)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    if (this.banner) {
      const b = this.banner;
      const age = b.max - b.life;
      const inK = Math.min(1, age / 0.18);
      const outK = Math.min(1, b.life / 0.3);
      const scale = 0.6 + 0.4 * easeOutBack(inK);
      ctx.save();
      ctx.globalAlpha = outK;
      ctx.translate(viewW / 2, 130);
      ctx.scale(scale, scale);
      ctx.font = '900 30px "Pretendard", "Apple SD Gothic Neo", sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(40,20,50,0.9)';
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      if (b.sub) {
        ctx.font = '700 16px "Pretendard", "Apple SD Gothic Neo", sans-serif';
        ctx.lineWidth = 5;
        ctx.strokeText(b.sub, 0, 30);
        ctx.fillStyle = '#fff';
        ctx.fillText(b.sub, 0, 30);
      }
      ctx.restore();
    }
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * 0.35;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
