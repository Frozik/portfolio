import { FADE_IN_SECONDS, MAX_FALLBACK_DEPTH, MAX_INSTANCES_PER_FRAME } from './constants';
import type { GroundPoint } from './mercator';
import type { TileCoverage } from './ports/tile-coverage';
import type { TileCoord, TileKey } from './tile-key';
import { tileKeyOf, tileOrigin, tileWorldSize } from './tile-key';
import type { SelectedTile } from './tile-selection';

/** One quad on the ground: what it shows on top and what shows through while it fades in. */
export interface TileInstance {
  readonly origin: GroundPoint;
  readonly size: number;
  /** Atlas layer of the tile's own image, or `NO_LAYER`. */
  readonly layer: number;
  readonly fadeStart: number;
  /** Atlas layer drawn underneath (an ancestor's sub-rectangle), or `NO_LAYER` for the checkerboard. */
  readonly baseLayer: number;
  readonly baseUv: GroundPoint;
  readonly baseScale: number;
}

export interface ReadyTileInfo {
  readonly layer: number;
  readonly fadeStart: number;
}

export interface TileInstancePlanning {
  readonly readyTile: (key: TileKey) => ReadyTileInfo | undefined;
  readonly layerOf: (key: TileKey) => number | undefined;
  readonly coverage: TileCoverage;
}

export const NO_LAYER = -1;
const NO_BASE = { layer: NO_LAYER, uv: { x: 0, y: 0 }, scale: 1 } as const;
const NEVER_FADES = Number.NEGATIVE_INFINITY;

interface Base {
  readonly layer: number;
  readonly uv: GroundPoint;
  readonly scale: number;
}

function ancestorBase(coord: TileCoord, planning: TileInstancePlanning): Base | undefined {
  const ancestor = planning.coverage.nearestAncestor(coord);
  const layer = ancestor === undefined ? undefined : planning.layerOf(tileKeyOf(ancestor));
  if (ancestor === undefined || layer === undefined) {
    return undefined;
  }
  const depth = coord.z - ancestor.z;
  const span = 2 ** depth;
  return {
    layer,
    uv: { x: (coord.x - ancestor.x * span) / span, y: (coord.y - ancestor.y * span) / span },
    scale: 1 / span,
  };
}

function instanceOf(
  coord: TileCoord,
  layer: number,
  fadeStart: number,
  base: Base = NO_BASE
): TileInstance {
  return {
    origin: tileOrigin(coord),
    size: tileWorldSize(coord.z),
    layer,
    fadeStart,
    baseLayer: base.layer,
    baseUv: base.uv,
    baseScale: base.scale,
  };
}

/**
 * Turns the selected tiles into quads. A tile whose image is in the atlas
 * shows it; while it loads, or while it fades in, the nearest cached
 * ancestor shows through underneath, and failing that any cached
 * descendants are laid over the checkerboard as extra quads. A tile landing
 * over descendants appears at once — a fade would flash the checkerboard.
 * Every selected tile always gets its quad; descendants only fill what the
 * frame has left, so the plan never outgrows the instance buffer.
 */
export function planTileInstances(
  selected: readonly SelectedTile[],
  planning: TileInstancePlanning,
  nowSeconds: number
): readonly TileInstance[] {
  const instances: TileInstance[] = [];
  let spareQuads = MAX_INSTANCES_PER_FRAME - selected.length;
  for (const { key, coord } of selected) {
    const own = planning.readyTile(key);
    const fading = own !== undefined && nowSeconds - own.fadeStart < FADE_IN_SECONDS;
    if (own !== undefined && !fading) {
      instances.push(instanceOf(coord, own.layer, own.fadeStart));
      continue;
    }
    const base = ancestorBase(coord, planning);
    if (base !== undefined) {
      instances.push(
        instanceOf(coord, own?.layer ?? NO_LAYER, own?.fadeStart ?? NEVER_FADES, base)
      );
      continue;
    }
    const descendants = planning.coverage.descendants(coord, MAX_FALLBACK_DEPTH);
    if (own !== undefined) {
      instances.push(
        instanceOf(coord, own.layer, descendants.length > 0 ? NEVER_FADES : own.fadeStart)
      );
      continue;
    }
    instances.push(instanceOf(coord, NO_LAYER, NEVER_FADES));
    for (const descendant of descendants) {
      const layer = planning.layerOf(tileKeyOf(descendant));
      if (layer !== undefined && spareQuads > 0) {
        instances.push(instanceOf(descendant, layer, NEVER_FADES));
        spareQuads--;
      }
    }
  }
  return instances;
}
