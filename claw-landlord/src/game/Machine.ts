// =====================================================================
//  인형뽑기 기계 한 대 — 물리 세계(Matter.js) + 집게 상태 기계
//  3단계에서 기계가 여러 대가 되면 이 클래스를 여러 개 만들면 됩니다.
//  (렌더링/소리는 여기서 하지 않고, 이벤트만 바깥으로 알립니다)
// =====================================================================
import Matter from 'matter-js';
import { CONFIG } from '../config';
import { DollDef, pickDollDef } from '../data/dolls';

const { Engine, Bodies, Body, Composite, Constraint, Query } = Matter;

// Matter 0.20 은 updateVelocity 인자를 지원하지만 타입 정의가 뒤처져 있어서 따로 선언
const setPos = Body.setPosition as (b: Matter.Body, p: Matter.Vector, updateVelocity?: boolean) => void;
const setAng = Body.setAngle as (b: Matter.Body, a: number, updateVelocity?: boolean) => void;

/** 충돌 분류 비트 */
const CAT = { WALL: 0x1, DOLL: 0x2, CLAW: 0x4, HELD: 0x8 };

const STEP = 1 / 60; // 물리 고정 스텝 (초)

export interface Doll {
  uid: number;
  def: DollDef;
  body: Matter.Body;
  radius: number; // 대략적인 크기 (상자면 긴 쪽 절반)
  state: 'free' | 'held' | 'falling';
  releasedByClaw: boolean; // 집게가 배출구 위에서 놓아 준 인형인지
}

export type ClawState =
  | 'idle' // 플레이어 조작 대기
  | 'descend' // 내려가는 중
  | 'pause' // 닿고 멈칫
  | 'close' // 오므리는 중
  | 'lift' // 들어 올리는 중
  | 'top' // 꼭대기에서 덜컹
  | 'carry' // 배출구로 이동
  | 'release' // 벌려서 떨어뜨림
  | 'reset'; // 정리 후 대기로

/** 놓치는 시점 */
type DropPhase = 'liftStart' | 'top' | 'carry';

/** 바깥(main)으로 보내는 이벤트 */
export type MachineEvent =
  | { type: 'descend' }
  | { type: 'touch' }
  | { type: 'close' }
  | { type: 'grab'; doll: Doll; quality: number; holdChance: number }
  | { type: 'empty' } // 아무것도 못 잡음
  | { type: 'wobble'; doll: Doll; fake: boolean }
  | { type: 'saved'; doll: Doll } // 흔들렸지만 버텨냄
  | { type: 'slip'; doll: Doll; phase: DropPhase; x: number; y: number }
  | { type: 'topStop' }
  | { type: 'release'; doll: Doll | null }
  | { type: 'collected'; doll: Doll; x: number; y: number; bonus: boolean }
  | { type: 'idle' };

/** 마지막 잡기 판정 (디버그 표시용) */
export interface GrabInfo {
  quality: number;
  holdChance: number;
  willHold: boolean;
  dropPhase: DropPhase | null;
}

interface ProngState {
  side: -1 | 1; // -1 왼쪽, +1 오른쪽
  angle: number; // 바깥쪽이 + 인 벌림 각도
  arm: Matter.Body;
  tip: Matter.Body;
  blockedAt: number | null; // 인형에 닿아 멈춘 각도
  touched: Set<number>; // 오므리는 동안 닿은 인형 uid
}

export class Machine {
  readonly engine: Matter.Engine;
  readonly world: Matter.World;
  readonly dolls: Doll[] = [];
  onEvent: (e: MachineEvent) => void = () => {};

  // ---- 집게 상태 ----
  state: ClawState = 'idle';
  /** 레버 입력 (-1 ~ 1) */
  moveInput = 0;
  trolleyX: number;
  private trolleyV = 0;
  sway = 0; // 집게가 대차보다 얼마나 처져서 흔들리는지 (px)
  private swayV = 0;
  cableLen: number; // 레일에서 집게 몸통 중심까지 줄 길이
  readonly head: Matter.Body;
  readonly prongs: ProngState[];
  private clawBodies: Matter.Body[];

