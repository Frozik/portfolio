import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import type { VerticalDuct } from '../model/ducts';
import {
  DUCT_ABOVE_ROOF_METERS,
  DUCT_RIDGE_LEVEL_REACH_METERS,
  DUCT_RIDGE_REACH_METERS,
} from '../model/ducts';
import type { Fireplace } from '../model/fireplaces';
import { FIREPLACE_SPECS, FLUE_BACK_OFFSET_FACTOR } from '../model/fireplaces';
import type { Meters } from '../units';
import { DEGREES_TO_RADIANS } from '../units';
import { rotatedBoxRing } from './hit-test-shape';
import { offsetPolygons } from './offset-polygon';
import type { RoofCrease, RoofFace, RoofFrame } from './pitched-roof';
import { roofHeightAt } from './pitched-roof';
import type { MultiPolygon, PolygonWithHoles } from './polygon-types';
import { distanceToSegment } from './segment-distance';

/** The body of a fireplace on the plan: its box, turned the way it faces. */
export function fireplaceFootprint(fireplace: Fireplace): PolygonWithHoles {
  const spec = FIREPLACE_SPECS[fireplace.kind];

  return {
    outer: rotatedBoxRing({
      center: fireplace.position,
      rotationDegrees: fireplace.rotationDegrees,
      extentX: spec.widthMeters,
      extentY: spec.depthMeters,
    }),
    holes: [],
  };
}

/**
 * Where a fireplace's flue rises: behind the firebox, on the back of the body.
 * Derived rather than placed — a chimney that could be dragged away from the
 * fireplace it serves is a drawing, not a model.
 */
export function fluePosition(fireplace: Fireplace): Vector2 {
  const spec = FIREPLACE_SPECS[fireplace.kind];
  const radians = fireplace.rotationDegrees * DEGREES_TO_RADIANS;
  const back = spec.depthMeters * FLUE_BACK_OFFSET_FACTOR;

  // The body's local y is its depth; the firebox faces local −y, so the flue
  // stands on the +y side of the centre.
  return {
    x: fireplace.position.x - Math.sin(radians) * back,
    y: fireplace.position.y + Math.cos(radians) * back,
  };
}

/** The shaft's section on the plan, wherever it is being drawn. */
export function ductFootprint(duct: VerticalDuct): PolygonWithHoles {
  return {
    outer: rotatedBoxRing({
      center: duct.position,
      rotationDegrees: duct.rotationDegrees,
      extentX: duct.widthMeters,
      extentY: duct.depthMeters,
    }),
    holes: [],
  };
}

/**
 * How high a shaft must come out, given the roof it passes through
 * (СП 7.13130 §5.10). Within 1.5 m of the ridge it stands half a metre above
 * it; out to 3 m it is level with it; beyond that it clears the roof surface
 * over its own head by half a metre. Anything shorter is drawn back down the
 * wind: it is the rule people most often break, and the one that fills a house
 * with smoke when they do.
 */
export function ductTopElevation({
  duct,
  roof,
  fallbackElevation,
}: {
  readonly duct: VerticalDuct;
  readonly roof: DuctRoofContext | undefined;
  /** Where the shaft comes out when the building has no pitched roof. */
  readonly fallbackElevation: Meters;
}): Meters {
  if (isNil(roof)) {
    return fallbackElevation + DUCT_ABOVE_ROOF_METERS;
  }

  const surface = roofSurfaceElevation(roof, duct.position);
  const clearance = surface + DUCT_ABOVE_ROOF_METERS;
  const toRidge = distanceToRidge(roof.creases, duct.position);

  if (isNil(toRidge)) {
    return clearance;
  }

  if (toRidge <= DUCT_RIDGE_REACH_METERS) {
    return Math.max(clearance, roof.ridgeElevation + DUCT_ABOVE_ROOF_METERS);
  }

  return toRidge <= DUCT_RIDGE_LEVEL_REACH_METERS
    ? Math.max(clearance, roof.ridgeElevation)
    : clearance;
}

/** What a shaft needs to know about the roof it comes out of. */
export interface DuctRoofContext {
  readonly frame: RoofFrame;
  readonly faces: readonly RoofFace[];
  readonly creases: readonly RoofCrease[];
  readonly eaveElevation: Meters;
  readonly ridgeElevation: Meters;
}

