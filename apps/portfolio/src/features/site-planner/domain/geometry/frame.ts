import type { Path64 } from 'clipper2-ts';

import { SCALE_UNITS_PER_METER } from '../units';
import type { Ring } from './polygon-types';

/**
 * The only bridge between plan metres and the integer grid the polygon clipper
 * works on. Rounding lives here alone so that every boolean, offset and
 * validation step sees exactly the same quantisation of a given coordinate.
 */
export function toClipperPath(ring: Ring): Path64 {
  return ring.map(point => ({
    x: Math.round(point.x * SCALE_UNITS_PER_METER),
    y: Math.round(point.y * SCALE_UNITS_PER_METER),
  }));
}

export function fromClipperPath(path: Path64): Ring {
  return path.map(point => ({
    x: point.x / SCALE_UNITS_PER_METER,
    y: point.y / SCALE_UNITS_PER_METER,
  }));
}

export function toClipperUnits(meters: number): number {
  return Math.round(meters * SCALE_UNITS_PER_METER);
}
