import { describe, expect, it } from 'vitest';

import { CELL_SIZE_WU } from '../domain/constants';
import { createFieldGeometry } from '../domain/field';
import { getStageByNumber } from '../domain/levels/registry';
import { BRICK_CELL, EMPTY_CELL, Terrain, TREES_CELL } from '../domain/terrain';
import { FLOATS_PER_QUAD_INSTANCE } from './quad-instances';
import type { AtlasUvRect, SpriteUvLookup } from './sprite-atlas';
import type { ITanksWorldView } from './tanks-world-view';
import { TerrainInstanceCache } from './terrain-instance-cache';

const UNIT_UV_RECT: AtlasUvRect = { minU: 0, minV: 0, maxU: 1, maxV: 1 };
const WATER_FRAME_COUNT = 2;

/** The cache only asks the atlas where a sprite lives, so a lookup stub is enough here. */
const uvLookup: SpriteUvLookup = {
  getUvRect: () => UNIT_UV_RECT,
  getFrameCount: () => WATER_FRAME_COUNT,
};

function createWorldView(terrain: Terrain, isBaseDestroyed = false): ITanksWorldView {
  return {
    terrain,
    players: [],
    enemies: [],
    bullets: [],
    powerUp: undefined,
    isBaseDestroyed,
    ticksSinceStageStart: 0,
  };
}

function createStageTerrain(stageNumber: number): Terrain {
  const stage = getStageByNumber(stageNumber);

  return new Terrain(
    stage.terrain,
    createFieldGeometry(stage.fieldWidthTiles, stage.fieldHeightTiles)
  );
}

function readInstancePosition(
  data: Float32Array,
  instanceIndex: number
): { readonly x: number; readonly y: number } {
  const offset = instanceIndex * FLOATS_PER_QUAD_INSTANCE;

  return { x: data[offset], y: data[offset + 1] };
}

describe('TerrainInstanceCache', () => {
  it('draws the field background before any cell', () => {
    const terrain = createStageTerrain(1);
    const cache = new TerrainInstanceCache(createWorldView(terrain), uvLookup);

    cache.sync();

    const background = readInstancePosition(cache.groundInstances.data, 0);

    expect(background).toEqual({ x: 0, y: 0 });
    expect(cache.groundInstances.instanceCount).toBeGreaterThan(1);
  });

  it('sends trees to the forest list and everything else to the ground list', () => {
    const geometry = createFieldGeometry(7, 7);
    const cells = Array.from(
      { length: geometry.cellColumns * geometry.cellRows },
      () => EMPTY_CELL
    );
    cells[0] = BRICK_CELL;
    cells[1] = TREES_CELL;

    const cache = new TerrainInstanceCache(createWorldView(new Terrain(cells, geometry)), uvLookup);

    cache.sync();

    expect(cache.groundInstances.instanceCount).toBe(2);
    expect(cache.forestInstances.instanceCount).toBe(1);
    expect(readInstancePosition(cache.forestInstances.data, 0)).toEqual({ x: CELL_SIZE_WU, y: 0 });
  });

  it('rebuilds only when the terrain revision moves', () => {
    const terrain = createStageTerrain(1);
    const cache = new TerrainInstanceCache(createWorldView(terrain), uvLookup);

    cache.sync();
    const initialBuildId = cache.buildId;

    cache.sync();
    expect(cache.buildId).toBe(initialBuildId);

    terrain.setCell(0, 0, BRICK_CELL);
    cache.sync();
    expect(cache.buildId).toBe(initialBuildId + 1);
  });

  it('rebuilds when the eagle is destroyed, which no cell records', () => {
    const terrain = createStageTerrain(1);
    let isBaseDestroyed = false;
    const view: ITanksWorldView = {
      terrain,
      players: [],
      enemies: [],
      bullets: [],
      powerUp: undefined,
      get isBaseDestroyed(): boolean {
        return isBaseDestroyed;
      },
      ticksSinceStageStart: 0,
    };
    const cache = new TerrainInstanceCache(view, uvLookup);

    cache.sync();
    const initialBuildId = cache.buildId;

    isBaseDestroyed = true;
    cache.sync();

    expect(cache.buildId).toBe(initialBuildId + 1);
  });
});
