import { BUILDING_TILE_ZOOM, MAX_STREET_TILES_IN_VIEW } from './constants';
import type { GroundPoint } from './mercator';
import type { TileKey } from './tile-key';
import { ancestorAt, tileBounds, tileKeyOf } from './tile-key';
import type { SelectedTile } from './tile-selection';

/** From the camera target to the tile's centre on the ground, in world units. */
function groundDistance(tile: SelectedTile, target: GroundPoint): number {
  const bounds = tileBounds(tile.coord);
  return Math.hypot(
    (bounds.minX + bounds.maxX) / 2 - target.x,
    (bounds.minY + bounds.maxY) / 2 - target.y
  );
}

/**
 * The street tiles a frame needs: the distinct z14 tiles under the raster
 * tiles at z14 and finer — the whole picture down to the fog, so a tile
 * near the horizon does not blink in and out as the camera turns. A street
 * tile inherits the best load priority of the raster tiles it covers, but
 * the ones kept past `MAX_STREET_TILES_IN_VIEW` are the nearest to the
 * camera target on the ground, not to the screen centre: a tilted view
 * puts the horizon nearer the middle of the screen than the ground beside
 * the camera, and it is the ground beside the camera that is looked at.
 * Whether buildings show at all is the scene's call, made once for the
 * whole picture.
 */
export function selectStreetTiles(
  selected: readonly SelectedTile[],
  target: GroundPoint
): readonly SelectedTile[] {
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
  return [...byKey.values()]
    .sort((first, second) => groundDistance(first, target) - groundDistance(second, target))
    .slice(0, MAX_STREET_TILES_IN_VIEW);
}
