import Phaser from 'phaser';
import { createVisual } from '../assets';
import { MAP_X, MAP_Y, TILE } from '../config';
import { ZONE_NAMES, type ZoneId } from '../data/zones';
import { addText } from '../ui/text';

type TileKind = 'wall' | 'floor' | 'desk' | 'table' | 'counter' | 'exit' | 'start';

interface TileInfo {
  zone: ZoneId;
  kind: TileKind;
  solid: boolean;
  blocksSight: boolean;
}

/** 지도 문자 범례 (README에도 같은 표가 있습니다) */
export const TILE_TYPES: Record<string, TileInfo> = {
  '#': { zone: 'hall', kind: 'wall', solid: true, blocksSight: true },
  '.': { zone: 'hall', kind: 'floor', solid: false, blocksSight: false },
  o: { zone: 'office', kind: 'floor', solid: false, blocksSight: false },
  k: { zone: 'pantry', kind: 'floor', solid: false, blocksSight: false },
  m: { zone: 'meeting', kind: 'floor', solid: false, blocksSight: false },
  d: { zone: 'office', kind: 'desk', solid: true, blocksSight: false },
  t: { zone: 'meeting', kind: 'table', solid: true, blocksSight: false },
  c: { zone: 'pantry', kind: 'counter', solid: true, blocksSight: false },
  E: { zone: 'hall', kind: 'exit', solid: false, blocksSight: false },
  P: { zone: 'hall', kind: 'start', solid: false, blocksSight: false },
};

const WALL = TILE_TYPES['#'];

const FLOOR_COLORS: Record<ZoneId, [number, number]> = {
  hall: [0xd8d2c4, 0xd2ccbd],
  office: [0xbfcfdf, 0xb8c9da],
  pantry: [0xeee3c4, 0xe2d6b4],
  meeting: [0xd3c6e2, 0xcdbfdc],
};

export class OfficeMap {
  readonly cols: number;
  readonly rows: number;

  constructor(
    readonly grid: string[],
    readonly ox = MAP_X,
    readonly oy = MAP_Y,
  ) {
    this.rows = grid.length;
    this.cols = grid[0]?.length ?? 0;
  }

  charAt(tx: number, ty: number): string {
    if (ty < 0 || ty >= this.rows || tx < 0 || tx >= this.cols) return '#';
    return this.grid[ty][tx] ?? '#';
  }

  info(tx: number, ty: number): TileInfo {
    return TILE_TYPES[this.charAt(tx, ty)] ?? WALL;
  }

  toTile(x: number, y: number): { tx: number; ty: number } {
    return { tx: Math.floor((x - this.ox) / TILE), ty: Math.floor((y - this.oy) / TILE) };
  }

  center(tx: number, ty: number): { x: number; y: number } {
    return { x: this.ox + tx * TILE + TILE / 2, y: this.oy + ty * TILE + TILE / 2 };
  }

  zoneAt(x: number, y: number): ZoneId {
    const { tx, ty } = this.toTile(x, y);
    return this.info(tx, ty).zone;
  }

  isExitAt(x: number, y: number): boolean {
    const { tx, ty } = this.toTile(x, y);
    return this.info(tx, ty).kind === 'exit';
  }

  blocksSightAt(x: number, y: number): boolean {
    const { tx, ty } = this.toTile(x, y);
    return this.info(tx, ty).blocksSight;
  }

  /** (x,y)에서 angle 방향으로 벽에 막히기 전까지의 거리 */
  castRay(x: number, y: number, angle: number, maxDist: number): number {
    const step = 3;
    const cx = Math.cos(angle);
    const cy = Math.sin(angle);
    for (let d = step; d <= maxDist; d += step) {
      if (this.blocksSightAt(x + cx * d, y + cy * d)) return d - step;
    }
    return maxDist;
  }

  hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const dist = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    return this.castRay(x1, y1, Math.atan2(y2 - y1, x2 - x1), dist) >= dist - 3;
  }

  findAll(char: string): { tx: number; ty: number }[] {
    const out: { tx: number; ty: number }[] = [];
    for (let ty = 0; ty < this.rows; ty++)
      for (let tx = 0; tx < this.cols; tx++) if (this.charAt(tx, ty) === char) out.push({ tx, ty });
    return out;
  }

  /** 바닥·벽·가구·방 이름을 그립니다 */
  draw(scene: Phaser.Scene): void {
    const g = scene.add.graphics().setDepth(0);
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const info = this.info(tx, ty);
        const x = this.ox + tx * TILE;
        const y = this.oy + ty * TILE;
        if (info.kind === 'wall') {
          g.fillStyle(0x3a3f4b).fillRect(x, y, TILE, TILE);
          // 아래쪽이 바닥이면 벽 윗면 느낌의 하이라이트
          if (!this.info(tx, ty + 1).solid) g.fillStyle(0x525868).fillRect(x, y + TILE - 6, TILE, 6);
          continue;
        }
        const [c1, c2] = FLOOR_COLORS[info.zone];
        g.fillStyle((tx + ty) % 2 === 0 ? c1 : c2).fillRect(x, y, TILE, TILE);
        if (info.kind === 'desk') {
          g.fillStyle(0x8a6a4a).fillRoundedRect(x + 2, y + 3, TILE - 4, TILE - 6, 4);
          g.fillStyle(0xa98463).fillRoundedRect(x + 4, y + 5, TILE - 8, TILE - 12, 3);
          createVisual(scene, 'desk_pc', x + TILE / 2, y + TILE / 2, 16).setDepth(1);
        } else if (info.kind === 'table') {
          g.fillStyle(0x6b4f3a).fillRect(x, y + 1, TILE, TILE - 2);
          g.fillStyle(0x7d5d45).fillRect(x + 2, y + 3, TILE - 4, TILE - 6);
        } else if (info.kind === 'counter') {
          g.fillStyle(0x9aa1ad).fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          g.fillStyle(0xb8bec8).fillRect(x + 3, y + 3, TILE - 6, TILE - 10);
          createVisual(scene, 'counter_cup', x + TILE / 2, y + TILE / 2, 14).setDepth(1);
        } else if (info.kind === 'exit') {
          g.fillStyle(0x4cd964, 0.35).fillRect(x, y, TILE, TILE);
        }
      }
    }
    // 엘리베이터 아이콘 (반짝임)
    for (const { tx, ty } of this.findAll('E')) {
      const c = this.center(tx, ty);
      const v = createVisual(scene, 'elevator', c.x, c.y, 24).setDepth(2);
      scene.tweens.add({ targets: v, scale: { from: 1, to: 1.15 }, yoyo: true, repeat: -1, duration: 600 });
    }
    this.drawRoomLabels(scene);
  }

  /** 같은 종류 바닥이 이어진 영역마다 방 이름 표시 (복도 제외) */
  private drawRoomLabels(scene: Phaser.Scene): void {
    const seen = new Set<string>();
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const info = this.info(tx, ty);
        if (info.kind === 'wall' || info.zone === 'hall' || seen.has(`${tx},${ty}`)) continue;
        // flood fill
        const cells: [number, number][] = [];
        const stack: [number, number][] = [[tx, ty]];
        seen.add(`${tx},${ty}`);
        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          cells.push([cx, cy]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            const k = `${nx},${ny}`;
            const ni = this.info(nx, ny);
            if (seen.has(k) || ni.kind === 'wall' || ni.zone !== info.zone) continue;
            seen.add(k);
            stack.push([nx, ny]);
          }
        }
        if (cells.length < 4) continue;
        const minY = Math.min(...cells.map((c) => c[1]));
        const top = cells.filter((c) => c[1] === minY);
        const avgX = top.reduce((s, c) => s + c[0], 0) / top.length;
        const p = this.center(avgX, minY);
        addText(scene, p.x, p.y - 8, ZONE_NAMES[info.zone], { size: 10, color: '#4a4f5c', bold: true })
          .setAlpha(0.7)
          .setDepth(1);
      }
    }
  }

  /** 단단한 타일(벽·가구)을 가로로 묶어서 정적 충돌체 생성 */
  buildColliders(scene: Phaser.Scene): Phaser.Physics.Arcade.StaticGroup {
    const group = scene.physics.add.staticGroup();
    for (let ty = 0; ty < this.rows; ty++) {
      let start = -1;
      for (let tx = 0; tx <= this.cols; tx++) {
        const solid = tx < this.cols && this.info(tx, ty).solid;
        if (solid && start < 0) start = tx;
        if (!solid && start >= 0) {
          const w = (tx - start) * TILE;
          const rect = scene.add.rectangle(this.ox + start * TILE + w / 2, this.oy + ty * TILE + TILE / 2, w, TILE);
          rect.setVisible(false);
          group.add(rect);
          start = -1;
        }
      }
    }
    group.refresh();
    return group;
  }
}
