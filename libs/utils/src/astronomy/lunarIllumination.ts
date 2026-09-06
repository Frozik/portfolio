import type { Temporal } from 'temporal-polyfill';

import { moonEquatorialCoordinates } from './lunarCoordinates';
import {
  daysSinceJ2000,
  DEGREES_TO_RADIANS,
  sunEquatorialCoordinates,
  toTerrestrialDays,
} from './solarCoordinates';

export interface LunarIllumination {
  /** The lit share of the disc: 0 at new moon, 1 at full moon. */
  readonly fraction: number;
  /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  readonly phase: number;
  /** Position angle of the bright limb, degrees (Meeus 48.5). */
  readonly brightLimbAngleDegrees: number;
  /** True from new to full, false from full to new. */
  readonly isWaxing: boolean;
}

/** The mean Earth–Sun distance, km; the Moon's phase depends on the ratio to its own. */
const EARTH_SUN_DISTANCE_KM = 149_598_000;

/** Meeus ch. 48: the Moon's phase from the angle between it and the Sun as seen from Earth. */
export function computeLunarIllumination(instant: Temporal.Instant): LunarIllumination {
  const daysTt = toTerrestrialDays(daysSinceJ2000(instant));
  const sun = sunEquatorialCoordinates(daysTt);
  const moon = moonEquatorialCoordinates(daysTt);
  const raDifference = sun.rightAscensionRadians - moon.rightAscensionRadians;
  // 48.2: the geocentric elongation of the Moon from the Sun
  const elongation = Math.acos(
    Math.sin(sun.declinationRadians) * Math.sin(moon.declinationRadians) +
      Math.cos(sun.declinationRadians) * Math.cos(moon.declinationRadians) * Math.cos(raDifference)
  );
  // 48.3: the phase angle, with the Sun's distance set against the Moon's
  const phaseAngle = Math.atan2(
    EARTH_SUN_DISTANCE_KM * Math.sin(elongation),
    moon.distanceKm - EARTH_SUN_DISTANCE_KM * Math.cos(elongation)
  );
  // 48.5: the position angle of the bright limb
  const brightLimbAngle = Math.atan2(
    Math.cos(sun.declinationRadians) * Math.sin(raDifference),
    Math.sin(sun.declinationRadians) * Math.cos(moon.declinationRadians) -
      Math.cos(sun.declinationRadians) * Math.sin(moon.declinationRadians) * Math.cos(raDifference)
  );
  // The bright limb leading (a negative angle) means the lit share is growing.
  const isWaxing = brightLimbAngle < 0;

  return {
    // 48.1; the extrema are reached only at perfect syzygy, i.e. during eclipses
    fraction: (1 + Math.cos(phaseAngle)) / 2,
    phase: 0.5 + (0.5 * phaseAngle * (isWaxing ? -1 : 1)) / Math.PI,
    brightLimbAngleDegrees: brightLimbAngle / DEGREES_TO_RADIANS,
    isWaxing,
  };
}