  private stateTime = 0;
  private contactCable: number | null = null;
  private held: Doll | null = null;
  private holdConstraint: Matter.Constraint | null = null;
  private holdBaseA = { x: 0, y: 0 };
  private willHold = true;
  private dropPhase: DropPhase | null = null;
  private dropTimer = 0; // 해당 단계에서 놓치기까지 남은 시간
  private fakeWobblePhase: DropPhase | null = null;
  private fakeWobbleTimer = 0;
  private wobbleT = 0; // 흔들림 진행 시간 (0 이면 안 흔들림)
  private wobbleFake = false;
  private uidSeq = 1;
  private refillTimer = 0;
  private time = 0;

  lastGrab: GrabInfo | null = null;

  // 자주 쓰는 치수
  readonly W = CONFIG.machine.width;
  readonly H = CONFIG.machine.height;
  readonly partitionX: number; // 배출구 칸막이 오른쪽 끝
  readonly homeX: number; // 집게 대기 위치 (배출구 위)
  readonly minX: number;
  readonly maxX: number;
  readonly minCable: number;

  constructor() {
    const m = CONFIG.machine;
    const c = CONFIG.claw;
    this.engine = Engine.create({
      gravity: { x: 0, y: CONFIG.physics.gravity },
      positionIterations: CONFIG.physics.positionIterations,
      velocityIterations: CONFIG.physics.velocityIterations,
    });
    this.world = this.engine.world;

    // ---- 벽, 바닥, 배출구 ----
    const w = m.wall;
    const wallOpts = (): Matter.IChamferableBodyDefinition => ({
      isStatic: true,
      friction: 0.6,
      collisionFilter: { category: CAT.WALL, mask: CAT.DOLL | CAT.HELD },
    });
    this.partitionX = w + m.chuteWidth + 10;
    const floorTop = m.floorY;
    const walls = [
      // 왼쪽·오른쪽 벽 (배출구 아래까지 길게)
      Bodies.rectangle(w / 2, this.H / 2, w, this.H + 200, wallOpts()),
      Bodies.rectangle(this.W - w / 2, this.H / 2, w, this.H + 200, wallOpts()),
      // 천장 (튕겨 나가지 않게)
      Bodies.rectangle(this.W / 2, -20, this.W, 40, wallOpts()),
      // 바닥 (칸막이 오른쪽만 — 배출구 쪽은 뻥 뚫림)
      Bodies.rectangle((this.partitionX + this.W) / 2, floorTop + 30, this.W - this.partitionX, 60, wallOpts()),
      // 배출구 칸막이 (윗부분 둥글게)
      Bodies.rectangle(
        this.partitionX - 5,
        floorTop - m.chuteWallHeight / 2 + 60,
        10,
        m.chuteWallHeight + 120,
        { ...wallOpts(), chamfer: { radius: [5, 5, 0, 0] } },
      ),
    ];
    Composite.add(this.world, walls);

    // ---- 집게 ----
    this.homeX = w + m.chuteWidth / 2 + 4;
    const reach = c.pivotOffset + c.armLength * Math.sin(c.openAngle);
    this.minX = Math.min(this.homeX, w + reach + 2);
    this.maxX = this.W - w - reach - 2;
    this.trolleyX = this.homeX;
    this.minCable = c.headHeight / 2 + 26;
    this.cableLen = this.minCable;

    const clawFilter = { category: CAT.CLAW, mask: CAT.DOLL };
    this.head = Bodies.rectangle(this.trolleyX, this.headY, c.headWidth, c.headHeight, {
      isStatic: true,
      friction: 0.8,
      chamfer: { radius: 6 },
      collisionFilter: clawFilter,
    });
    const restAngle = 0.12;
    this.prongs = ([-1, 1] as const).map((side) => ({
      side,
      angle: restAngle,
      arm: Bodies.rectangle(0, 0, c.armThickness, c.armLength, {
        isStatic: true,
        friction: 0.9,
        collisionFilter: clawFilter,
      }),
      tip: Bodies.rectangle(0, 0, c.armThickness, c.tipLength, {
        isStatic: true,
        friction: 0.9,
        collisionFilter: clawFilter,
      }),
      blockedAt: null,
      touched: new Set<number>(),
    }));
    this.clawBodies = [this.head, ...this.prongs.flatMap((p) => [p.arm, p.tip])];
    Composite.add(this.world, this.clawBodies);
    this.syncClawBodies(false);

    // ---- 처음 인형 채우기 → 미리 굴려서 자리 잡게 ----
    this.fillInitial();
  }

