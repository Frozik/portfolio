import { BUILDING_TILE_ZOOM, BUILDINGS_MIN_ZOOM } from './constants';
import type { TileKey } from './tile-key';
import { ancestorAt, tileKeyOf } from './tile-key';
import type { SelectedTile } from './tile-selection';
import { compareByScreenDistance } from './tile-selection';

/**
 * The building tiles a frame needs: the distinct z14 ancestors of the
 * raster tiles finer than z14, once the camera is close enough for
 * buildings at all. A building tile inherits the best priority of the
 * raster tiles it covers, so the schedule fills the screen centre first.
 */
export function selectBuildingTiles(
  selected: readonly SelectedTile[],
  zoom: number
): readonly SelectedTile[] {
  if (zoom < BUILDINGS_MIN_ZOOM) {
    return [];
  }
  const byKey = new Map<TileKey, SelectedTile>();
  for (const tile of selected) {
    if (tile.coord.z <= BUILDING_TILE_ZOOM) {
      continue;
    }
    const coord = ancestorAt(tile.coord, BUILDING_TILE_ZOOM);
    const key = tileKeyOf(coord);
    const known = byKey.get(key);
    byKey.set(
      key,
      known === undefined
        ? { key, coord, edgePx: tile.edgePx, screenDistancePx: tile.screenDistancePx }
        : {
            ...known,
            edgePx: Math.max(known.edgePx, tile.edgePx),
            screenDistancePx: Math.min(known.screenDistancePx, tile.screenDistancePx),
          }
    );
  }
  return [...byKey.values()].sort(compareByScreenDistance);
}
