import type { Vector2 } from '@frozik/utils/math/vector2';

import type { MultiPolygon, Ring } from './polygon-types';

/** Below this the shoelace sum is noise, not an area to weight a centroid by. */
const MIN_SIGNED_AREA_SQUARE_METERS = 1e-9;
/** The shoelace centroid divides the moment by six times the signed area. */
const CENTROID_AREA_FACTOR = 6;
const SIGNED_AREA_FACTOR = 2;

/** Running shoelace sums over every ring of a figure. */
interface CentroidAccumulator {
  signedAreaSum: number;
  momentX: number;
  momentY: number;
  vertexSumX: number;
  vertexSumY: number;
  vertexCount: number;
}

/**
 * Area-weighted centroid of a multipolygon, in plan metres.
 *
 * Holes need no special handling: they wind the other way (see {@link Ring}), so
 * the same shoelace accumulation that gives the signed area of the material
 * gives the centroid of the material alone. A figure with no area to weight —
 * a single point, a collapsed ring — falls back to the average of its vertices,
 * which is the only answer left that still lies on the figure.
 */
export function computeMultiPolygonCentroid(polygons: MultiPolygon): Vector2 | undefined {
  const accumulator: CentroidAccumulator = {
    signedAreaSum: 0,
    momentX: 0,
    momentY: 0,
    vertexSumX: 0,
    vertexSumY: 0,
    vertexCount: 0,
  };

  for (const polygon of polygons) {
    accumulateRing(accumulator, polygon.outer);

    for (const hole of polygon.holes) {
      accumulateRing(accumulator, hole);
    }
  }

  if (accumulator.vertexCount === 0) {
    return undefined;
  }

  const signedArea = accumulator.signedAreaSum / SIGNED_AREA_FACTOR;

  if (Math.abs(signedArea) < MIN_SIGNED_AREA_SQUARE_METERS) {
    return {
      x: accumulator.vertexSumX / accumulator.vertexCount,
      y: accumulator.vertexSumY / accumulator.vertexCount,
    };
  }

  const scale = CENTROID_AREA_FACTOR * signedArea;

  return { x: accumulator.momentX / scale, y: accumulator.momentY / scale };
}

function accumulateRing(accumulator: CentroidAccumulator, ring: Ring): void {
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    const cross = start.x * end.y - end.x * start.y;

    accumulator.signedAreaSum += cross;
    accumulator.momentX += (start.x + end.x) * cross;
    accumulator.momentY += (start.y + end.y) * cross;
    accumulator.vertexSumX += start.x;
    accumulator.vertexSumY += start.y;
    accumulator.vertexCount += 1;
  }
}
