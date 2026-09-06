import { computeSolarPosition } from '@frozik/utils/astronomy/solarPosition';
import type { Temporal } from 'temporal-polyfill';

import { DEGREES_TO_RADIANS } from '../units';

/** Where the sun stands over the site, in the observer's horizontal frame. */
export interface SunPosition {
  /**
   * Bearing of the sun, clockwise from geographic north — 0 is north, π/2 east,
   * π south — so the one place the angle is turned into a direction
   * ({@link computeSunDirection}) is also the one place the convention is read.
   */
  readonly azimuthRadians: number;
  /** Apparent height over the horizon; negative once the sun has set. */
  readonly altitudeRadians: number;
}

/** The sun as seen from the site at a given moment; trigonometry downstream wants radians. */
export function computeSunPosition({
  moment,
  latitudeDegrees,
  longitudeDegrees,
}: {
  readonly moment: Temporal.ZonedDateTime;
  readonly latitudeDegrees: number;
  readonly longitudeDegrees: number;
}): SunPosition {
  const { azimuthDegrees, altitudeDegrees } = computeSolarPosition(
    moment.toInstant(),
    latitudeDegrees,
    longitudeDegrees
  );

  return {
    azimuthRadians: azimuthDegrees * DEGREES_TO_RADIANS,
    altitudeRadians: altitudeDegrees * DEGREES_TO_RADIANS,
  };
}