  // -------------------------------------------------------------------
  //  좌표 도우미
  // -------------------------------------------------------------------
  get headX(): number {
    return this.trolleyX + this.sway;
  }
  get headY(): number {
    return CONFIG.machine.railY + this.cableLen;
  }

  /** 집게발 하나의 축·팔꿈치·끝 좌표 (렌더러도 사용) */
  prongGeometry(p: ProngState, headX = this.headX, headY = this.headY) {
    const c = CONFIG.claw;
    const pivot = { x: headX + p.side * c.pivotOffset, y: headY + c.headHeight / 2 - 2 };
    const phiArm = p.side * p.angle; // +y 축에서 +x 쪽으로 기운 각도
    const elbow = {
      x: pivot.x + Math.sin(phiArm) * c.armLength,
      y: pivot.y + Math.cos(phiArm) * c.armLength,
    };
    const phiTip = p.side * (p.angle - c.tipAngle);
    const end = {
      x: elbow.x + Math.sin(phiTip) * c.tipLength,
      y: elbow.y + Math.cos(phiTip) * c.tipLength,
    };
    return { pivot, elbow, end, phiArm, phiTip };
  }

  /** 계산한 집게 위치를 물리 바디에 반영 (updateVelocity=true 면 인형을 밀어냄) */
  private syncClawBodies(updateVelocity = true): void {
    const c = CONFIG.claw;
    setPos(this.head, { x: this.headX, y: this.headY }, updateVelocity);
    for (const p of this.prongs) {
      const g = this.prongGeometry(p);
      setPos(
        p.arm,
        { x: (g.pivot.x + g.elbow.x) / 2, y: (g.pivot.y + g.elbow.y) / 2 },
        updateVelocity,
      );
      setAng(p.arm, -g.phiArm, updateVelocity);
      setPos(
        p.tip,
        {
          x: g.elbow.x + (Math.sin(g.phiTip) * c.tipLength) / 2,
          y: g.elbow.y + (Math.cos(g.phiTip) * c.tipLength) / 2,
        },
        updateVelocity,
      );
      setAng(p.tip, -g.phiTip, updateVelocity);
    }
  }

  /** 집게를 벌렸을 때 가장 낮은 점의 y (바닥 뚫기 방지용) */
  private lowestClawY(angle: number): number {
    const fake: ProngState = { ...this.prongs[1], angle };
    const g = this.prongGeometry(fake);
    return Math.max(g.elbow.y, g.end.y, this.headY + CONFIG.claw.headHeight / 2);
  }

  // -------------------------------------------------------------------
  //  인형 생성 / 제거
  // -------------------------------------------------------------------
  private spawnDoll(x: number, y: number, def: DollDef = pickDollDef()): Doll {
    const P = CONFIG.physics;
    const opts: Matter.IChamferableBodyDefinition = {
      friction: P.dollFriction,
      frictionStatic: P.dollFrictionStatic,
      restitution: P.dollRestitution,
      density: P.dollDensity,
      frictionAir: P.dollAirFriction,
      collisionFilter: { category: CAT.DOLL, mask: CAT.WALL | CAT.DOLL | CAT.CLAW | CAT.HELD },
    };
    let body: Matter.Body;
    let radius: number;
    if (def.shape === 'circle') {
      body = Bodies.circle(x, y, def.size, opts);
      radius = def.size;
    } else {
      const hw = def.size;
      const hh = def.size * (def.aspect ?? 1);
      body = Bodies.rectangle(x, y, hw * 2, hh * 2, { ...opts, chamfer: { radius: Math.min(hw, hh) * 0.55 } });
      radius = Math.max(hw, hh);
    }
    Body.setAngle(body, (Math.random() - 0.5) * 0.8);
    const doll: Doll = { uid: this.uidSeq++, def, body, radius, state: 'free', releasedByClaw: false };
    Composite.add(this.world, body);
    this.dolls.push(doll);
    return doll;
  }

