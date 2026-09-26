import { clamp } from 'lodash-es';

import { DEGREES_PER_RADIAN } from './constants';

/** A point on the Web Mercator unit square: `x` east, `y` south, both in [0, 1]. */
export interface GroundPoint {
  readonly x: number;
  readonly y: number;
}

export interface LonLat {
  readonly lon: number;
  readonly lat: number;
}

/** Web Mercator is undefined at the poles; this is where the unit square ends. */
export const MAX_LATITUDE = 85.05112878;
const HALF_TURN_DEGREES = 180;

export function lonLatToWorld({ lon, lat }: LonLat): GroundPoint {
  const latitudeRadians = clamp(lat, -MAX_LATITUDE, MAX_LATITUDE) / DEGREES_PER_RADIAN;
  return {
    x: (lon + HALF_TURN_DEGREES) / (2 * HALF_TURN_DEGREES),
    y: (1 - Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2)) / Math.PI) / 2,
  };
}

export function worldToLonLat({ x, y }: GroundPoint): LonLat {
  return {
    lon: x * 2 * HALF_TURN_DEGREES - HALF_TURN_DEGREES,
    lat: (2 * Math.atan(Math.exp((1 - 2 * y) * Math.PI)) - Math.PI / 2) * DEGREES_PER_RADIAN,
  };
}
