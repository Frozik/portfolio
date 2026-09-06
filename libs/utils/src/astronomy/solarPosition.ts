import type { Temporal } from 'temporal-polyfill';

import {
  altitudeRadians,
  atmosphericRefractionRadians,
  azimuthDegrees,
  daysSinceJ2000,
  DEGREES_TO_RADIANS,
  localSiderealTime,
  sunEquatorialCoordinates,
  toTerrestrialDays,
} from './solarCoordinates';

export interface SolarPosition {
  /** Clockwise from geographic north: 0 north, 90 east, 180 south, 270 west. */
  readonly azimuthDegrees: number;
  /** Apparent (refraction-corrected) height over the horizon; negative once the Sun has set. */
  readonly altitudeDegrees: number;
}

/** Where the Sun stands over a point on Earth at an instant. */
export function computeSolarPosition(
  instant: Temporal.Instant,
  latitudeDegrees: number,
  longitudeDegrees: number
): SolarPosition {
  const westLongitude = DEGREES_TO_RADIANS * -longitudeDegrees;
  const latitude = DEGREES_TO_RADIANS * latitudeDegrees;
  const daysUt = daysSinceJ2000(instant);
  const sun = sunEquatorialCoordinates(toTerrestrialDays(daysUt));
  const hourAngle = localSiderealTime(daysUt, westLongitude) - sun.rightAscensionRadians;
  const altitude = altitudeRadians(hourAngle, latitude, sun.declinationRadians);

  return {
    azimuthDegrees: azimuthDegrees(hourAngle, latitude, sun.declinationRadians),
    altitudeDegrees: (altitude + atmosphericRefractionRadians(altitude)) / DEGREES_TO_RADIANS,
  };
}
