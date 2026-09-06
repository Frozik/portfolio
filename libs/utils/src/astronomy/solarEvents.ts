import type { Temporal } from 'temporal-polyfill';

import { SECONDS_PER_DAY } from '../date/constants';
import {
  altitudeRadians,
  ARCMINUTES_PER_DEGREE,
  daysSinceJ2000,
  DEGREES_TO_RADIANS,
  instantAtDaysSinceJ2000,
  localSiderealTime,
  sunEquatorialCoordinates,
  toTerrestrialDays,
  wrapToHalfTurn,
} from './solarCoordinates';

/** Whether the Sun crosses the rise/set horizon at all on that day. */
export type Daylight = 'normal' | 'polar-day' | 'polar-night';

/**
 * The Sun's day at a point on Earth. Every crossing is absent when the Sun does
 * not reach that altitude on that day: at 60° north the nautical twilight never
 * ends around the summer solstice, and past the polar circles the sunrise itself
 * goes missing.
 */
export interface SolarEvents {
  /** The Sun's highest and lowest points of that solar day. */
  readonly solarNoon: Temporal.Instant;
  readonly nadir: Temporal.Instant;
  readonly daylight: Daylight;
  /** The upper limb on the horizon. */
  readonly sunrise: Temporal.Instant | undefined;
  readonly sunset: Temporal.Instant | undefined;
  /** The lower limb clears the horizon: the whole disc is up. */
  readonly sunriseEnd: Temporal.Instant | undefined;
  readonly sunsetStart: Temporal.Instant | undefined;
  /** Civil twilight: the Sun 6° under the horizon. */
  readonly civilDawn: Temporal.Instant | undefined;
  readonly civilDusk: Temporal.Instant | undefined;
  /** Nautical twilight: 12° under; the horizon is still discernible at sea. */
  readonly nauticalDawn: Temporal.Instant | undefined;
  readonly nauticalDusk: Temporal.Instant | undefined;
  /** Astronomical twilight: 18° under; past it the sky is fully dark. */
  readonly astronomicalDawn: Temporal.Instant | undefined;
  readonly astronomicalDusk: Temporal.Instant | undefined;
  /** The photographers' golden hour: the Sun under 6° over the horizon. */
  readonly goldenHourEnd: Temporal.Instant | undefined;
  readonly goldenHour: Temporal.Instant | undefined;
}

export interface SolarEventOptions {
  /** The observer's height over the surrounding horizon; a hill or a tower sees the Sun earlier. */
  readonly observerHeightMeters?: number;
}

/**
 * The altitudes the events are defined at, per the U.S. Naval Observatory
 * (https://aa.usno.navy.mil/faq/RST_defs): a rise or a set is the Sun's upper
 * limb on the horizon, which with 34′ of refraction at the horizon and a 16′
 * mean semidiameter puts its centre 50′ below (Meeus ch. 15); the disc has
 * fully risen once the lower limb clears it; the three twilights end 6°, 12°
 * and 18° under the horizon. The golden hour is a photographic convention.
 */
const HORIZON_REFRACTION_ARCMINUTES = 34;
const SUN_SEMIDIAMETER_ARCMINUTES = 16;
const RISE_SET_ALTITUDE_DEGREES =
  -(HORIZON_REFRACTION_ARCMINUTES + SUN_SEMIDIAMETER_ARCMINUTES) / ARCMINUTES_PER_DEGREE;
const WHOLE_DISC_ALTITUDE_DEGREES =
  -(HORIZON_REFRACTION_ARCMINUTES - SUN_SEMIDIAMETER_ARCMINUTES) / ARCMINUTES_PER_DEGREE;
const CIVIL_TWILIGHT_ALTITUDE_DEGREES = -6;
const NAUTICAL_TWILIGHT_ALTITUDE_DEGREES = -12;
const ASTRONOMICAL_TWILIGHT_ALTITUDE_DEGREES = -18;
const GOLDEN_HOUR_ALTITUDE_DEGREES = 6;

