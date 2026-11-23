import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, HUD_HEIGHT, MAP_COLS, MAP_ROWS, MAP_X, MAP_Y, PANEL_HEIGHT, PANEL_Y, TILE } from '../config';
import { getStage, STAGES, type StageDef } from '../data/stages';
import { ZONE_NAMES } from '../data/zones';
import { OfficeMap } from '../game/OfficeMap';
import { Patroller } from '../game/Patroller';
import { Player } from '../game/Player';
import { VirtualJoystick } from '../game/VirtualJoystick';
import { addText } from '../ui/text';
import { BaseScene } from './BaseScene';

export class GameScene extends BaseScene {
  private stage!: StageDef;
  private map!: OfficeMap;
  private player!: Player;
  private patrollers: Patroller[] = [];
  private joystick!: VirtualJoystick;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private zoneText!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  init(data: { stageId?: number }): void {
    this.stage = getStage(data.stageId ?? 1) ?? STAGES[0];
    this.patrollers = [];
  }

  create(): void {
    this.setupCamera();
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.physics.world.setBounds(MAP_X, MAP_Y, MAP_COLS * TILE, MAP_ROWS * TILE);

    this.map = new OfficeMap(this.stage.map);
    this.map.draw(this);
    const walls = this.map.buildColliders(this);

    const start = this.map.findAll('P')[0] ?? { tx: 1, ty: 1 };
    const sp = this.map.center(start.tx, start.ty);
    this.player = new Player(this, sp.x, sp.y);
    this.physics.add.collider(this.player.body, walls);

    for (const def of this.stage.patrollers) this.patrollers.push(new Patroller(this, this.map, def));

    this.joystick = new VirtualJoystick(this, new Phaser.Geom.Rectangle(0, MAP_Y, GAME_WIDTH, MAP_ROWS * TILE));
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('up,down,left,right,w,a,s,d') as typeof this.keys;

    this.buildHud();
  }

  private buildHud(): void {
    this.add.rectangle(GAME_WIDTH / 2, HUD_HEIGHT / 2, GAME_WIDTH, HUD_HEIGHT, COLORS.hud).setDepth(100);
    addText(this, GAME_WIDTH / 2, 20, `STAGE ${this.stage.id} · ${this.stage.name}`, { size: 15, bold: true }).setDepth(101);
    this.zoneText = addText(this, GAME_WIDTH / 2, 44, '', { size: 12, color: COLORS.subText }).setDepth(101);
    this.add.rectangle(GAME_WIDTH / 2, PANEL_Y + PANEL_HEIGHT / 2, GAME_WIDTH, PANEL_HEIGHT, COLORS.panel).setDepth(100);
  }

  private readInput(): Phaser.Math.Vector2 {
    const v = this.joystick.vector.clone();
    const k = this.keys;
    const kx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const ky = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (kx || ky) v.set(kx, ky).normalize();
    return v;
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    const input = this.readInput();
    this.player.setMove(input.x, input.y);
    this.player.update();

    for (const p of this.patrollers) {
      p.update(dt);
      p.alert = p.canSee(this.player.x, this.player.y);
      p.setIcon(p.alert ? '❗' : '');
    }
    this.zoneText.setText(`현재 위치: ${ZONE_NAMES[this.map.zoneAt(this.player.x, this.player.y)]}`);
  }
}
