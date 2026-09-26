import {
  FADE_IN_SECONDS,
  MAX_FALLBACK_DEPTH,
  MAX_INSTANCES_PER_FRAME,
  MAX_TILES_PER_FRAME,
} from './constants';
import type { TileCoverage } from './ports/tile-coverage';
import { ResidentTileIndex } from './resident-tile-index';
import type { ReadyTileInfo } from './tile-instances';
import { NO_LAYER, planTileInstances } from './tile-instances';
import type { TileCoord, TileKey } from './tile-key';
import { childrenOf, tileKeyOf } from './tile-key';
import type { SelectedTile } from './tile-selection';

function selectedTile(coord: TileCoord): SelectedTile {
  return { key: tileKeyOf(coord), coord, edgePx: 300, screenDistancePx: 0 };
}

function planning(options: {
  readonly ready?: ReadonlyMap<TileKey, ReadyTileInfo>;
  readonly resident?: readonly TileCoord[];
  readonly coverage?: TileCoverage;
}) {
  const index = new ResidentTileIndex();
  const layers = new Map<TileKey, number>();
  for (const coord of options.resident ?? []) {
    index.insert(coord);
    layers.set(tileKeyOf(coord), layers.size + 10);
  }
  for (const [key, info] of options.ready ?? []) {
    layers.set(key, info.layer);
  }
  return {
    readyTile: (key: TileKey) => options.ready?.get(key),
    layerOf: (key: TileKey) => layers.get(key),
    coverage: options.coverage ?? index,
    layers,
  };
}

const TILE: TileCoord = { z: 14, x: 86, y: 54 };
const ANCESTOR: TileCoord = { z: 12, x: 21, y: 13 };

describe('tile instance planning', () => {
  it('shows a landed tile plainly once its fade is over', () => {
    const ready = new Map([[tileKeyOf(TILE), { layer: 3, fadeStart: 0 }]]);

    const [instance] = planTileInstances(
      [selectedTile(TILE)],
      planning({ ready }),
      FADE_IN_SECONDS
    );

    expect(instance.layer).toBe(3);
    expect(instance.baseLayer).toBe(NO_LAYER);
  });

  it('borrows the sub-rectangle of the nearest cached ancestor while loading', () => {
    const plan = planning({ resident: [ANCESTOR] });

    const [instance] = planTileInstances([selectedTile(TILE)], plan, 0);

    expect(instance.layer).toBe(NO_LAYER);
    expect(instance.baseLayer).toBe(plan.layers.get(tileKeyOf(ANCESTOR)));
    expect(instance.baseScale).toBe(0.25);
    expect(instance.baseUv).toEqual({ x: 0.5, y: 0.5 });
  });

  it('fades a landed tile in over its ancestor instead of the checkerboard', () => {
    const ready = new Map([[tileKeyOf(TILE), { layer: 3, fadeStart: 1 }]]);
    const plan = planning({ ready, resident: [ANCESTOR] });

    const [instance] = planTileInstances([selectedTile(TILE)], plan, 1.1);

    expect(instance.layer).toBe(3);
    expect(instance.fadeStart).toBe(1);
    expect(instance.baseLayer).toBe(plan.layers.get(tileKeyOf(ANCESTOR)));
  });

  it('lays cached descendants over the checkerboard when no ancestor is cached', () => {
    const children: TileCoord[] = [
      { z: 15, x: 172, y: 108 },
      { z: 15, x: 173, y: 109 },
    ];
    const plan = planning({ resident: children });

    const instances = planTileInstances([selectedTile(TILE)], plan, 0);

    expect(instances).toHaveLength(1 + children.length);
    expect(instances[0].layer).toBe(NO_LAYER);
    expect(instances[0].baseLayer).toBe(NO_LAYER);
    expect(instances.slice(1).map(instance => instance.size)).toEqual([1 / 2 ** 15, 1 / 2 ** 15]);
  });

  it('shows a tile at once when it lands over descendants', () => {
    const ready = new Map([[tileKeyOf(TILE), { layer: 3, fadeStart: 5 }]]);
    const plan = planning({ ready, resident: [{ z: 15, x: 172, y: 108 }] });

    const instances = planTileInstances([selectedTile(TILE)], plan, 5);

    expect(instances).toHaveLength(1);
    expect(instances[0].fadeStart).toBe(Number.NEGATIVE_INFINITY);
  });

  it('ignores descendants deeper than the fallback depth', () => {
    const deep: TileCoord = { z: 14 + MAX_FALLBACK_DEPTH + 1, x: 86 * 16, y: 54 * 16 };
    const plan = planning({ resident: [deep] });

    expect(planTileInstances([selectedTile(TILE)], plan, 0)).toHaveLength(1);
  });

  it('keeps a quad for every selected tile when descendants would overflow the frame', () => {
    const selected: SelectedTile[] = [];
    const resident: TileCoord[] = [];
    for (let x = 0; x < MAX_TILES_PER_FRAME; x++) {
      const coord: TileCoord = { z: 14, x, y: 54 };
      selected.push(selectedTile(coord));
      resident.push(...childrenOf(coord));
    }

    const instances = planTileInstances(selected, planning({ resident }), 0);

    expect(instances.length).toBeLessThanOrEqual(MAX_INSTANCES_PER_FRAME);
    expect(instances.filter(instance => instance.size === 1 / 2 ** 14)).toHaveLength(
      MAX_TILES_PER_FRAME
    );
  });
});
