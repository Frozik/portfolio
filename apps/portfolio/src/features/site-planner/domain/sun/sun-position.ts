import { getPosition } from 'suncalc';
import { Temporal } from 'temporal-polyfill';

import { DEGREES_TO_RADIANS } from '../units';

/** Where the sun stands over the site, in the observer's horizontal frame. */
export interface SunPosition {
  /**
   * Bearing of the sun, clockwise from geographic north — 0 is north, π/2 east,
   * π south. This is SunCalc's own convention, kept as-is so the one place the
   * angle is turned into a direction ({@link computeSunDirection}) is also the
   * one place the convention has to be read.
   */
  readonly azimuthRadians: number;
  /** Apparent height over the horizon; negative once the sun has set. */
  readonly altitudeRadians: number;
}

/**
 * The sun as seen from the site at a given moment. Angles come back in radians
 * while SunCalc answers in degrees: the rest of the feature — the compass, the
 * shape rotations, `DEGREES_TO_RADIANS` — already draws that line at the edge of
 * a library, and trigonometry downstream needs radians anyway.
 */
export function computeSunPosition({
  moment,
  latitudeDegrees,
  longitudeDegrees,
}: {
  readonly moment: Temporal.ZonedDateTime;
  readonly latitudeDegrees: number;
  readonly longitudeDegrees: number;
}): SunPosition {
  const { azimuth, altitude } = getPosition(
    toSunCalcDate(moment),
    latitudeDegrees,
    longitudeDegrees
  );

  return {
    azimuthRadians: azimuth * DEGREES_TO_RADIANS,
    altitudeRadians: altitude * DEGREES_TO_RADIANS,
  };
}

/**
 * The only `Date` this codebase builds, and the reason it is allowed: SunCalc
 * takes and returns instants as `Date` objects, and no amount of Temporal
 * discipline on our side changes a third-party signature. Confining the crossing
 * to this module keeps `Date` out of the domain, the store and the UI — every
 * other module speaks `Temporal.ZonedDateTime` — and leaves one place to change
 * if the library ever grows a Temporal-aware entry point. Biome's
 * `noRestrictedGlobals` ban on `Date` is lifted for this module and
 * `day-window.ts` only (see `biome.json` overrides).
 */
export function toSunCalcDate(moment: Temporal.ZonedDateTime): Date {
  return new Date(moment.epochMilliseconds);
}

/** The way back over the same boundary: a SunCalc instant in the site's zone. */
export function fromSunCalcDate(date: Date, timeZoneId: string): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(timeZoneId);
}
