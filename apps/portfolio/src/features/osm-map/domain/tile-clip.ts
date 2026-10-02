import type { MultiPolygon } from '@frozik/utils/geometry/polygonTypes';
import type { Vector2 } from '@frozik/utils/math/vector2';

import { polygonsOfTileRings } from './building-footprint';
import { signedArea } from './ring-area';
import type { TileGrid, TileRing } from './tile-grid';

const MIN_RING_VERTEX_COUNT = 3;

type Edge = 'west' | 'east' | 'north' | 'south';
const EDGES: readonly Edge[] = ['west', 'east', 'north', 'south'];

/** The square a ring is cut to, in tile units. */
interface Bounds {
  readonly min: number;
  readonly max: number;
}

function inside(point: Vector2, edge: Edge, { min, max }: Bounds): boolean {
  switch (edge) {
    case 'west':
      return point.x >= min;
    case 'east':
      return point.x <= max;
    case 'north':
      return point.y >= min;
    case 'south':
      return point.y <= max;
  }
}

function crossing(from: Vector2, to: Vector2, edge: Edge, { min, max }: Bounds): Vector2 {
  if (edge === 'west' || edge === 'east') {
    const x = edge === 'west' ? min : max;
    return { x, y: from.y + ((to.y - from.y) * (x - from.x)) / (to.x - from.x) };
  }
  const y = edge === 'north' ? min : max;
  return { x: from.x + ((to.x - from.x) * (y - from.y)) / (to.y - from.y), y };
}

/** Sutherland–Hodgman for a closed ring: the part beyond the edge is cut off and the ring closed along it. */
function clipAgainst(ring: TileRing, edge: Edge, bounds: Bounds): TileRing {
  const clipped: Vector2[] = [];
  for (let index = 0; index < ring.length; index++) {
    const current = ring[index];
    const previous = ring[(index + ring.length - 1) % ring.length];
    const currentInside = inside(current, edge, bounds);
    if (currentInside !== inside(previous, edge, bounds)) {
      clipped.push(crossing(previous, current, edge, bounds));
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
 * an area covered twice would show — trees planted twice as a thicket along
 * the seam. A surface that must meet its neighbour without a crack asks for
 * a `margin` of overlap instead: meshes quantised per tile never meet
 * exactly. Winding survives the cut; a ring left with no area is gone.
 */
export function clipRingToTile(ring: TileRing, extent: number, margin: number = 0): TileRing {
  const bounds: Bounds = { min: 0 - margin, max: extent + margin };
  const clipped = EDGES.reduce((current, edge) => clipAgainst(current, edge, bounds), ring);
  return clipped.length < MIN_RING_VERTEX_COUNT || signedArea(clipped) === 0 ? [] : clipped;
}

/** The polygons of a feature in plan metres, cut to the tile square or `margin` tile units beyond it. */
export function clippedPolygonsOfTileRings(
  rings: readonly TileRing[],
  grid: TileGrid,
  margin: number = 0
): MultiPolygon {
  return polygonsOfTileRings(
    rings.map(ring => clipRingToTile(ring, grid.extent, margin)),
    grid
  );
}