/** The roof over a point: the lowest of its planes — its lower envelope. */
function roofSurfaceElevation(roof: DuctRoofContext, point: Vector2): Meters {
  let lowest = Number.POSITIVE_INFINITY;

  for (const face of roof.faces) {
    lowest = Math.min(lowest, roofHeightAt(roof.frame, face.plane, point));
  }

  return roof.eaveElevation + (Number.isFinite(lowest) ? lowest : 0);
}

/** How far the shaft stands from the ridge on the plan, or nothing without one. */
function distanceToRidge(creases: readonly RoofCrease[], point: Vector2): Meters | undefined {
  let closest: Meters | undefined;

  for (const crease of creases) {
    if (!crease.isRidge) {
      continue;
    }

    const distance = distanceToSegment(crease.from, crease.to, point);

    closest = isNil(closest) ? distance : Math.min(closest, distance);
  }

  return closest;
}

/** How proud the head band stands of the shaft — the brick оголовок course. */
const CROWN_HEAD_OUTSET_METERS: Meters = 0.05;
const CROWN_HEAD_HEIGHT_METERS: Meters = 0.14;
/** The rain cap: a plate overhanging the head, floating on an air gap. */
const CROWN_CAP_OUTSET_METERS: Meters = 0.11;
const CROWN_CAP_THICKNESS_METERS: Meters = 0.05;
/** The open band the exhaust leaves through, between head and cap. */
const CROWN_VENT_GAP_METERS: Meters = 0.12;
const CROWN_POST_SIZE_METERS: Meters = 0.04;
/** Posts stand this far in from each head corner, clear of its edge. */
const CROWN_POST_INSET_METERS: Meters = 0.07;

/** One vertical prism of the crown, ready for the extruder. */
export interface DuctCrownPiece {
  readonly polygons: MultiPolygon;
  readonly baseElevation: Meters;
  readonly topElevation: Meters;
}

/**
 * The оголовок dressing a shaft where it stands in the open air: the head
 * band crowning the masonry, four corner posts and the rain cap floating over
 * the vent gap. The SHAFT should stop at `topElevation - crownHeadHeight()` —
 * the head fully wraps its last course, so their meeting stays an internal
 * face rather than two visible coplanar caps.
 */
export function ductCrownPieces(
  duct: VerticalDuct,
  topElevation: Meters
): readonly DuctCrownPiece[] {
  const footprint: MultiPolygon = [ductFootprint(duct)];
  const head = offsetPolygons(footprint, CROWN_HEAD_OUTSET_METERS);
  const cap = offsetPolygons(footprint, CROWN_CAP_OUTSET_METERS);
  const capBase = topElevation + CROWN_VENT_GAP_METERS;
  const half = CROWN_POST_SIZE_METERS / 2;
  const corners = ductFootprint(duct).outer;
  const centre = duct.position;
  const posts: DuctCrownPiece[] = corners.map(corner => {
    const towardCentre = { x: centre.x - corner.x, y: centre.y - corner.y };
    const length = Math.hypot(towardCentre.x, towardCentre.y);
    const at =
      length === 0
        ? corner
        : {
            x: corner.x + (towardCentre.x / length) * CROWN_POST_INSET_METERS,
            y: corner.y + (towardCentre.y / length) * CROWN_POST_INSET_METERS,
          };

    return {
      polygons: [
        {
          outer: [
            { x: at.x - half, y: at.y - half },
            { x: at.x + half, y: at.y - half },
            { x: at.x + half, y: at.y + half },
            { x: at.x - half, y: at.y + half },
          ],
          holes: [],
        },
      ],
      baseElevation: topElevation,
      topElevation: capBase,
    };
  });

  return [
    {
      polygons: head,
      baseElevation: topElevation - CROWN_HEAD_HEIGHT_METERS,
      topElevation,
    },
    ...posts,
    {
      polygons: cap,
      baseElevation: capBase,
      topElevation: capBase + CROWN_CAP_THICKNESS_METERS,
    },
  ];
}

/** How much of the shaft's top the head band swallows — see {@link ductCrownPieces}. */
export function crownHeadHeight(): Meters {
  return CROWN_HEAD_HEIGHT_METERS;
}
