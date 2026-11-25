/**
 * 모바일: 화면 왼쪽 절반 = 가상 조이스틱(터치한 곳이 중심), 오른쪽 절반 = 드래그 시점 회전.
 * PC: WASD/방향키 이동, 마우스(클릭 시 포인터 잠금, 또는 드래그) 시점 회전.
 */
export class Input {
  moveX = 0;
  moveY = 0; // +1 = 앞으로
  lookDX = 0;
  lookDY = 0;
  enabled = false;
  private keys = new Set<string>();
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private mouseDown = false;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private readonly radius = 56;

  constructor(el: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'joy-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob);
    document.body.appendChild(this.base);

    el.addEventListener('touchstart', this.onTouchStart, { passive: false });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd);
    el.addEventListener('touchcancel', this.onTouchEnd);
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.mouseDown = true;
      this.lookLast = { x: e.clientX, y: e.clientY };
      if (e.button === 0 && !document.pointerLockElement && el.requestPointerLock && !('ontouchstart' in window)) {
        try {
          const r = el.requestPointerLock() as unknown as Promise<void> | undefined;
          r?.catch?.(() => undefined);
        } catch {
          /* 무시 */
        }
      }
    });
    window.addEventListener('mouseup', () => (this.mouseDown = false));
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === el) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      } else if (this.mouseDown) {
        this.lookDX += e.clientX - this.lookLast.x;
        this.lookDY += e.clientY - this.lookLast.y;
        this.lookLast = { x: e.clientX, y: e.clientY };
      }
    });
  }

  private onTouchStart = (e: TouchEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX < window.innerWidth / 2 && this.joyId === null) {
        this.joyId = t.identifier;
        this.joyOrigin = { x: t.clientX, y: t.clientY };
        this.joyVec = { x: 0, y: 0 };
        this.base.style.left = `${t.clientX}px`;
        this.base.style.top = `${t.clientY}px`;
        this.base.classList.add('on');
        this.knob.style.transform = 'translate(-50%,-50%)';
      } else if (this.lookId === null) {
        this.lookId = t.identifier;
        this.lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.joyId) {
        let dx = t.clientX - this.joyOrigin.x;
        let dy = t.clientY - this.joyOrigin.y;
        const d = Math.hypot(dx, dy);
        if (d > this.radius) {
          dx = (dx / d) * this.radius;
          dy = (dy / d) * this.radius;
        }
        this.joyVec = { x: dx / this.radius, y: -dy / this.radius };
        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      } else if (t.identifier === this.lookId) {
        this.lookDX += t.clientX - this.lookLast.x;
        this.lookDY += t.clientY - this.lookLast.y;
        this.lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.joyId) {
        this.joyId = null;
        this.joyVec = { x: 0, y: 0 };
        this.base.classList.remove('on');
      } else if (t.identifier === this.lookId) {
        this.lookId = null;
      }
    }
  };

  /** 프레임마다 호출: 이동 벡터 갱신 */
  poll() {
    let x = this.joyVec.x;
    let y = this.joyVec.y;
    if (this.enabled) {
      const k = this.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    }
    const d = Math.hypot(x, y);
    if (d > 1) {
      x /= d;
      y /= d;
    }
    // 조이스틱 데드존
    if (d < 0.12) {
      x = 0;
      y = 0;
    }
    this.moveX = x;
    this.moveY = y;
  }

  consumeLook() {
    const r = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return r;
  }

  reset() {
    this.joyId = null;
    this.lookId = null;
    this.joyVec = { x: 0, y: 0 };
    this.base.classList.remove('on');
    this.keys.clear();
    this.lookDX = this.lookDY = 0;
  }

  releasePointer() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
