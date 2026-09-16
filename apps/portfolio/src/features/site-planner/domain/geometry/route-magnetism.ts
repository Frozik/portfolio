import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { WiringRoute } from '../model/wiring-routes';
import type { Meters } from '../units';
import { offsetPolyline, pointAlongPolyline, projectOntoPolyline } from './wall-geometry';

/** How far a route point reaches for a neighbouring route, in plan metres. */
export const ROUTE_MAGNET_RADIUS_PX = 12;

interface Catch {
  readonly at: Vector2;
  readonly distance: number;
  /** A bend of the companion line: where a run turning with its neighbour turns. */
  readonly isCorner: boolean;
}

/**
 * The Sweet Home 3D magnet for conduits (`wiring.md` §9): beside every
 * existing route runs a COMPANION line, offset by the two conduits' half
 * widths — the line a run laid touching it would follow. A point near a
 * companion slides freely along it (the run ends where the hand stops, not
 * where the neighbour does) and, near one of its bends, lands exactly on
 * that bend — the mitre where the two offset stretches meet, which is
 * where a second conduit turns with the first without pinching it.
 *
 * Two Ø20 conduits are 2 cm apart, which at a plan's zoom is a fraction of
 * a pixel, so the caller also names the gap the sheet can still SHOW.
 */
export function magnetizeBesideRoutes({
  routes,
  point,
  widthMeters,
  reachMeters,
  minGapMeters = 0,
  widthOf,
}: {
  readonly routes: readonly WiringRoute[];
  readonly point: Vector2;
  readonly widthMeters: Meters;
  readonly reachMeters: Meters;
  /** The narrowest gap worth laying — what the plan can still draw apart. */
  readonly minGapMeters?: Meters;
  readonly widthOf: (route: WiringRoute, segmentIndex: number) => Meters;
}): Vector2 | undefined {
  let best: Catch | undefined;
  const offer = (candidate: Catch): void => {
    if (candidate.distance > reachMeters) {
      return;
    }

    // A bend within reach outranks sliding: turning with the neighbour is
    // the more specific intent, and the exact mitre is what the hand aims at.
    if (
      isNil(best) ||
      (candidate.isCorner && !best.isCorner) ||
      (candidate.isCorner === best.isCorner && candidate.distance < best.distance)
    ) {
      best = candidate;
    }
  };

  for (const route of routes) {
    const segmentIndex = nearestSegmentIndex(route.points, point);

    if (isNil(segmentIndex)) {
      continue;
    }

    const gap = Math.max((widthOf(route, segmentIndex) + widthMeters) / 2, minGapMeters);

    for (const side of [1, -1]) {
      const companion = offsetPolyline(route.points, side * gap);

      for (const vertex of companion) {
        offer({ at: vertex, distance: distanceBetween(vertex, point), isCorner: true });
      }

      const projection = projectOntoPolyline(companion, point);

      offer({
        at: pointAlongPolyline(companion, projection.offsetMeters),
        distance: projection.distanceMeters,
        isCorner: false,
      });
    }
  }

  return best?.at;
}

function distanceBetween(first: Vector2, second: Vector2): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

/** Which stretch of the route the point stands nearest to. */
function nearestSegmentIndex(points: readonly Vector2[], point: Vector2): number | undefined {
  let best: { readonly index: number; readonly distance: number } | undefined;

  for (let index = 1; index < points.length; index += 1) {
    const { distanceMeters } = projectOntoPolyline([points[index - 1], points[index]], point);

    if (isNil(best) || distanceMeters < best.distance) {
      best = { index: index - 1, distance: distanceMeters };
    }
  }

  return best?.index;
}
