import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';

import type { UtilityRoute } from '../model/routing';
import type { CarInstance, SitePath, TreeInstance } from '../model/site-plan';
import type { Meters } from '../units';
import { carRotatedBox } from './car-geometry';
import { hitTestRotatedBox } from './hit-test-shape';

const HALF = 0.5;

/**
 * Distance from a point to a polyline, as the shortest distance to any of its
 * segments. A polyline of a single point is that point; an empty one is
 * unreachable.
 */
export function distanceToPolyline(points: readonly Vector2[], point: Vector2): Meters {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let distance = Math.hypot(points[0].x - point.x, points[0].y - point.y);

  for (let index = 0; index + 1 < points.length; index += 1) {
    distance = Math.min(distance, distanceToSegment(points[index], points[index + 1], point));
  }

  return distance;
}

/** A tree answers a click over its crown, the circle the plan draws for it. */
export function hitTestTree(tree: TreeInstance, point: Vector2, toleranceMeters: Meters): boolean {
  return (
    Math.hypot(tree.position.x - point.x, tree.position.y - point.y) <=
    tree.crownRadius + toleranceMeters
  );
}

/**
 * A car answers a click over its body — the same turned box the plan outlines
 * for it, tested through the rectangle mathematics rather than a copy of it.
 */
export function hitTestCar(car: CarInstance, point: Vector2, toleranceMeters: Meters): boolean {
  return hitTestRotatedBox(carRotatedBox(car), point, toleranceMeters);
}

/**
 * A path answers a click over its ribbon. The ribbon is the polyline widened by
 * half its width — interpolated along each segment where the widths differ — so
 * the test runs per segment: the distance to it against the width where the
 * click projects onto it, plus the discs that round every join and cap.
 */
export function hitTestPath(path: SitePath, point: Vector2, toleranceMeters: Meters): boolean {
  for (const pathPoint of path.points) {
    const distance = Math.hypot(pathPoint.position.x - point.x, pathPoint.position.y - point.y);

    if (distance <= pathPoint.width * HALF + toleranceMeters) {
      return true;
    }
  }

  for (let index = 0; index + 1 < path.points.length; index += 1) {
    const start = path.points[index];
    const end = path.points[index + 1];
    const segmentX = end.position.x - start.position.x;
    const segmentY = end.position.y - start.position.y;
    const squaredLength = segmentX * segmentX + segmentY * segmentY;

    if (squaredLength === 0) {
      continue;
    }

    const projection = clamp(
      ((point.x - start.position.x) * segmentX + (point.y - start.position.y) * segmentY) /
        squaredLength,
      0,
      1
    );
    const distance = Math.hypot(
      start.position.x + projection * segmentX - point.x,
      start.position.y + projection * segmentY - point.y
    );
    const widthHere = start.width + (end.width - start.width) * projection;

    if (distance <= widthHere * HALF + toleranceMeters) {
      return true;
    }
  }

  return false;
}

/** A trench answers a click along its drawn line — it has no width to fill. */
export function hitTestUtilityRoute(
  route: UtilityRoute,
  point: Vector2,
  toleranceMeters: Meters
): boolean {
  return distanceToPolyline(route.points, point) <= toleranceMeters;
}

export function distanceToSegment(start: Vector2, end: Vector2, point: Vector2): Meters {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const squaredLength = segmentX * segmentX + segmentY * segmentY;

  if (squaredLength === 0) {
    return Math.hypot(start.x - point.x, start.y - point.y);
  }

  const projection = clamp(
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / squaredLength,
    0,
    1
  );

  return Math.hypot(
    start.x + projection * segmentX - point.x,
    start.y + projection * segmentY - point.y
  );
}
