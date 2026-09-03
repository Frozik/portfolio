import type { Slab } from '../model/slabs';
import { unionPolygons } from './polygon-booleans';
import type { MultiPolygon, PolygonWithHoles } from './polygon-types';
import { polygonizeShape } from './polygonize-shape';

/** One slab as a plan polygon: the ring of whatever primitive it was drawn as. */
export function slabPolygon(slab: Slab): PolygonWithHoles {
  return { outer: polygonizeShape(slab), holes: [] };
}

/**
 * The floor a storey's slabs describe — their union, so two slabs meeting at
 * an edge read as one floor rather than as a seam.
 */
export function slabsOutline(slabs: readonly Slab[]): MultiPolygon {
  return unionPolygons(slabs.map(slab => [slabPolygon(slab)]));
}
