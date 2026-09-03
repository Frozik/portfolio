import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { isPointInMultiPolygon } from '../geometry/polygon-booleans';
import type { MultiPolygon } from '../geometry/polygon-types';
import { distanceToMultiPolygonEdge } from '../geometry/segment-distance';
import type { Meters } from '../units';
import type { Heightfield } from './heightfield';
import { sampleHeight } from './heightfield';

/** One graded building pad: where it is and what elevation it holds. */
export interface GradedPad {
  readonly polygons: MultiPolygon;
  readonly elevation: Meters;
}

/**
 * How far past a pad's edge the ground blends back into the natural terrain.
 * Anything standing inside this ring — a post beside the цоколь, a utility
 * entry, the start of a trench — stands on made ground, not on the survey.
 */
export const PAD_BLEND_METERS: Meters = 1.5;

/**
 * The DESIGN grade: the ground as it will be after the pads are cut and
 * filled, not the virgin survey (plan O-S8). The heightfield interpolates the
 * elevation marks — the land before anyone built on it — so reading it
 * beside a house on a slope answers a question nobody asked: a canopy post
 * half a metre from the цоколь would float or sink by the whole cut depth.
 *
 * Inside a pad the answer is the pad's own elevation; within `PAD_BLEND_METERS`
 * of its edge the two blend linearly; beyond that it is the terrain itself.
 */
export function groundElevationAt(
  field: Heightfield,
  pads: readonly GradedPad[],
  point: Vector2
): Meters {
  const natural = sampleHeight(field, point.x, point.y);
  const nearest = nearestPadInfluence(pads, point);

  if (isNil(nearest)) {
    return natural;
  }

  if (nearest.distance <= 0) {
    return nearest.elevation;
  }

  const blend = Math.min(1, nearest.distance / PAD_BLEND_METERS);

  return nearest.elevation * (1 - blend) + natural * blend;
}

function nearestPadInfluence(
  pads: readonly GradedPad[],
  point: Vector2
): { readonly elevation: Meters; readonly distance: number } | undefined {
  let best: { elevation: Meters; distance: number } | undefined;

  for (const pad of pads) {
    if (isPointInMultiPolygon(pad.polygons, point)) {
      return { elevation: pad.elevation, distance: 0 };
    }

    const distance = distanceToMultiPolygonEdge(pad.polygons, point);

    if (distance < PAD_BLEND_METERS && (isNil(best) || distance < best.distance)) {
      best = { elevation: pad.elevation, distance };
    }
  }

  return best;
}
