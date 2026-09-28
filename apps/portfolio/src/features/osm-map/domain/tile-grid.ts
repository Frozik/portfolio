import type { Ring } from '@frozik/utils/geometry/polygonTypes';
import type { Vector2 } from '@frozik/utils/math/vector2';

import { DEGREES_PER_RADIAN, EARTH_CIRCUMFERENCE_M } from './constants';
import type { GroundPoint } from './mercator';
import { worldToLonLat } from './mercator';
import type { TileCoord } from './tile-key';
import { tileBounds, tileWorldSize } from './tile-key';

/** A ring or line as the vector tile stores it: integer tile units from the north-west corner, y down. */
export type TileRing = readonly Vector2[];

/** How the tile's integer grid maps onto the ground. */
export interface TileGrid {
  /** Units across the tile, `4096` in every Mapbox vector tile. */
  readonly extent: number;
  readonly tileSizeM: number;
}

/** Metres in one Mercator unit at the point's latitude. */
export function metresPerUnitAtPoint(point: GroundPoint): number {
  const { lat } = worldToLonLat(point);
  return EARTH_CIRCUMFERENCE_M * Math.cos(lat / DEGREES_PER_RADIAN);
}

/** Metres in one Mercator unit at the tile's latitude, where the map's vertical axis must agree with the ground. */
export function metresPerUnitAt(coord: TileCoord): number {
  const bounds = tileBounds(coord);
  return metresPerUnitAtPoint({ x: 0, y: (bounds.minY + bounds.maxY) / 2 });
}

export function tileGridOf(coord: TileCoord, extent: number): TileGrid {
  return { extent, tileSizeM: tileWorldSize(coord.z) * metresPerUnitAt(coord) };
}

/** Tile units (y down) to plan metres from the tile's north-west corner (x east, y north). */
export function toPlan(points: TileRing, grid: TileGrid): Ring {
  const scale = grid.tileSizeM / grid.extent;
  return points.map(point => ({ x: point.x * scale, y: -point.y * scale }));
}