/**
 * Standing above the horizon lowers it: the dip is 2.076′ per square root of the
 * height in metres, the elevation correction of the sunrise equation
 * (https://en.wikipedia.org/wiki/Sunrise_equation).
 */
const HORIZON_DIP_ARCMINUTES_PER_ROOT_METER = 2.076;

/**
 * Meeus refines a transit or a crossing "until the corrections are small"; the
 * results are read to the minute, so one second of time is small, and the
 * corrections shrink so fast that a handful of passes is a safety bound.
 */
const REFINEMENT_TOLERANCE_DAYS = 1 / SECONDS_PER_DAY;
const MAX_REFINEMENT_PASSES = 5;
/**
 * A numerical tolerance, not a physical one (SunCalc's choice): below it the
 * altitude no longer changes with the hour angle — the Sun grazes the horizon —
 * and Meeus' altitude correction would divide by nothing.
 */
const GRAZING_SIN_HOUR_ANGLE = 1e-6;
/**
 * The seed of the transit search: the mean solar noon at longitude 0 sits this
 * fraction of a day past the J2000 epoch's noon — the `J* = n + 0.0009 − lw/360`
 * of the sunrise equation (https://en.wikipedia.org/wiki/Sunrise_equation),
 * which the refinement below then corrects for the actual date.
 */
const TRANSIT_OFFSET_DAYS = 0.0009;
const HALF_DAY = 0.5;
const FULL_TURN = 2 * Math.PI;

interface SolarDay {
  readonly transit: number;
  readonly westLongitude: number;
  readonly latitude: number;
  readonly transitDeclination: number;
  readonly horizonDipDegrees: number;
}

/** Refines a transit so the Sun's local hour angle is zero (Meeus 15.2). */
function refineTransit(daysUt: number, westLongitude: number): number {
  let transit = daysUt;

  for (let pass = 0; pass < MAX_REFINEMENT_PASSES; pass++) {
    const hourAngle = wrapToHalfTurn(
      localSiderealTime(transit, westLongitude) -
        sunEquatorialCoordinates(toTerrestrialDays(transit)).rightAscensionRadians
    );
    const correction = hourAngle / FULL_TURN;

    transit -= correction;

    if (Math.abs(correction) < REFINEMENT_TOLERANCE_DAYS) {
      break;
    }
  }

  return transit;
}

/**
 * The day the Sun reaches an altitude on one side of the transit (−1 before,
 * +1 after), from the hour angle at transit with Meeus' altitude correction;
 * `undefined` when it stays above or below that altitude all day.
 */
function crossingDay(day: SolarDay, altitudeDegrees: number, side: -1 | 1): number | undefined {
  const { transit, westLongitude, latitude, transitDeclination } = day;
  const target = (altitudeDegrees + day.horizonDipDegrees) * DEGREES_TO_RADIANS;
  const cosHourAngle =
    (Math.sin(target) - Math.sin(latitude) * Math.sin(transitDeclination)) /
    (Math.cos(latitude) * Math.cos(transitDeclination));

  if (cosHourAngle < -1 || cosHourAngle > 1) {
    return undefined;
  }

  let crossing = transit + (side * Math.acos(cosHourAngle)) / FULL_TURN;

  for (let pass = 0; pass < MAX_REFINEMENT_PASSES; pass++) {
    const sun = sunEquatorialCoordinates(toTerrestrialDays(crossing));
    const hourAngle = wrapToHalfTurn(
      localSiderealTime(crossing, westLongitude) - sun.rightAscensionRadians
    );
    const altitude = altitudeRadians(hourAngle, latitude, sun.declinationRadians);
    const sinHourAngle =
      Math.cos(latitude) * Math.cos(sun.declinationRadians) * Math.sin(hourAngle);

    if (Math.abs(sinHourAngle) < GRAZING_SIN_HOUR_ANGLE) {
      break;
    }

    const correction = (altitude - target) / (FULL_TURN * sinHourAngle);

    crossing += correction;

    if (Math.abs(correction) < REFINEMENT_TOLERANCE_DAYS) {
      break;
    }
  }

  return crossing;
}

