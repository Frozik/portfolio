import type { Vector2 } from '@frozik/utils/math/vector2';
import { removeById, replaceById } from './edit-collections';
import type { UtilityRoute, UtilityRouteId } from './routing';
import { MIN_ROUTE_POINTS } from './routing';

export function addUtilityRoute(
  routes: readonly UtilityRoute[],
  route: UtilityRoute
): readonly UtilityRoute[] {
  return [...routes, route];
}

export function updateUtilityRoute(
  routes: readonly UtilityRoute[],
  route: UtilityRoute
): readonly UtilityRoute[] {
  return routes.map(candidate => (candidate.id === route.id ? route : candidate));
}

export function removeUtilityRoute(
  routes: readonly UtilityRoute[],
  routeId: UtilityRouteId
): readonly UtilityRoute[] {
  return removeById(routes, routeId);
}

export function moveUtilityRoutePoint(
  routes: readonly UtilityRoute[],
  routeId: UtilityRouteId,
  pointIndex: number,
  position: Vector2
): readonly UtilityRoute[] {
  return replaceById(routes, routeId, route => ({
    ...route,
    points: route.points.map((existing, index) => (index === pointIndex ? position : existing)),
  }));
}

/** Splits the segment after `segmentIndex` by planting a new bend inside it. */
export function insertUtilityRoutePoint(
  routes: readonly UtilityRoute[],
  routeId: UtilityRouteId,
  segmentIndex: number,
  position: Vector2
): readonly UtilityRoute[] {
  return replaceById(routes, routeId, route => ({
    ...route,
    points: [
      ...route.points.slice(0, segmentIndex + 1),
      position,
      ...route.points.slice(segmentIndex + 1),
    ],
  }));
}

/** Refuses silently below a segment's worth of points, like a path does. */
export function removeUtilityRoutePoint(
  routes: readonly UtilityRoute[],
  routeId: UtilityRouteId,
  pointIndex: number
): readonly UtilityRoute[] {
  return replaceById(routes, routeId, route =>
    route.points.length <= MIN_ROUTE_POINTS
      ? route
      : { ...route, points: route.points.filter((_, index) => index !== pointIndex) }
  );
}
