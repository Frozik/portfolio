import { Temporal } from 'temporal-polyfill';

import { HOURS_PER_DAY, MS_PER_HOUR, MS_PER_SECOND } from '../date/constants';
import { computeLunarPosition, EARTH_EQUATORIAL_RADIUS_KM } from './lunarPosition';
import { DEGREES_TO_RADIANS } from './solarCoordinates';

/** Whether the Moon crosses the horizon at all during that UTC day. */
export type LunarVisibility = 'normal' | 'always-up' | 'always-down';

export interface LunarEvents {
  readonly moonrise: Temporal.Instant | undefined;
  readonly moonset: Temporal.Instant | undefined;
  readonly visibility: LunarVisibility;
}

/** The day is sampled every two hours and each span checked for a horizon crossing. */
const SAMPLE_STEP_HOURS = 2;
/**
 * The Moon's semidiameter as a share of its equatorial horizontal parallax
 * (Meeus 55: k = 0.2725), so it tracks the distance — about 0.25° at apogee and
 * 0.28° at perigee.
 */
const SEMIDIAMETER_PER_PARALLAX = 0.2725;
/**
 * Not a physical constant: SunCalc's empirical residual for what its refraction
 * model under-bends at the horizon, tuned against the USNO moonrise tables.
 */
const RESIDUAL_HORIZON_REFRACTION_DEGREES = 0.09;
/** The Newton polish steps the parabola's root off by up to ~0.2° onto the true altitude curve. */
const CROSSING_REFINEMENT_PASSES = 2;
const CROSSING_DIFFERENCE_HALF_STEP_SECONDS = 30;
const CROSSING_DIFFERENCE_HALF_STEP_MS = CROSSING_DIFFERENCE_HALF_STEP_SECONDS * MS_PER_SECOND;

/**
 * The upper limb's height over the rise/set horizon, degrees: the topocentric
 * altitude of the centre plus the semidiameter plus the residual refraction.
 * Crossing zero is the USNO's moonrise and moonset.
 */
function upperLimbHeightDegrees(
  epochMilliseconds: number,
  latitudeDegrees: number,
  longitudeDegrees: number
): number {
  // The Newton steps land on fractional milliseconds; an instant wants whole ones.
  const position = computeLunarPosition(
    Temporal.Instant.fromEpochMilliseconds(Math.round(epochMilliseconds)),
    latitudeDegrees,
    longitudeDegrees
  );
  const parallaxDegrees =
    Math.asin(EARTH_EQUATORIAL_RADIUS_KM / position.distanceKm) / DEGREES_TO_RADIANS;

  return (
    position.altitudeDegrees +
    SEMIDIAMETER_PER_PARALLAX * parallaxDegrees +
    RESIDUAL_HORIZON_REFRACTION_DEGREES
  );
}

/** Newton steps against the true height curve, with a central-difference slope. */
function refineCrossing(
  epochMilliseconds: number,
  latitudeDegrees: number,
  longitudeDegrees: number
): number {
  let crossing = epochMilliseconds;

  for (let pass = 0; pass < CROSSING_REFINEMENT_PASSES; pass++) {
    const height = upperLimbHeightDegrees(crossing, latitudeDegrees, longitudeDegrees);
    const slopePerMs =
      (upperLimbHeightDegrees(
        crossing + CROSSING_DIFFERENCE_HALF_STEP_MS,
        latitudeDegrees,
        longitudeDegrees
      ) -
        upperLimbHeightDegrees(
          crossing - CROSSING_DIFFERENCE_HALF_STEP_MS,
          latitudeDegrees,
          longitudeDegrees
        )) /
      (2 * CROSSING_DIFFERENCE_HALF_STEP_MS);

    crossing -= height / slopePerMs;
  }

  return crossing;
}

interface SpanRoots {
  readonly count: number;
  readonly first: number;
  readonly second: number;
  readonly vertexHeight: number;
}

/**
 * Where the parabola through three height samples (at −1, 0 and +1 hours
 * around the middle one) crosses zero, in hours from the middle sample.
 */
function parabolaRoots(heightBefore: number, heightMiddle: number, heightAfter: number): SpanRoots {
  const a = (heightBefore + heightAfter) / 2 - heightMiddle;
  const b = (heightAfter - heightBefore) / 2;
  const vertex = -b / (2 * a);
  const discriminant = b * b - 4 * a * heightMiddle;
  const vertexHeight = (a * vertex + b) * vertex + heightMiddle;

  if (discriminant < 0) {
    return { count: 0, first: 0, second: 0, vertexHeight };
  }

  const halfWidth = Math.sqrt(discriminant) / (Math.abs(a) * 2);
  const roots = [vertex - halfWidth, vertex + halfWidth].filter(root => Math.abs(root) <= 1);

  return {
    count: roots.length,
    first: roots[0] ?? vertex + halfWidth,
    second: roots[1] ?? 0,
    vertexHeight,
  };
}

/**
 * Moonrise and moonset over the UTC calendar day of an instant: the day is
 * walked in two-hour spans and each span's three samples fitted with a
 * parabola (Meeus ch. 15 suggests the interpolation); a crossing found that
 * way is then polished against the true height curve.
 */
export function computeLunarEvents(
  instant: Temporal.Instant,
  latitudeDegrees: number,
  longitudeDegrees: number
): LunarEvents {
  const dayStart = instant.toZonedDateTimeISO('UTC').startOfDay().epochMilliseconds;
  const heightAt = (hours: number): number =>
    upperLimbHeightDegrees(dayStart + hours * MS_PER_HOUR, latitudeDegrees, longitudeDegrees);
  let heightBefore = heightAt(0);
  let highest = heightBefore;
  let riseHours: number | undefined;
  let setHours: number | undefined;

  for (let hour = 1; hour <= HOURS_PER_DAY; hour += SAMPLE_STEP_HOURS) {
    const heightMiddle = heightAt(hour);
    const heightAfter = heightAt(hour + 1);
    const roots = parabolaRoots(heightBefore, heightMiddle, heightAfter);

    highest = Math.max(highest, heightMiddle, heightAfter);

    if (roots.count === 1) {
      if (heightBefore < 0) {
        riseHours = hour + roots.first;
      } else {
        setHours = hour + roots.first;
      }
    } else if (roots.count === 2) {
      riseHours = hour + (roots.vertexHeight < 0 ? roots.second : roots.first);
      setHours = hour + (roots.vertexHeight < 0 ? roots.first : roots.second);
    }

    if (riseHours !== undefined && setHours !== undefined) {
      break;
    }

    heightBefore = heightAfter;
  }

  const toInstant = (hours: number | undefined): Temporal.Instant | undefined =>
    hours === undefined
      ? undefined
      : Temporal.Instant.fromEpochMilliseconds(
          Math.round(
            refineCrossing(dayStart + hours * MS_PER_HOUR, latitudeDegrees, longitudeDegrees)
          )
        );
  return {
    moonrise: toInstant(riseHours),
    moonset: toInstant(setHours),
    visibility: resolveVisibility(riseHours !== undefined || setHours !== undefined, highest),
  };
}

/** No crossing all day: which side of the horizon the Moon kept to, by its highest sample. */
function resolveVisibility(hasCrossing: boolean, highestHeightDegrees: number): LunarVisibility {
  if (hasCrossing) {
    return 'normal';
  }

  return highestHeightDegrees > 0 ? 'always-up' : 'always-down';
}