function crossingInstant(
  day: SolarDay,
  altitudeDegrees: number,
  side: -1 | 1
): Temporal.Instant | undefined {
  const crossing = crossingDay(day, altitudeDegrees, side);

  return crossing === undefined ? undefined : instantAtDaysSinceJ2000(crossing);
}

/** Polar day or night: which side of the rise/set altitude the Sun keeps to at its highest. */
function resolveDaylight(day: SolarDay): Daylight {
  const noonAltitude = altitudeRadians(0, day.latitude, day.transitDeclination);
  const riseSetAltitude = (RISE_SET_ALTITUDE_DEGREES + day.horizonDipDegrees) * DEGREES_TO_RADIANS;

  if (crossingDay(day, RISE_SET_ALTITUDE_DEGREES, -1) !== undefined) {
    return 'normal';
  }

  return noonAltitude > riseSetAltitude ? 'polar-day' : 'polar-night';
}

/**
 * The Sun's events of the solar day an instant falls in, at a point on Earth.
 * The day is anchored to the instant's UTC date whatever its time of day, then
 * offset to the nearest local solar noon (Meeus ch. 15; the same method as
 * NOAA's calculator, https://gml.noaa.gov/grad/solcalc/calcdetails.html).
 */
export function computeSolarEvents(
  instant: Temporal.Instant,
  latitudeDegrees: number,
  longitudeDegrees: number,
  { observerHeightMeters = 0 }: SolarEventOptions = {}
): SolarEvents {
  const westLongitude = DEGREES_TO_RADIANS * -longitudeDegrees;
  const noonOffset = TRANSIT_OFFSET_DAYS + westLongitude / FULL_TURN;
  const dayNumber = Math.round(Math.round(daysSinceJ2000(instant)) - noonOffset);
  const transit = refineTransit(dayNumber + noonOffset, westLongitude);
  const day: SolarDay = {
    transit,
    westLongitude,
    latitude: DEGREES_TO_RADIANS * latitudeDegrees,
    transitDeclination: sunEquatorialCoordinates(toTerrestrialDays(transit)).declinationRadians,
    horizonDipDegrees:
      (-HORIZON_DIP_ARCMINUTES_PER_ROOT_METER * Math.sqrt(observerHeightMeters)) /
      ARCMINUTES_PER_DEGREE,
  };

  return {
    solarNoon: instantAtDaysSinceJ2000(transit),
    nadir: instantAtDaysSinceJ2000(transit - HALF_DAY),
    daylight: resolveDaylight(day),
    sunrise: crossingInstant(day, RISE_SET_ALTITUDE_DEGREES, -1),
    sunset: crossingInstant(day, RISE_SET_ALTITUDE_DEGREES, 1),
    sunriseEnd: crossingInstant(day, WHOLE_DISC_ALTITUDE_DEGREES, -1),
    sunsetStart: crossingInstant(day, WHOLE_DISC_ALTITUDE_DEGREES, 1),
    civilDawn: crossingInstant(day, CIVIL_TWILIGHT_ALTITUDE_DEGREES, -1),
    civilDusk: crossingInstant(day, CIVIL_TWILIGHT_ALTITUDE_DEGREES, 1),
    nauticalDawn: crossingInstant(day, NAUTICAL_TWILIGHT_ALTITUDE_DEGREES, -1),
    nauticalDusk: crossingInstant(day, NAUTICAL_TWILIGHT_ALTITUDE_DEGREES, 1),
    astronomicalDawn: crossingInstant(day, ASTRONOMICAL_TWILIGHT_ALTITUDE_DEGREES, -1),
    astronomicalDusk: crossingInstant(day, ASTRONOMICAL_TWILIGHT_ALTITUDE_DEGREES, 1),
    goldenHourEnd: crossingInstant(day, GOLDEN_HOUR_ALTITUDE_DEGREES, -1),
    goldenHour: crossingInstant(day, GOLDEN_HOUR_ALTITUDE_DEGREES, 1),
  };
}
