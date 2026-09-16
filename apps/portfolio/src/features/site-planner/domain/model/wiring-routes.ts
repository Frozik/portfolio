import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { InstallationPresetId } from './installation';
import { DEFAULT_INSTALLATION_PRESET } from './installation';

export type WiringRouteId = Opaque<'WiringRouteId', string>;

export function createWiringRouteId(): WiringRouteId {
  return crypto.randomUUID() as WiringRouteId;
}

/** Where the horizontal of a route runs: under the ceiling, or along the floor. */
export type WiringLevel = 'ceiling' | 'floor';

export const WIRING_LEVELS: readonly WiringLevel[] = ['ceiling', 'floor'];

/** One stretch of a route between two bends, with how the cable is laid on it. */
interface WiringSegment {
  readonly installation: InstallationPresetId;
}

/**
 * A hand-drawn cable route (`wiring.md` §3.3): a polyline on the storey's
 * plan, a level, and an installation method per segment. Cable runs that can
 * reach it follow it instead of the walls; runs that cannot keep the derived
 * path. The route says WHERE and HOW; which cables ride it is derived.
 */
export interface WiringRoute {
  readonly id: WiringRouteId;
  readonly points: readonly Vector2[];
  readonly level: WiringLevel;
  /** One per stretch: `segments.length === points.length - 1`. */
  readonly segments: readonly WiringSegment[];
}

export const MIN_WIRING_ROUTE_POINTS = 2;

export function createWiringRoute({
  points,
  installation = DEFAULT_INSTALLATION_PRESET,
  level = 'ceiling',
}: {
  readonly points: readonly Vector2[];
  readonly installation?: InstallationPresetId;
  readonly level?: WiringLevel;
}): WiringRoute {
  return {
    id: createWiringRouteId(),
    points,
    level,
    segments: points.slice(1).map(() => ({ installation })),
  };
}

export function setRouteSegmentInstallation(
  route: WiringRoute,
  segmentIndex: number,
  installation: InstallationPresetId
): WiringRoute {
  return {
    ...route,
    segments: route.segments.map((segment, index) =>
      index === segmentIndex ? { installation } : segment
    ),
  };
}

export function moveRoutePoint(
  route: WiringRoute,
  pointIndex: number,
  position: Vector2
): WiringRoute {
  return {
    ...route,
    points: route.points.map((point, index) => (index === pointIndex ? position : point)),
  };
}

/** Splits the stretch after `segmentIndex` at a new bend; both halves keep its method. */
export function insertRoutePoint(
  route: WiringRoute,
  segmentIndex: number,
  position: Vector2
): WiringRoute {
  const split = route.segments[segmentIndex] ?? route.segments[route.segments.length - 1];

  return {
    ...route,
    points: [
      ...route.points.slice(0, segmentIndex + 1),
      position,
      ...route.points.slice(segmentIndex + 1),
    ],
    segments: [
      ...route.segments.slice(0, segmentIndex + 1),
      split,
      ...route.segments.slice(segmentIndex + 1),
    ],
  };
}

/**
 * Takes a bend out; the two stretches it joined become one, laid the way the
 * earlier of them was. A route keeps its last two points.
 */
export function removeRoutePoint(route: WiringRoute, pointIndex: number): WiringRoute {
  if (route.points.length <= MIN_WIRING_ROUTE_POINTS) {
    return route;
  }

  const droppedSegment = Math.min(pointIndex, route.segments.length - 1);

  return {
    ...route,
    points: route.points.filter((_, index) => index !== pointIndex),
    segments: route.segments.filter((_, index) => index !== droppedSegment),
  };
}

export function translateWiringRoute(route: WiringRoute, offset: Vector2): WiringRoute {
  return {
    ...route,
    points: route.points.map(point => ({ x: point.x + offset.x, y: point.y + offset.y })),
  };
}
