import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { distanceToSegment } from '../geometry/hit-test-objects';
import { isPointInMultiPolygon } from '../geometry/polygon-booleans';
import type { MultiPolygon } from '../geometry/polygon-types';
import type { TrenchProfile } from '../terrain/trench-profile';
import type { Meters } from '../units';
import type { UtilityRoute, UtilityRouteId } from './routing';
import { MIN_DRIVEABLE_COVER_METERS, parallelSeparationMeters } from './routing';

/** Depth shortfalls under a hand's width are survey noise, not a finding. */
const DEPTH_TOLERANCE_METERS: Meters = 0.05;
/**
 * Two runs count as parallel company under this angle; a steeper meeting is a
 * crossing, which СП 42.13330 allows at any distance.
 */
const PARALLEL_ANGLE_LIMIT_DEGREES = 30;

/**
 * One advisory finding of the norm pass (`building-editor.md` §8). Advisory by
 * design: the editor flags the rule, the user decides — nothing blocks.
 */
export type RouteWarning =
  | {
      readonly kind: 'shallow-depth';
      readonly routeId: UtilityRouteId;
      readonly requiredMeters: Meters;
      readonly actualMeters: Meters;
    }
  | {
      readonly kind: 'driveable-cover';
      readonly routeId: UtilityRouteId;
      readonly requiredMeters: Meters;
      readonly actualMeters: Meters;
    }
  | {
      readonly kind: 'parallel-separation';
      readonly routeId: UtilityRouteId;
      readonly otherRouteId: UtilityRouteId;
      readonly requiredMeters: Meters;
      readonly actualMeters: Meters;
    };

/**
 * Every advisory the drawn trenches earn: a gravity run risen over its norm
 * burial, thin cover where a trench passes under paving, and different systems
 * keeping closer parallel company than СП 42.13330 seats them.
 */
export function collectRouteWarnings({
  routes,
  profiles,
  burialDepths,
  driveablePolygons,
}: {
  readonly routes: readonly UtilityRoute[];
  readonly profiles: ReadonlyMap<UtilityRouteId, TrenchProfile>;
  readonly burialDepths: ReadonlyMap<UtilityRouteId, Meters>;
  readonly driveablePolygons: MultiPolygon;
}): readonly RouteWarning[] {
  return [
    ...collectDepthWarnings(routes, profiles, burialDepths, driveablePolygons),
    ...collectSeparationWarnings(routes),
  ];
}

function collectDepthWarnings(
  routes: readonly UtilityRoute[],
  profiles: ReadonlyMap<UtilityRouteId, TrenchProfile>,
  burialDepths: ReadonlyMap<UtilityRouteId, Meters>,
  driveablePolygons: MultiPolygon
): readonly RouteWarning[] {
  return routes.flatMap(route => {
    const profile = profiles.get(route.id);
    const requiredDepth = burialDepths.get(route.id);

    if (isNil(profile) || isNil(requiredDepth)) {
      return [];
    }

    const warnings: RouteWarning[] = [];

    if (profile.minDepthMeters < requiredDepth - DEPTH_TOLERANCE_METERS) {
      warnings.push({
        kind: 'shallow-depth',
        routeId: route.id,
        requiredMeters: requiredDepth,
        actualMeters: profile.minDepthMeters,
      });
    }

    const pavedCover = thinnestPavedCover(profile, driveablePolygons);

    if (!isNil(pavedCover) && pavedCover < MIN_DRIVEABLE_COVER_METERS - DEPTH_TOLERANCE_METERS) {
      warnings.push({
        kind: 'driveable-cover',
        routeId: route.id,
        requiredMeters: MIN_DRIVEABLE_COVER_METERS,
        actualMeters: pavedCover,
      });
    }

    return warnings;
  });
}

/** The thinnest cover among stations under paving; nothing off the paving. */
function thinnestPavedCover(
  profile: TrenchProfile,
  driveablePolygons: MultiPolygon
): Meters | undefined {
  let thinnest: Meters | undefined;

  if (driveablePolygons.length === 0) {
    return undefined;
  }

  for (const station of profile.stations) {
    if (!isPointInMultiPolygon(driveablePolygons, station.position)) {
      continue;
    }

    const cover = station.gradeElevation - station.pipeElevation;

    thinnest = isNil(thinnest) ? cover : Math.min(thinnest, cover);
  }

  return thinnest;
}

function collectSeparationWarnings(routes: readonly UtilityRoute[]): readonly RouteWarning[] {
  const warnings: RouteWarning[] = [];

  for (let first = 0; first < routes.length; first += 1) {
    for (let second = first + 1; second < routes.length; second += 1) {
      const warning = checkPairSeparation(routes[first], routes[second]);

      if (!isNil(warning)) {
        warnings.push(warning);
      }
    }
  }

  return warnings;
}

/** The closest near-parallel company two routes keep, when a rule seats them. */
function checkPairSeparation(route: UtilityRoute, other: UtilityRoute): RouteWarning | undefined {
  const requiredMeters = parallelSeparationMeters(route.system, other.system);

  if (isNil(requiredMeters)) {
    return undefined;
  }

  let closest: Meters | undefined;

  for (let index = 0; index + 1 < route.points.length; index += 1) {
    for (let otherIndex = 0; otherIndex + 1 < other.points.length; otherIndex += 1) {
      const distance = parallelSegmentDistance(
        route.points[index],
        route.points[index + 1],
        other.points[otherIndex],
        other.points[otherIndex + 1]
      );

      if (!isNil(distance) && (isNil(closest) || distance < closest)) {
        closest = distance;
      }
    }
  }

  return isNil(closest) || closest >= requiredMeters
    ? undefined
    : {
        kind: 'parallel-separation',
        routeId: route.id,
        otherRouteId: other.id,
        requiredMeters,
        actualMeters: closest,
      };
}

/** The distance between two segments, only while they run near-parallel. */
function parallelSegmentDistance(
  aStart: Vector2,
  aEnd: Vector2,
  bStart: Vector2,
  bEnd: Vector2
): Meters | undefined {
  const aAngle = Math.atan2(aEnd.y - aStart.y, aEnd.x - aStart.x);
  const bAngle = Math.atan2(bEnd.y - bStart.y, bEnd.x - bStart.x);
  const between = Math.abs(normalizeHalfTurn(aAngle - bAngle));

  if (between > (PARALLEL_ANGLE_LIMIT_DEGREES * Math.PI) / 180) {
    return undefined;
  }

  return Math.min(
    distanceToSegment(bStart, bEnd, aStart),
    distanceToSegment(bStart, bEnd, aEnd),
    distanceToSegment(aStart, aEnd, bStart),
    distanceToSegment(aStart, aEnd, bEnd)
  );
}

/** Folds an angle difference into (−π/2, π/2] — direction of travel is moot. */
function normalizeHalfTurn(radians: number): number {
  let folded = radians % Math.PI;

  if (folded > Math.PI / 2) {
    folded -= Math.PI;
  }

  if (folded < -Math.PI / 2) {
    folded += Math.PI;
  }

  return folded;
}
