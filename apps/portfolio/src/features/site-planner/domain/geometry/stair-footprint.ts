import type { Vector2 } from '@frozik/utils/math/vector2';

import type { StairInstance } from '../model/stairs';
import type { Meters } from '../units';
import { DEGREES_TO_RADIANS } from '../units';
import { isPointInMultiPolygon } from './polygon-booleans';
import type { MultiPolygon, PolygonWithHoles, Ring } from './polygon-types';
import { rectangleLocalToPlan } from './polygonize-shape';
import { distanceToSegment } from './segment-distance';
import { stairLayout, flightLocalRing, spiralLocalRing } from './stair-layouts';

/**
 * The stair's plan footprint in world metres — one polygon per flight/landing
 * (they overlap at the joints, which every consumer treats as material). The
 * ceiling cutout of the storey above IS this footprint (the conscious
 * v1 cut — full contour, not the headroom subset).
 */
export function stairFootprint(stair: StairInstance, storeyHeightMeters: Meters): MultiPolygon {
  const layout = stairLayout(stair.kind, storeyHeightMeters, stair.widthMeters);
  const frame = { center: stair.position, rotationDegrees: stair.rotationDegrees };
  const mirror = mirrorOf(stair);
  const rings: Ring[] =
    stair.kind === 'spiral'
      ? [spiralLocalRing(stair.widthMeters / 2)]
      : layout.flights.map(flightLocalRing);

  return rings.map((ring): PolygonWithHoles => ({
    outer: ring.map(point => rectangleLocalToPlan(frame, mirror(point))),
    holes: [],
  }));
}

/** Where the climb tops out in world metres — what the O-A2 rule projects. */
export function stairExitPoint(stair: StairInstance, storeyHeightMeters: Meters): Vector2 {
  const layout = stairLayout(stair.kind, storeyHeightMeters, stair.widthMeters);

  return rectangleLocalToPlan(
    { center: stair.position, rotationDegrees: stair.rotationDegrees },
    mirrorOf(stair)(layout.exitPoint)
  );
}

/**
 * The instance's handedness as a transform of its own frame: mirroring flips
 * the local x axis, so a quarter turn that went right goes left and everything
 * derived from the layout — footprint, steps, exit — follows without a second
 * set of layouts.
 */
export function mirrorOf(stair: StairInstance): (point: Vector2) => Vector2 {
  return stair.isMirrored === true ? point => ({ x: -point.x, y: point.y }) : point => point;
}

/**
 * The headroom a person needs over a stair — and, above it, the reason a
 * cutout exists at all. Below this the ceiling has to be opened; beyond it the
 * floor above can stay.
 */
const STAIR_HEADROOM_METERS: Meters = 2.0;

/**
 * The part of the footprint that must actually be cut out of the floor above
 * (plan П2): only where the climb has risen close enough to the ceiling that a
 * head would meet it. Cutting the WHOLE footprint — the first version of this
 * — deleted the floor over the lower flight and the landing of an L- or
 * U-shaped stair, that is, the corner of a room upstairs where in a real house
 * a wardrobe stands.
 */
export function stairCutout(
  stair: StairInstance,
  floorToFloorMeters: Meters,
  {
    steps,
  }: {
    readonly steps: readonly {
      readonly polygon: PolygonWithHoles;
      readonly topOffsetMeters: Meters;
    }[];
  }
): MultiPolygon {
  const openFrom = floorToFloorMeters - STAIR_HEADROOM_METERS;
  const pierced = steps.filter(step => step.topOffsetMeters >= openFrom).map(step => step.polygon);

  // The exit itself is always open: the last steps land ON the floor above.
  return pierced.length > 0 ? pierced : stairFootprint(stair, floorToFloorMeters);
}

/**
 * Whether a point lies on a stair's body, within a picking tolerance. The
 * footprint is a set of overlapping flight rectangles, so «inside any of them»
 * is the honest test; the tolerance forgives the pixel a finger misses by.
 */
export function isPointOnStair(
  footprint: MultiPolygon,
  point: Vector2,
  toleranceMeters: Meters
): boolean {
  if (isPointInMultiPolygon(footprint, point)) {
    return true;
  }

  for (const polygon of footprint) {
    for (let index = 0; index < polygon.outer.length; index += 1) {
      const from = polygon.outer[index];
      const to = polygon.outer[(index + 1) % polygon.outer.length];

      if (distanceToSegment(from, to, point) <= toleranceMeters) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Where the turn grip sits: past the stair's exit, along the climb — the same
 * offset furniture's grip keeps, so the gesture reads the same.
 */
export function stairRotationGrip(
  stair: StairInstance,
  exitPoint: Vector2,
  gapMeters: Meters
): Vector2 {
  const angle = stair.rotationDegrees * DEGREES_TO_RADIANS;

  return {
    x: exitPoint.x + Math.cos(angle + Math.PI / 2) * gapMeters,
    y: exitPoint.y + Math.sin(angle + Math.PI / 2) * gapMeters,
  };
}
