import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import { CELL_SIZE_WU, TILE_CELL_SPAN } from '../domain/constants';
import type { Terrain } from '../domain/terrain';
import type { TerrainCell } from '../domain/types';
import { QuadInstanceList } from './quad-instances';
import type { AtlasUvRect, SpriteUvLookup } from './sprite-atlas';
import {
  EAGLE_DESTROYED_SPRITE_ID,
  EAGLE_SPRITE_ID,
  FIELD_BACKGROUND_SPRITE_ID,
  getBrickSpriteId,
  ICE_SPRITE_ID,
  STEEL_SPRITE_ID,
  TREES_SPRITE_ID,
  WATER_SPRITE_ID,
} from './sprites/sprite-ids';
import type { ITanksWorldView } from './tanks-world-view';

const FIELD_BACKGROUND_INSTANCE_COUNT = 1;

/** Picks the quarter of a tile-sized sprite that belongs to one 8-wu cell of that tile. */
function getCellQuadrantUvRect(tileRect: AtlasUvRect, cellX: number, cellY: number): AtlasUvRect {
  const quadrantWidth = (tileRect.maxU - tileRect.minU) / TILE_CELL_SPAN;
  const quadrantHeight = (tileRect.maxV - tileRect.minV) / TILE_CELL_SPAN;
  const minU = tileRect.minU + (cellX % TILE_CELL_SPAN) * quadrantWidth;
  const minV = tileRect.minV + (cellY % TILE_CELL_SPAN) * quadrantHeight;

  return { minU, minV, maxU: minU + quadrantWidth, maxV: minV + quadrantHeight };
}

/**
 * Rebuilt only when the terrain revision moves — or when the eagle blows up, which swaps its
 * art without touching a cell (§11.3).
 */
export class TerrainInstanceCache {
  private groundInstancesValue = new QuadInstanceList(0);
  private forestInstancesValue = new QuadInstanceList(0);
  private listCapacity = 0;
  private lastTerrain: Terrain | undefined;
  private lastRevision = -1;
  private lastBaseDestroyed = false;
  private buildIdValue = 0;

  constructor(
    private readonly view: ITanksWorldView,
    private readonly atlas: SpriteUvLookup
  ) {}

  /** Bumped on every rebuild so layers know when to re-upload their buffers. */
  get buildId(): number {
    return this.buildIdValue;
  }

  get groundInstances(): QuadInstanceList {
    return this.groundInstancesValue;
  }

  get forestInstances(): QuadInstanceList {
    return this.forestInstancesValue;
  }

  sync(): void {
    const { terrain, isBaseDestroyed } = this.view;
    const isCurrent =
      terrain === this.lastTerrain &&
      terrain.revision === this.lastRevision &&
      isBaseDestroyed === this.lastBaseDestroyed;

    if (isCurrent) {
      return;
    }

    this.lastTerrain = terrain;
    this.lastRevision = terrain.revision;
    this.lastBaseDestroyed = isBaseDestroyed;
    this.buildIdValue++;

    this.rebuild(terrain, isBaseDestroyed);
  }

  /** Stages carry their own field size, so the staging lists follow the current cell count. */
  private ensureCapacity(cellCount: number): void {
    const capacity = cellCount + FIELD_BACKGROUND_INSTANCE_COUNT;

    if (capacity <= this.listCapacity) {
      return;
    }

    this.listCapacity = capacity;
    this.groundInstancesValue = new QuadInstanceList(capacity);
    this.forestInstancesValue = new QuadInstanceList(capacity);
  }

  private rebuild(terrain: Terrain, isBaseDestroyed: boolean): void {
    const { geometry } = terrain;

    this.ensureCapacity(geometry.cellColumns * geometry.cellRows);
    this.groundInstancesValue.reset();
    this.forestInstancesValue.reset();

    this.groundInstancesValue.push({
      positionXWu: 0,
      positionYWu: 0,
      widthWu: geometry.widthWu,
      heightWu: geometry.heightWu,
      uvRect: this.atlas.getUvRect(FIELD_BACKGROUND_SPRITE_ID),
    });

    for (let cellY = 0; cellY < geometry.cellRows; cellY++) {
      for (let cellX = 0; cellX < geometry.cellColumns; cellX++) {
        this.pushCell(terrain.getCell(cellX, cellY), cellX, cellY, isBaseDestroyed);
      }
    }
  }

  private pushCell(
    cell: TerrainCell,
    cellX: number,
    cellY: number,
    isBaseDestroyed: boolean
  ): void {
    const uvRect = this.resolveCellUvRect(cell, cellX, cellY, isBaseDestroyed);

    if (isNil(uvRect)) {
      return;
    }

    const target = cell.kind === 'trees' ? this.forestInstancesValue : this.groundInstancesValue;

    target.push({
      positionXWu: cellX * CELL_SIZE_WU,
      positionYWu: cellY * CELL_SIZE_WU,
      widthWu: CELL_SIZE_WU,
      heightWu: CELL_SIZE_WU,
      uvRect,
      frameCount: cell.kind === 'water' ? this.atlas.getFrameCount(WATER_SPRITE_ID) : undefined,
    });
  }

  private resolveCellUvRect(
    cell: TerrainCell,
    cellX: number,
    cellY: number,
    isBaseDestroyed: boolean
  ): AtlasUvRect | undefined {
    switch (cell.kind) {
      case 'empty':
      case 'border':
        return undefined;
      case 'brick':
        return this.atlas.getUvRect(getBrickSpriteId(cell));
      case 'steel':
        return this.atlas.getUvRect(STEEL_SPRITE_ID);
      case 'water':
        return this.atlas.getUvRect(WATER_SPRITE_ID);
      case 'ice':
        return this.atlas.getUvRect(ICE_SPRITE_ID);
      case 'trees':
        return this.atlas.getUvRect(TREES_SPRITE_ID);
      case 'eagle':
        return getCellQuadrantUvRect(
          this.atlas.getUvRect(isBaseDestroyed ? EAGLE_DESTROYED_SPRITE_ID : EAGLE_SPRITE_ID),
          cellX,
          cellY
        );
      default:
        return assertNever(cell.kind);
    }
  }
}
