import RBush from 'rbush';

import type { TileCoverage } from './ports/tile-coverage';
import type { GroundRect, TileCoord, TileKey } from './tile-key';
import { tileBounds, tileKeyOf } from './tile-key';

interface ResidentTile extends GroundRect {
  readonly key: TileKey;
  readonly coord: TileCoord;
}

const RBUSH_MAX_ENTRIES = 9;
/** Tile bounds are exact binary fractions, but a hair of slack keeps containment tests honest. */
const CONTAINMENT_EPSILON = 1e-12;

function contains(outer: GroundRect, inner: GroundRect): boolean {
  return (
    outer.minX <= inner.minX + CONTAINMENT_EPSILON &&
    outer.minY <= inner.minY + CONTAINMENT_EPSILON &&
    outer.maxX >= inner.maxX - CONTAINMENT_EPSILON &&
    outer.maxY >= inner.maxY - CONTAINMENT_EPSILON
  );
}

/**
 * R-tree of the tiles resident in the atlas, by ground extent, so a tile
 * still loading can borrow the picture of a cached ancestor (one tile that
 * covers it) or of cached descendants (tiles that lie inside it).
 */
export class ResidentTileIndex implements TileCoverage {
  private readonly tree = new RBush<ResidentTile>(RBUSH_MAX_ENTRIES);
  private readonly byKey = new Map<TileKey, ResidentTile>();

  insert(coord: TileCoord): void {
    const key = tileKeyOf(coord);
    if (this.byKey.has(key)) {
      return;
    }
    const item: ResidentTile = { ...tileBounds(coord), key, coord };
    this.byKey.set(key, item);
    this.tree.insert(item);
  }

  remove(key: TileKey): void {
    const item = this.byKey.get(key);
    if (item === undefined) {
      return;
    }
    this.byKey.delete(key);
    this.tree.remove(item);
  }

  get size(): number {
    return this.byKey.size;
  }

  nearestAncestor(coord: TileCoord): TileCoord | undefined {
    const bounds = tileBounds(coord);
    let nearest: ResidentTile | undefined;
    for (const item of this.tree.search(bounds)) {
      if (
        item.coord.z < coord.z &&
        contains(item, bounds) &&
        (nearest?.coord.z ?? -1) < item.coord.z
      ) {
        nearest = item;
      }
    }
    return nearest?.coord;
  }

  descendants(coord: TileCoord, maxDepth: number): readonly TileCoord[] {
    const bounds = tileBounds(coord);
    return this.tree
      .search(bounds)
      .filter(
        item =>
          item.coord.z > coord.z && item.coord.z <= coord.z + maxDepth && contains(bounds, item)
      )
      .map(item => item.coord);
  }
}