  private removeDoll(d: Doll): void {
    Composite.remove(this.world, d.body);
    const i = this.dolls.indexOf(d);
    if (i >= 0) this.dolls.splice(i, 1);
  }

  private fillInitial(): void {
    const m = CONFIG.machine;
    const left = this.partitionX + 30;
    const right = this.W - m.wall - 30;
    for (let i = 0; i < m.dollCount; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = left + ((right - left) * (col + 0.5)) / 5 + (Math.random() - 0.5) * 16;
      const y = m.floorY - 40 - row * 56 - Math.random() * 10;
      this.spawnDoll(x, y);
    }
    // 시작 전에 2초쯤 미리 굴려서 인형 더미가 자연스럽게 쌓이게
    for (let i = 0; i < 150; i++) Engine.update(this.engine, 1000 / 60);
  }

  // -------------------------------------------------------------------
  //  플레이어 조작
  // -------------------------------------------------------------------
  /** "뽑기" 버튼 — 대기 상태일 때만 동작 */
  drop(): boolean {
    if (this.state !== 'idle') return false;
    this.setState('descend');
    this.contactCable = null;
    for (const p of this.prongs) {
      p.blockedAt = null;
      p.touched.clear();
    }
    this.onEvent({ type: 'descend' });
    return true;
  }

  get isIdle(): boolean {
    return this.state === 'idle';
  }

  private setState(s: ClawState): void {
    this.state = s;
    this.stateTime = 0;
  }

