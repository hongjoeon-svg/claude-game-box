import * as THREE from 'three';
import { CarResources, buildCar, type CarBuild } from '../car/build';
import { baseConfig, type CarConfig } from '../car/config';
import { BASE_LENGTH, EYE_HEIGHT } from '../car/layout';
import { TUNNEL_PERIOD } from '../car/textures';
import { Input } from './input';
import { Player } from './player';
import { GOAL, LINE_NAME, STATIONS, TERMINAL, nextStationIndex } from './stations';

export type Mode = 'title' | 'playing' | 'transition' | 'ending' | 'paused';
export type Choice = 'front' | 'back';

export interface GameHooks {
  fade(to: number, ms: number): Promise<void>;
  onEnding(): void;
}

const TRAIN_SPEED = 15; // m/s, 창밖 터널 흐르는 속도

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 80);
  readonly res: CarResources;
  readonly input: Input;
  readonly player = new Player();
  readonly hemi: THREE.HemisphereLight;
  readonly lamp: THREE.PointLight; // 플레이어 머리 위를 따라다니는 조명
  readonly accent: THREE.PointLight; // 이상현상 연출용 (평소 0)
  car: CarBuild | null = null;
  cfg: CarConfig | null = null;
  mode: Mode = 'title';
  count = 0;
  sensitivity = 1;
  t = 0;
  carTime = 0;
  backArmed = false;
  /** 런타임 상태 (이상현상이 바꿀 수 있음) */
  swayEnabled = true;
  tunnelDir = 1;
  private jolt = 0;
  private joltVel = 0;
  private nextJolt = 4;
  private roll = 0;
  private lockedCooldown = 0;
  private titleT = 0;
  private fpsEl: HTMLElement | null = null;
  private fpsAcc = { n: 0, t: 0 };

  constructor(canvas: HTMLCanvasElement, private hooks: GameHooks) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 14, 38);
    this.res = new CarResources(this.renderer.capabilities.getMaxAnisotropy());
    this.hemi = new THREE.HemisphereLight(0xfffbf2, 0x9c988f, 1.9);
    this.lamp = new THREE.PointLight(0xf4f8ff, 1.3, 7, 1.2);
    this.accent = new THREE.PointLight(0xff2020, 0, 5, 1.5);
    this.scene.add(this.hemi, this.lamp, this.accent, this.camera);
    this.camera.rotation.order = 'YXZ';
    this.input = new Input(canvas);
    if (new URLSearchParams(location.search).has('debug')) {
      this.fpsEl = document.createElement('div');
      this.fpsEl.className = 'fps';
      document.body.appendChild(this.fpsEl);
    }
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.loadCar(baseConfig(0, BASE_LENGTH));
    this.player.reset(BASE_LENGTH);
    let last = performance.now();
    this.renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.frame(dt);
    });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // 세로 화면에서도 가로 시야 약 62°를 확보 (세로 시야는 최대 100°)
    const hfov = THREE.MathUtils.degToRad(62);
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect);
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vfov), 60, 100);
    this.camera.updateProjectionMatrix();
  }

  /** 새 게임 시작 */
  startRun() {
    this.count = 0;
    this.enterCar(this.makeConfig());
    this.mode = 'playing';
    this.input.enabled = true;
  }

  private makeConfig(): CarConfig {
    return baseConfig(this.count, BASE_LENGTH);
  }

  private loadCar(cfg: CarConfig) {
    if (this.car) {
      this.scene.remove(this.car.root);
      this.car.dispose();
    }
    this.cfg = cfg;
    this.car = buildCar(cfg, this.res);
    this.scene.add(this.car.root);
    this.res.led.digit = String(cfg.count);
    const next = STATIONS[nextStationIndex(cfg.count)];
    this.res.led.setLines(
      cfg.terminal
        ? [`이번 역은 종착역 ${TERMINAL}입니다`, '모든 승객은 내려 주시기 바랍니다']
        : [`다음 역은 ${next}입니다`, `이 열차는 ${LINE_NAME} 막차입니다`, '내리실 문은 오른쪽입니다'],
    );
  }

  private enterCar(cfg: CarConfig) {
    this.loadCar(cfg);
    this.player.reset(cfg.length);
    this.player.rightDoorsOpen = false;
    this.backArmed = false;
    this.carTime = 0;
    this.swayEnabled = !cfg.terminal;
    this.tunnelDir = 1;
    this.accent.intensity = 0;
    this.input.reset();
  }

  private async choose(choice: Choice) {
    if (this.mode !== 'playing' || !this.car || !this.cfg) return;
    this.mode = 'transition';
    this.input.enabled = false;
    this.input.reset();
    const door = choice === 'front' ? this.car.frontDoor : this.car.backDoor;
    await this.animateDoor(door, 0.55);
    await this.hooks.fade(1, 450);
    const anomalous = false; // 2단계에서 이상현상 시스템이 채움
    const correct = (choice === 'back') === anomalous;
    this.count = correct ? this.count + 1 : 0;
    if (this.count >= GOAL) {
      const cfg = baseConfig(GOAL, BASE_LENGTH);
      cfg.terminal = true;
      this.enterCar(cfg);
      this.mode = 'ending';
      this.input.enabled = true;
      await this.hooks.fade(0, 700);
      this.runTerminal();
      return;
    }
    this.enterCar(this.makeConfig());
    await this.hooks.fade(0, 600);
    this.mode = 'playing';
    this.input.enabled = true;
  }

  private animateDoor(door: THREE.Mesh, secs: number) {
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - start) / (secs * 1000));
        door.position.x = (1 - Math.pow(1 - k, 3)) * 0.84;
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
  }

  /** 종착역: 열차가 서고 오른쪽 문이 열린다 */
  private runTerminal() {
    window.setTimeout(() => {
      if (this.mode !== 'ending' || !this.car) return;
      const car = this.car;
      const start = performance.now();
      const m = new THREE.Matrix4();
      const step = () => {
        const k = Math.min(1, (performance.now() - start) / 1400);
        const e = 1 - Math.pow(1 - k, 3);
        car.sideDoorInfo.forEach((d, i) => {
          if (d.side < 0) return;
          car.sideDoors.setMatrixAt(i, m.makeTranslation(d.side * (1.5 - 0.03), 0, d.z + (d.dir * d.w) / 2 + d.dir * d.w * 0.95 * e));
        });
        car.sideDoors.instanceMatrix.needsUpdate = true;
        if (k < 1) requestAnimationFrame(step);
        else this.player.rightDoorsOpen = true;
      };
      step();
    }, 2500);
  }

  private frame(dt: number) {
    this.t += dt;
    if (this.fpsEl) {
      this.fpsAcc.n++;
      this.fpsAcc.t += dt;
      if (this.fpsAcc.t > 0.5) {
        this.fpsEl.textContent = `${Math.round(this.fpsAcc.n / this.fpsAcc.t)} fps · ${this.renderer.info.render.calls} calls`;
        this.fpsAcc = { n: 0, t: 0 };
      }
    }
    if (this.mode === 'paused') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.carTime += dt;
    const car = this.car!;
    const L = car.length;

    // 객차 흔들림 / 덜컹거림
    if (this.swayEnabled) {
      this.nextJolt -= dt;
      if (this.nextJolt <= 0) {
        this.joltVel += (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.05);
        this.nextJolt = 3 + Math.random() * 5;
      }
    }
    this.joltVel += -this.jolt * 40 * dt - this.joltVel * 4 * dt;
    this.jolt += this.joltVel * dt;
    const s = this.swayEnabled ? 1 : 0;
    this.roll = s * (0.007 * Math.sin(this.t * 1.3) + 0.004 * Math.sin(this.t * 3.1 + 1)) + this.jolt * 0.25;

    // 플레이어
    this.input.poll();
    if (this.mode === 'playing' || this.mode === 'ending') {
      const lk = this.input.consumeLook();
      this.player.look(lk.dx, lk.dy, this.sensitivity);
      this.player.update(dt, this.input.moveX, this.input.moveY, L);
      this.checkTriggers(L, dt);
    } else this.input.consumeLook();

    const p = this.player;
    if (this.mode === 'title') {
      this.titleT += dt;
      p.pos.set(0.15 * Math.sin(this.titleT * 0.1), 0, L / 2 - 2.5 - (this.titleT * 0.12) % 6);
      p.yaw = 0.25 * Math.sin(this.titleT * 0.07);
      p.pitch = 0.04;
    }
    const bob = Math.sin(p.bobPhase) * 0.022 * p.moving;
    this.camera.position.set(p.pos.x + this.jolt * 0.15 + s * 0.012 * Math.sin(this.t * 1.1), EYE_HEIGHT + bob + Math.abs(this.jolt) * 0.05, p.pos.z);
    this.camera.rotation.set(p.pitch, p.yaw, this.roll + Math.sin(p.bobPhase * 0.5) * 0.004 * p.moving);
    this.lamp.position.set(p.pos.x * 0.3, 1.35, p.pos.z - 1.0);

    // 손잡이 흔들림
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    car.strapInfo.forEach((si, i) => {
      const sw = s * (0.09 * Math.sin(this.t * 1.3 - 0.6 + si.phase) + 0.05 * Math.sin(this.t * 3.1 + si.phase * 3)) * si.amp + this.jolt * 1.6;
      const fw = s * 0.05 * Math.sin(this.t * 0.9 + si.phase * 2) * si.amp;
      e.set(fw, 0, -sw * Math.sign(si.pos.x || 1));
      q.setFromEuler(e);
      m.compose(si.pos, q, one);
      car.straps.setMatrixAt(i, m);
    });
    car.straps.instanceMatrix.needsUpdate = true;

    // 창밖 터널
    if (!this.cfg?.terminal) {
      const d = (this.tunnelDir * TRAIN_SPEED * dt) / TUNNEL_PERIOD;
      this.res.tunnelR.offset.x -= d;
      this.res.tunnelL.offset.x += d;
    }
    this.res.led.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private checkTriggers(L: number, dt: number) {
    const p = this.player.pos;
    const half = L / 2;
    this.lockedCooldown -= dt;
    if (this.mode === 'ending') {
      if (p.x > 1.9) {
        this.mode = 'transition';
        this.input.enabled = false;
        this.input.reset();
        this.hooks.onEnding();
      }
      return;
    }
    if (p.z < 0) this.backArmed = true;
    if (p.z < -half + 0.6 && Math.abs(p.x) < 0.5) void this.choose('front');
    else if (p.z > half - 0.6 && Math.abs(p.x) < 0.5) {
      if (this.backArmed) void this.choose('back');
      else if (this.lockedCooldown <= 0) {
        this.lockedCooldown = 2;
        this.jolt += 0.01; // 잠긴 문 덜컹 (3단계에서 소리 추가)
      }
    }
  }

  pause(on: boolean) {
    if (on && (this.mode === 'playing' || this.mode === 'ending')) {
      this.prevMode = this.mode;
      this.mode = 'paused';
      this.input.enabled = false;
      this.input.reset();
    } else if (!on && this.mode === 'paused') {
      this.mode = this.prevMode;
      this.input.enabled = true;
    }
  }
  private prevMode: Mode = 'playing';

  toTitle() {
    this.mode = 'title';
    this.input.enabled = false;
    this.input.reset();
    this.count = 0;
    this.enterCar(baseConfig(0, BASE_LENGTH));
  }
}
