import tzLookup from '@photostructure/tz-lookup';

import { isValidTimeZoneId } from '../domain/sun/time-zone';

/**
 * The IANA zone a point on Earth keeps, read from the boundary table bundled
 * with the lookup — no network, so picking a place on the map can set the sun
 * study's clock offline like everything else in the feature. A point the table
 * cannot place, or a name this runtime does not know, answers `undefined`
 * rather than a guess the sun study would then run on.
 */
export function lookupTimeZoneId(
  latitudeDegrees: number,
  longitudeDegrees: number
): string | undefined {
  // `tz-lookup` throws for coordinates outside ±90°/±180° instead of answering.
  try {
    const timeZoneId = tzLookup(latitudeDegrees, longitudeDegrees);

    return isValidTimeZoneId(timeZoneId) ? timeZoneId : undefined;
  } catch {
    return undefined;
  }
}