  // -------------------------------------------------------------------
  //  매 프레임 갱신 (고정 스텝)
  // -------------------------------------------------------------------
  step(): void {
    const dt = STEP;
    this.time += dt;
    this.stateTime += dt;
    const c = CONFIG.claw;

    // ---- 안전장치: 어떤 이유로든 한 상태에 너무 오래 머물면 정리하고 복귀 ----
    if (this.state !== 'idle' && this.stateTime > 12) {
      this.releaseHeld(false);
      for (const p of this.prongs) p.blockedAt = null;
      this.cableLen = this.minCable;
      this.trolleyX = this.homeX;
      this.trolleyV = 0;
      this.setState('reset');
    }

    // ---- 상태별 집게 동작 ----
    let targetV = 0; // 대차 목표 속도
    let maxSpeed = c.moveMaxSpeed;
    switch (this.state) {
      case 'idle':
        targetV = this.moveInput * c.moveMaxSpeed;
        this.approachAngle(0.12, c.openTime);
        break;

      case 'descend': {
        this.approachAngle(c.openAngle, c.openTime);
        this.cableLen += c.descendSpeed * dt;
        // 바닥을 뚫지 않게 제한
        const over = this.lowestClawY(c.openAngle) - (CONFIG.machine.floorY - 2);
        let stop = false;
        if (over >= 0) {
          this.cableLen -= over;
          stop = true;
        }
        if (this.contactCable === null && this.clawTouchesDoll(0.6)) {
          this.contactCable = this.cableLen;
          this.onEvent({ type: 'touch' });
        }
        if (this.contactCable !== null && this.cableLen >= this.contactCable + c.sinkDepth) stop = true;
        if (stop) this.setState('pause');
        break;
      }

      case 'pause':
        if (this.stateTime >= c.descendPause) {
          this.setState('close');
          this.onEvent({ type: 'close' });
        }
        break;

      case 'close':
        if (this.updateClosing(dt) || this.stateTime > c.closeTime * 1.5) {
          this.evaluateGrab();
          this.setState('lift');
        }
        break;

      case 'lift':
        this.cableLen -= c.liftSpeed * Math.min(1, 0.35 + this.stateTime * 2.5) * dt; // 살짝 가속하며 출발
        if (!this.held && !this.anyProngBlocked()) this.approachAngle(c.closedAngle + 0.1, c.closeTime);
        this.tickDrop('liftStart', dt);
        if (this.cableLen <= this.minCable) {
          this.cableLen = this.minCable;
          this.setState('top');
          this.onEvent({ type: 'topStop' });
          // 놓치기로 정해졌는데 아직 안 떨어졌다면 꼭대기에서 떨어뜨림
          if (this.held && !this.willHold && this.dropPhase === 'liftStart') {
            this.dropPhase = 'top';
            this.dropTimer = CONFIG.grip.wobbleTime * 0.6;
          }
        }
        break;

      case 'top': {
        this.tickDrop('top', dt);
        const wait = this.held && (this.dropPhase === 'top' || this.fakeWobblePhase === 'top')
          ? Math.max(c.topPause, CONFIG.grip.wobbleTime + 0.15)
          : c.topPause;
        if (this.stateTime >= wait) {
          this.setState('carry');
        }
        break;
      }

      case 'carry': {
        maxSpeed = c.carrySpeed;
        const dx = this.homeX - this.trolleyX;
        // 남은 거리에 맞춰 부드럽게 감속
        const brake = Math.sqrt(2 * c.moveDecel * Math.abs(dx));
        targetV = Math.sign(dx) * Math.min(c.carrySpeed, brake);
        this.tickDrop('carry', dt);
        if (Math.abs(dx) < 1.5) {
          this.trolleyX = this.homeX;
          this.trolleyV = 0;
          this.setState('release');
          for (const p of this.prongs) p.blockedAt = null;
          const d = this.held;
          if (d) d.releasedByClaw = true;
          this.releaseHeld(false);
          this.onEvent({ type: 'release', doll: d });
        }
        break;
      }

      case 'release':
        this.approachAngle(c.openAngle, c.openTime);
        if (this.stateTime > 0.65) this.setState('reset');
        break;

      case 'reset':
        this.approachAngle(0.12, c.openTime * 2);
        if (this.stateTime > 0.3) {
          this.setState('idle');
          this.onEvent({ type: 'idle' });
        }
        break;
    }

    // ---- 대차 이동 (가감속) + 집게 흔들림 ----
    const prevV = this.trolleyV;
    const accel = Math.abs(targetV) > Math.abs(this.trolleyV) && Math.sign(targetV) === Math.sign(this.trolleyV || targetV)
      ? c.moveAccel
      : c.moveDecel;
    const dv = targetV - this.trolleyV;
    this.trolleyV += Math.sign(dv) * Math.min(Math.abs(dv), accel * dt);
    this.trolleyV = Math.max(-maxSpeed, Math.min(maxSpeed, this.trolleyV));
    this.trolleyX += this.trolleyV * dt;
    if (this.trolleyX < this.minX) {
      this.trolleyX = this.minX;
      this.trolleyV = 0;
    } else if (this.trolleyX > this.maxX) {
      this.trolleyX = this.maxX;
      this.trolleyV = 0;
    }
    const a = (this.trolleyV - prevV) / dt;
    // 대차가 가속하면 집게는 뒤로 처지고, 멈추면 앞으로 쏠림 (진자)
    this.swayV += (-c.swayStiffness * this.sway - c.swayDamping * this.swayV - a * c.swayFromAccel) * dt;
    this.sway += this.swayV * dt;
    if (Math.abs(this.sway) > c.swayMax) {
      this.sway = Math.sign(this.sway) * c.swayMax;
      this.swayV *= 0.5;
    }

    // ---- 흔들림(놓치기 직전 버티기) 연출 ----
    this.updateWobble(dt);

    // ---- 물리 반영 ----
    this.syncClawBodies(true);
    Engine.update(this.engine, 1000 / 60);

    this.afterPhysics(dt);
  }

  /** 집게발 각도를 목표로 서서히 이동 (막힌 집게발은 그 자리 유지) */
  private approachAngle(target: number, time: number): void {
    const c = CONFIG.claw;
    const speed = ((c.openAngle - c.closedAngle) / time) * STEP;
    for (const p of this.prongs) {
      if (target < p.angle && p.blockedAt !== null && this.state !== 'release' && this.state !== 'reset') continue;
      const d = target - p.angle;
      p.angle += Math.sign(d) * Math.min(Math.abs(d), speed);
    }
  }

