import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { DEFAULT_SITE_LENGTH_METERS, DEFAULT_SITE_WIDTH_METERS } from '../constants';
import { computeMultiPolygonBounds } from '../geometry/bounding-box';
import { evaluateComposition } from '../geometry/evaluate-composition';
import type { MultiPolygon } from '../geometry/polygon-types';
import type { Building } from './building';

const FREE_SPOT_STEP_METERS = 3;
const FREE_SPOT_ATTEMPTS = 8;

/**
 * Where a new ready building lands: the plot centre, stepped rightward past
 * whatever already stands there — never on top of an existing footprint.
 */
export function findFreeBuildingSpot(
  building: Building,
  boundaryPolygons: MultiPolygon,
  existing: readonly Building[]
): Vector2 {
  const templateBounds = computeMultiPolygonBounds(evaluateComposition(building.composition));
  const widthMeters = isNil(templateBounds)
    ? FREE_SPOT_STEP_METERS
    : templateBounds.maxX - templateBounds.minX;
  const plotBounds = computeMultiPolygonBounds(boundaryPolygons);
  const start: Vector2 = isNil(plotBounds)
    ? { x: DEFAULT_SITE_WIDTH_METERS / 2, y: DEFAULT_SITE_LENGTH_METERS / 2 }
    : { x: (plotBounds.minX + plotBounds.maxX) / 2, y: (plotBounds.minY + plotBounds.maxY) / 2 };
  const taken = existing.map(existing =>
    computeMultiPolygonBounds(evaluateComposition(existing.composition))
  );

  for (let attempt = 0; attempt < FREE_SPOT_ATTEMPTS; attempt += 1) {
    const candidate: Vector2 = {
      x: start.x + attempt * (widthMeters + FREE_SPOT_STEP_METERS),
      y: start.y,
    };
    const overlaps = taken.some(
      bounds =>
        !isNil(bounds) &&
        Math.abs(candidate.x - (bounds.minX + bounds.maxX) / 2) < widthMeters &&
        Math.abs(candidate.y - (bounds.minY + bounds.maxY) / 2) <
          (bounds.maxY - bounds.minY + FREE_SPOT_STEP_METERS) / 2 + widthMeters / 2
    );

    if (!overlaps) {
      return candidate;
    }
  }

  return start;
}
