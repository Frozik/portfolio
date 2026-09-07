import { MICRODEGREES } from './format';

const EARTH_RADIUS_METRES = 6_371_008.8;
const DEGREES_TO_RADIANS = Math.PI / 180;

/** Great-circle distance between two points given in degrees. */
export function haversineMetres(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const phi1 = lat1 * DEGREES_TO_RADIANS;
  const phi2 = lat2 * DEGREES_TO_RADIANS;
  const dPhi = (lat2 - lat1) * DEGREES_TO_RADIANS;
  const dLambda = (lon2 - lon1) * DEGREES_TO_RADIANS;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function toDegrees(microdegrees: number): number {
  return microdegrees / MICRODEGREES;
}

export function toMicrodegrees(degrees: number): number {
  return Math.round(degrees * MICRODEGREES);
}