  /** 오므리기 — 인형에 닿은 집게발은 조금만 더 조이고 멈춤. 다 끝나면 true */
  private updateClosing(dt: number): boolean {
    const c = CONFIG.claw;
    const speed = ((c.openAngle - c.closedAngle) / c.closeTime) * dt;
    let done = true;
    for (const p of this.prongs) {
      const hit = this.prongContact(p, 1.0);
      if (hit !== null) {
        p.touched.add(hit);
        if (p.blockedAt === null) p.blockedAt = p.angle;
      }
      const limit = p.blockedAt !== null ? Math.max(c.closedAngle, p.blockedAt - c.biteExtra) : c.closedAngle;
      if (p.angle > limit) {
        const sp = p.blockedAt !== null ? speed * 0.3 : speed;
        p.angle = Math.max(limit, p.angle - sp);
        done = false;
      }
    }
    return done;
  }

  private anyProngBlocked(): boolean {
    return this.prongs.some((p) => p.blockedAt !== null);
  }

  /** 집게발이 닿아 있는 자유 인형 uid (없으면 null) */
  private prongContact(p: ProngState, minDepth: number): number | null {
    for (const d of this.dolls) {
      if (d.state !== 'free') continue;
      const hits = Query.collides(d.body, [p.arm, p.tip]);
      if (hits.some((h) => h.depth >= minDepth)) return d.uid;
    }
    return null;
  }

  private clawTouchesDoll(minDepth: number): boolean {
    for (const d of this.dolls) {
      if (d.state !== 'free') continue;
      const hits = Query.collides(d.body, this.clawBodies);
      if (hits.some((h) => h.depth >= minDepth)) return true;
    }
    return false;
  }

  // -------------------------------------------------------------------
  //  잡기 판정 — 어디를 어떻게 잡았는지로 "잡힌 정도(quality)"를 계산
  // -------------------------------------------------------------------
  private evaluateGrab(): void {
    const c = CONFIG.claw;
    const g = CONFIG.grip;
    const [L, R] = this.prongs;
    const gl = this.prongGeometry(L);
    const gr = this.prongGeometry(R);
    const tipY = (gl.end.y + gr.end.y) / 2;
    const innerL = Math.min(gl.end.x, gl.elbow.x);
    const innerR = Math.max(gr.end.x, gr.elbow.x);
    const headBottom = this.headY + c.headHeight / 2;

    let best: Doll | null = null;
    let bestQ = 0;
    for (const d of this.dolls) {
      if (d.state !== 'free') continue;
      const { x, y } = d.body.position;
      const r = d.radius;
      const touchL = L.touched.has(d.uid);
      const touchR = R.touched.has(d.uid);
      const enclosed = x > innerL && x < innerR && y < tipY + r * 0.2 && y > headBottom - r;
      let base = 0;
      if (touchL && touchR) base = 1;
      else if (enclosed) base = 0.85;
      else if ((touchL || touchR) && Math.abs(x - this.headX) < r * 1.1) base = 0.42; // 한쪽으로 겨우 걸침
      if (base === 0) continue;

      const span = c.pivotOffset + c.armLength * 0.55 + r * 0.3;
      const centered = 1 - Math.min(1, Math.abs(x - this.headX) / span);
      // 인형의 가장 넓은 부분 아래로 갈고리가 들어가야 잘 잡힘
      let depth = 1;
      if (y > tipY) depth = Math.max(0, 1 - (y - tipY) / (r * 0.9));
      // 집게보다 너무 큰 인형은 감싸기 어려움
      const sizeFit = Math.min(1, (c.pivotOffset + c.armLength * 0.7) / r);
      const q = base * (0.3 + 0.7 * centered) * (0.25 + 0.75 * depth) * sizeFit;
      if (q > bestQ) {
        bestQ = q;
        best = d;
      }
    }

    if (!best || bestQ < 0.08) {
      this.lastGrab = { quality: bestQ, holdChance: 0, willHold: false, dropPhase: null };
      this.onEvent({ type: 'empty' });
      return;
    }

    // ---- 버틸 확률 계산 → 결과(운명)를 미리 정해 두고 연출로 보여 줌 ----
    const w = g.qualityWeight;
    const holdChance = Math.max(g.minHold, Math.min(g.maxHold, g.strength * (1 - w + w * bestQ) + bestQ * 0.25));
    this.willHold = Math.random() < holdChance;
    this.dropPhase = null;
    this.fakeWobblePhase = null;
    if (!this.willHold) {
      this.dropPhase = weightedPick(g.dropWhen);
      // 배출구 바로 옆에서 잡았으면 "옮기다 놓침"은 의미가 없으니 꼭대기에서 놓치게
      if (this.dropPhase === 'carry' && Math.abs(this.homeX - this.trolleyX) < 70) this.dropPhase = 'top';
      this.dropTimer = this.initialDropTimer(this.dropPhase);
    } else if (bestQ < g.fakeWobbleBelowQuality && Math.random() < g.fakeWobbleChance) {
      // 성공할 거지만 아슬아슬하게 흔들어서 긴장감 주기
      this.fakeWobblePhase = weightedPick(g.dropWhen);
      this.fakeWobbleTimer = this.initialDropTimer(this.fakeWobblePhase);
    }
    this.lastGrab = { quality: bestQ, holdChance, willHold: this.willHold, dropPhase: this.dropPhase };
    this.attach(best);
    this.onEvent({ type: 'grab', doll: best, quality: bestQ, holdChance });
  }

