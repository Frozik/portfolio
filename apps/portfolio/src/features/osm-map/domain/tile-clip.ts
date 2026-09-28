import type { MultiPolygon } from '@frozik/utils/geometry/polygonTypes';
import type { Vector2 } from '@frozik/utils/math/vector2';

import { polygonsOfTileRings } from './building-footprint';
import { signedArea } from './ring-area';
import type { TileGrid, TileRing } from './tile-grid';

const MIN_RING_VERTEX_COUNT = 3;

type Edge = 'west' | 'east' | 'north' | 'south';
const EDGES: readonly Edge[] = ['west', 'east', 'north', 'south'];

function inside(point: Vector2, edge: Edge, extent: number): boolean {
  switch (edge) {
    case 'west':
      return point.x >= 0;
    case 'east':
      return point.x <= extent;
    case 'north':
      return point.y >= 0;
    case 'south':
      return point.y <= extent;
  }
}

function crossing(from: Vector2, to: Vector2, edge: Edge, extent: number): Vector2 {
  if (edge === 'west' || edge === 'east') {
    const x = edge === 'west' ? 0 : extent;
    return { x, y: from.y + ((to.y - from.y) * (x - from.x)) / (to.x - from.x) };
  }
  const y = edge === 'north' ? 0 : extent;
  return { x: from.x + ((to.x - from.x) * (y - from.y)) / (to.y - from.y), y };
}

/** Sutherland–Hodgman for a closed ring: the part beyond the edge is cut off and the ring closed along it. */
function clipAgainst(ring: TileRing, edge: Edge, extent: number): TileRing {
  const clipped: Vector2[] = [];
  for (let index = 0; index < ring.length; index++) {
    const current = ring[index];
    const previous = ring[(index + ring.length - 1) % ring.length];
    const currentInside = inside(current, edge, extent);
    if (currentInside !== inside(previous, edge, extent)) {
      clipped.push(crossing(previous, current, edge, extent));
    }
    if (currentInside) {
      clipped.push(current);
    }
  }
  return clipped;
}

/**
 * Cuts a ring to the tile square, `[0, extent]` on both axes: the tile
 * carries a buffer beyond its edge, which the neighbour carries too, and
 * an area covered twice would show — water blended twice as a darker band,
 * trees planted twice as a thicket along the seam. Winding survives the
 * cut; a ring left with no area is gone.
 */
export function clipRingToTile(ring: TileRing, extent: number): TileRing {
  const clipped = EDGES.reduce((current, edge) => clipAgainst(current, edge, extent), ring);
  return clipped.length < MIN_RING_VERTEX_COUNT || signedArea(clipped) === 0 ? [] : clipped;
}

/** The polygons of a feature in plan metres, cut to the tile square. */
export function clippedPolygonsOfTileRings(
  rings: readonly TileRing[],
  grid: TileGrid
): MultiPolygon {
  return polygonsOfTileRings(
    rings.map(ring => clipRingToTile(ring, grid.extent)),
    grid
  );
}
