import type { Temporal } from 'temporal-polyfill';

import { moonEquatorialCoordinates } from './lunarCoordinates';
import {
  altitudeRadians,
  atmosphericRefractionRadians,
  azimuthDegrees,
  daysSinceJ2000,
  DEGREES_TO_RADIANS,
  localSiderealTime,
  toTerrestrialDays,
} from './solarCoordinates';

export interface LunarPosition {
  /** Clockwise from geographic north: 0 north, 90 east, 180 south, 270 west. */
  readonly azimuthDegrees: number;
  /** Apparent (refraction-corrected, topocentric) height over the horizon. */
  readonly altitudeDegrees: number;
  readonly distanceKm: number;
  /** Meeus 14.1: how the Moon's north pole tilts against the local vertical. */
  readonly parallacticAngleDegrees: number;
}

/** The Earth's equatorial radius, km — what the Moon's parallax is measured against. */
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.14;

/** Where the Moon stands over a point on Earth at an instant. */
export function computeLunarPosition(
  instant: Temporal.Instant,
  latitudeDegrees: number,
  longitudeDegrees: number
): LunarPosition {
  const westLongitude = DEGREES_TO_RADIANS * -longitudeDegrees;
  const latitude = DEGREES_TO_RADIANS * latitudeDegrees;
  const daysUt = daysSinceJ2000(instant);
  const moon = moonEquatorialCoordinates(toTerrestrialDays(daysUt));
  const hourAngle = localSiderealTime(daysUt, westLongitude) - moon.rightAscensionRadians;
  const geocentricAltitude = altitudeRadians(hourAngle, latitude, moon.declinationRadians);
  // Meeus ch. 40: the parallax lowers the Moon along its vertical circle and
  // leaves the azimuth alone — sin p = (R⊕ / Δ) · cos h.
  const topocentricAltitude =
    geocentricAltitude -
    Math.asin((EARTH_EQUATORIAL_RADIUS_KM / moon.distanceKm) * Math.cos(geocentricAltitude));
  const parallacticAngle = Math.atan2(
    Math.sin(hourAngle),
    Math.tan(latitude) * Math.cos(moon.declinationRadians) -
      Math.sin(moon.declinationRadians) * Math.cos(hourAngle)
  );

  return {
    azimuthDegrees: azimuthDegrees(hourAngle, latitude, moon.declinationRadians),
    altitudeDegrees:
      (topocentricAltitude + atmosphericRefractionRadians(topocentricAltitude)) /
      DEGREES_TO_RADIANS,
    distanceKm: moon.distanceKm,
    parallacticAngleDegrees: parallacticAngle / DEGREES_TO_RADIANS,
  };
}