  /** 각 단계에 들어선 뒤 몇 초 후에 놓칠지 */
  private initialDropTimer(phase: DropPhase): number {
    const wt = CONFIG.grip.wobbleTime;
    switch (phase) {
      case 'liftStart':
        return wt * 0.5 + 0.15 + Math.random() * 0.35;
      case 'top':
        return wt;
      case 'carry': {
        const dur = Math.abs(this.homeX - this.trolleyX) / CONFIG.claw.carrySpeed + 0.3;
        return Math.max(wt * 0.7, dur * (0.25 + Math.random() * 0.6));
      }
    }
  }

  /** 잡은 인형을 스프링으로 집게에 매단다 */
  private attach(d: Doll): void {
    const g = CONFIG.grip;
    const pos = d.body.position;
    const r = d.radius;
    // 집게 가운데 x 를 인형 안쪽으로 제한한 지점을 잡는다 (치우치게 잡으면 기울어 매달림)
    const gx = Math.max(pos.x - r * 0.65, Math.min(pos.x + r * 0.65, this.headX));
    const gy = pos.y - r * 0.35;
    const pointA = { x: gx - this.headX, y: gy - this.headY };
    this.holdBaseA = { ...pointA };
    this.holdConstraint = Constraint.create({
      bodyA: this.head,
      pointA,
      bodyB: d.body,
      pointB: { x: gx - pos.x, y: gy - pos.y },
      length: 0,
      stiffness: g.holdStiffness,
      damping: 0.06,
    });
    Composite.add(this.world, this.holdConstraint);
    d.state = 'held';
    d.body.collisionFilter = { ...d.body.collisionFilter, category: CAT.HELD, mask: CAT.WALL | CAT.DOLL };
    d.body.frictionAir = g.heldAirFriction;
    this.held = d;
  }

  /** 잡은 인형을 놓음 (slip=true 면 미끄러져 놓침) */
  private releaseHeld(slip: boolean): void {
    const d = this.held;
    if (this.holdConstraint) Composite.remove(this.world, this.holdConstraint);
    this.holdConstraint = null;
    this.wobbleT = 0;
    if (!d) return;
    d.state = 'falling';
    d.body.frictionAir = CONFIG.physics.dollAirFriction;
    if (slip) {
      // 툭 하고 빠지는 느낌: 살짝 아래로 + 옆으로
      Body.setVelocity(d.body, {
        x: d.body.velocity.x + (Math.random() - 0.5) * 1.2,
        y: d.body.velocity.y + 0.6,
      });
      Body.setAngularVelocity(d.body, (Math.random() - 0.5) * 0.12);
      // 집게발이 헐렁하게 벌어짐
      for (const p of this.prongs) {
        p.blockedAt = null;
        p.angle = Math.min(CONFIG.claw.openAngle, p.angle + 0.22);
      }
    }
    this.held = null;
  }

