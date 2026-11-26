// 캔버스에 그리는 버튼 (터치 다운 → 눌림 표시, 업 → 클릭)
import { box, text, type Ctx } from '../render/draw';
import { C, OUTLINE } from '../render/theme';

export interface Pt { x: number; y: number }

export interface ButtonOpts {
  fill?: string;
  color?: string;
  size?: number;
  radius?: number;
  /** 커스텀 그리기 (아이콘 등). 지정하면 label 대신 사용 */
  drawContent?: (ctx: Ctx, b: Button) => void;
}

export class Button {
  pressed = false;
  enabled = true;
  visible = true;
  selected = false;

  constructor(
    public x: number, public y: number, public w: number, public h: number,
    public label: string, public onClick: () => void, public opts: ButtonOpts = {},
  ) {}

  contains(p: Pt) {
    return p.x >= this.x && p.x <= this.x + this.w && p.y >= this.y && p.y <= this.y + this.h;
  }

  draw(ctx: Ctx) {
    if (!this.visible) return;
    const down = this.pressed ? 6 : 0;
    const r = this.opts.radius ?? 28;
    ctx.save();
    if (!this.enabled) ctx.globalAlpha = 0.45;
    // 그림자 (눌리면 사라짐)
    if (!this.pressed) box(ctx, this.x, this.y + 8, this.w, this.h, r, OUTLINE, null);
    const fill = this.selected ? C.yellow : (this.opts.fill ?? C.white);
    box(ctx, this.x, this.y + down, this.w, this.h, r, fill);
    if (this.opts.drawContent) {
      ctx.translate(0, down);
      this.opts.drawContent(ctx, this);
    } else {
      text(ctx, this.label, this.x + this.w / 2, this.y + this.h / 2 + down + 2, {
        size: this.opts.size ?? 44, color: this.opts.color ?? OUTLINE,
      });
    }
    ctx.restore();
  }
}

/** 여러 버튼의 입력 처리를 묶음 */
export class ButtonGroup {
  list: Button[] = [];

  add<T extends Button>(b: T): T { this.list.push(b); return b; }

  /** 버튼 위에서 눌렸으면 true (게임 입력으로 넘기지 않음) */
  down(p: Pt): boolean {
    for (const b of this.list) {
      if (b.visible && b.enabled && b.contains(p)) { b.pressed = true; return true; }
    }
    return false;
  }

  move(p: Pt) {
    for (const b of this.list) if (b.pressed && !b.contains(p)) b.pressed = false;
  }

  up(p: Pt): boolean {
    let hit = false;
    for (const b of this.list) {
      if (b.pressed) {
        b.pressed = false;
        if (b.contains(p)) { hit = true; b.onClick(); }
      }
    }
    return hit;
  }

  draw(ctx: Ctx) { for (const b of this.list) b.draw(ctx); }
}
