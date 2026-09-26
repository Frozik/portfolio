import { BUILDING_TILE_ZOOM, MAX_STREET_TILES_IN_VIEW } from './constants';
import type { TileKey } from './tile-key';
import { ancestorAt, tileKeyOf } from './tile-key';
import type { SelectedTile } from './tile-selection';
import { compareByScreenDistance } from './tile-selection';

/**
 * The street tiles a frame needs: the distinct z14 tiles under the raster
 * tiles at z14 and finer — the whole picture down to the fog, so a tile
 * near the horizon does not blink in and out as the camera turns. A street
 * tile inherits the best priority of the raster tiles it covers, so the
 * schedule fills the screen centre first, and the farthest are left out
 * past `MAX_STREET_TILES_IN_VIEW`. Whether buildings show at all is the
 * scene's call, made once for the whole picture.
 */
export function selectStreetTiles(selected: readonly SelectedTile[]): readonly SelectedTile[] {
  const byKey = new Map<TileKey, SelectedTile>();
  for (const tile of selected) {
    if (tile.coord.z < BUILDING_TILE_ZOOM) {
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
  return [...byKey.values()].sort(compareByScreenDistance).slice(0, MAX_STREET_TILES_IN_VIEW);
}