  /** 정해진 단계에서 타이머가 다 되면 흔들다가 놓침 */
  private tickDrop(phase: DropPhase, dt: number): void {
    const d = this.held;
    if (!d) return;
    const wt = CONFIG.grip.wobbleTime;
    if (!this.willHold && this.dropPhase === phase) {
      this.dropTimer -= dt;
      if (this.dropTimer <= wt && this.wobbleT === 0) this.startWobble(false);
      if (this.dropTimer <= 0) {
        const { x, y } = d.body.position;
        this.releaseHeld(true);
        this.dropPhase = null;
        this.onEvent({ type: 'slip', doll: d, phase, x, y });
      }
    } else if (this.fakeWobblePhase === phase) {
      this.fakeWobbleTimer -= dt;
      if (this.fakeWobbleTimer <= wt && this.wobbleT === 0) this.startWobble(true);
      if (this.fakeWobbleTimer <= 0) {
        this.fakeWobblePhase = null;
        this.wobbleT = 0;
        if (this.holdConstraint) {
          this.holdConstraint.pointA = { ...this.holdBaseA };
          this.holdConstraint.stiffness = CONFIG.grip.holdStiffness;
        }
        this.onEvent({ type: 'saved', doll: d });
      }
    }
  }

  private startWobble(fake: boolean): void {
    if (!this.held) return;
    this.wobbleT = 0.0001;
    this.wobbleFake = fake;
    this.onEvent({ type: 'wobble', doll: this.held, fake });
  }

  private updateWobble(dt: number): void {
    if (this.wobbleT <= 0 || !this.holdConstraint) return;
    this.wobbleT += dt;
    const k = Math.min(1, this.wobbleT / CONFIG.grip.wobbleTime);
    // 잡은 지점이 좌우로 덜덜 + 점점 아래로 미끄러짐
    this.holdConstraint.pointA = {
      x: this.holdBaseA.x + Math.sin(this.wobbleT * 40) * (2 + 3 * k),
      y: this.holdBaseA.y + k * (this.wobbleFake ? 4 : 7),
    };
    this.holdConstraint.stiffness = CONFIG.grip.holdStiffness * (1 - 0.45 * k);
  }

  /** 집게발 시각적 떨림 (렌더러용) */
  get wobbleAmount(): number {
    return this.wobbleT > 0 ? Math.min(1, this.wobbleT / CONFIG.grip.wobbleTime) : 0;
  }

  // -------------------------------------------------------------------
  //  물리 이후 처리 — 배출구 통과, 화면 밖 정리, 보충
  // -------------------------------------------------------------------
  private afterPhysics(dt: number): void {
    const m = CONFIG.machine;
    for (const d of [...this.dolls]) {
      const { x, y } = d.body.position;
      // 떨어지던 인형이 집게에서 완전히 빠져나오면 다시 집게와 충돌하게
      if (d.state === 'falling' && Query.collides(d.body, this.clawBodies).length === 0) {
        d.state = 'free';
        d.body.collisionFilter = { ...d.body.collisionFilter, category: CAT.DOLL, mask: CAT.WALL | CAT.DOLL | CAT.CLAW | CAT.HELD };
      }
      if (y > m.floorY + 50) {
        // 배출구로 빠짐 → 획득!
        if (d === this.held) this.releaseHeld(false);
        this.removeDoll(d);
        if (x < this.partitionX) {
          this.onEvent({ type: 'collected', doll: d, x, y: m.floorY, bonus: !d.releasedByClaw });
        }
      } else if (x < -40 || x > this.W + 40 || y < -80) {
        // 혹시 벽을 뚫고 나간 인형 정리
        if (d === this.held) this.releaseHeld(false);
        this.removeDoll(d);
      }
    }

    // 인형 보충 (집게가 근처에 없을 때 위에서 떨어뜨림)
    if (this.dolls.length < m.dollCount) {
      this.refillTimer += dt;
      if (this.refillTimer >= m.refillDelay) {
        const left = this.partitionX + 60; // 칸막이 바로 옆은 피해서 (저절로 넘어가지 않게)
        const right = this.W - m.wall - 34;
        let x = left + Math.random() * (right - left);
        if (Math.abs(x - this.headX) < 70) x = x < this.headX ? Math.max(left, x - 90) : Math.min(right, x + 90);
        this.spawnDoll(x, 70);
        this.refillTimer = 0;
      }
    } else {
      this.refillTimer = 0;
    }
  }
}

/** { 키: 가중치 } 에서 하나 고르기 */
function weightedPick<K extends string>(weights: Record<K, number>): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}
