import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import type { PitchedRoof, PitchedRoofKind } from '../model/roofs';
import type { Meters } from '../units';
import { DEGREES_TO_RADIANS } from '../units';
import { offsetPolygons } from './offset-polygon';
import { intersectPolygons } from './polygon-booleans';
import type { MultiPolygon, Ring } from './polygon-types';
import type { RotatedFrame } from './polygonize-shape';
import { planToRectangleLocal, rectangleLocalToPlan } from './polygonize-shape';

/**
 * A pitched roof, derived (`building-editor.md` §5, R33).
 *
 * The whole surface is one HEIGHT FUNCTION over the plan, measured up from the
 * eaves, and it is piecewise linear: every slope is a plane, so the roof is cut
 * into faces that each carry one plane and the part of the plan it governs.
 * That is what keeps the mesh exact — a plane triangulated any which way is
 * still that plane — and what lets the 2D plan draw the ridge and the hips as
 * the lines where two faces meet rather than as decoration.
 *
 * The measurements are taken in the roof's OWN frame — the bounding box of the
 * storey's outline, turned to the ridge — because that is what a roof is
 * actually built to: a rafter run has one length and one slope, whatever shape
 * the plan below it happens to be.
 */
export interface RoofFrame extends RotatedFrame {
  /** Extent along the ridge, in the frame's local x. */
  readonly alongMeters: Meters;
  /** Extent across the ridge, in the frame's local y — what the slopes climb. */
  readonly acrossMeters: Meters;
}

/**
 * One slope: height above the eaves as `du · u + dv · v + c` in the roof's own
 * frame. Stated in the local frame rather than in plan coordinates so that
 * turning the ridge cannot silently change the slope.
 */
export interface RoofPlane {
  readonly du: number;
  readonly dv: number;
  readonly c: number;
}

/** One plane of the roof and the stretch of plan it covers. */
export interface RoofFace {
  readonly polygons: MultiPolygon;
  readonly plane: RoofPlane;
}

/** A crease of the roof as the plan states it: the ridge, or a hip. */
export interface RoofCrease {
  readonly from: Vector2;
  readonly to: Vector2;
  /** The ridge is drawn heavier than the hips running down to the corners. */
  readonly isRidge: boolean;
}

/**
 * Far enough to cover any plan the faces are clipped against — the wedges of a
 * hip roof are unbounded, and the plan itself is what bounds them.
 */
const FAR_METERS = 10_000;

/** The bounding box of the outline, taken in the frame the ridge turns to. */
export function roofFrameOf(footprint: MultiPolygon, ridgeDegrees: number): RoofFrame | undefined {
  const pivot: RotatedFrame = { center: { x: 0, y: 0 }, rotationDegrees: ridgeDegrees };
  const locals = footprint.flatMap(polygon =>
    polygon.outer.map(point => planToRectangleLocal(pivot, point))
  );

  if (locals.length === 0) {
    return undefined;
  }

  const minU = Math.min(...locals.map(point => point.x));
  const maxU = Math.max(...locals.map(point => point.x));
  const minV = Math.min(...locals.map(point => point.y));
  const maxV = Math.max(...locals.map(point => point.y));

  return {
    center: rectangleLocalToPlan(pivot, { x: (minU + maxU) / 2, y: (minV + maxV) / 2 }),
    rotationDegrees: ridgeDegrees,
    alongMeters: maxU - minU,
    acrossMeters: maxV - minV,
  };
}

/** Which way the ridge should run by default: along the outline's longer side. */
export function defaultRidgeDegrees(footprint: MultiPolygon): number {
  const frame = roofFrameOf(footprint, 0);
  const QUARTER_TURN_DEGREES = 90;

  return isWiderThanTall(frame) ? 0 : QUARTER_TURN_DEGREES;
}

function isWiderThanTall(frame: RoofFrame | undefined): boolean {
  return frame === undefined || frame.alongMeters >= frame.acrossMeters;
}

/** The plan the roof covers: the storey's outline, grown by the overhang. */
export function roofPlan(footprint: MultiPolygon, overhangMeters: Meters): MultiPolygon {
  return overhangMeters > 0 ? offsetPolygons(footprint, overhangMeters) : footprint;
}

/** Height above the eaves at a plan point, on the given plane. */
export function roofHeightAt(frame: RoofFrame, plane: RoofPlane, point: Vector2): Meters {
  const local = planToRectangleLocal(frame, point);

  return plane.du * local.x + plane.dv * local.y + plane.c;
}

/** How high the ridge stands above the eaves. */
export function roofPeakMeters(frame: RoofFrame, roof: PitchedRoof): Meters {
  const slope = Math.tan(roof.pitchDegrees * DEGREES_TO_RADIANS);

  switch (roof.kind) {
    case 'shed':
      return slope * frame.acrossMeters;
    case 'gable':
      return slope * (frame.acrossMeters / 2);
    case 'hip':
      return slope * (Math.min(frame.acrossMeters, frame.alongMeters) / 2);
    default:
      return assertNever(roof.kind);
  }
}

/**
 * The roof cut into its planes. A face's region is built from the halfplanes
 * that say «this slope is the nearest one» and then intersected with the plan,
 * so an L-shaped storey gets an L-shaped roof rather than a roof over its box.
 */
export function roofFaces(
  plan: MultiPolygon,
  frame: RoofFrame,
  roof: PitchedRoof
): readonly RoofFace[] {
  const slope = Math.tan(roof.pitchDegrees * DEGREES_TO_RADIANS);
  const halfAcross = frame.acrossMeters / 2;
  const halfAlong = frame.alongMeters / 2;

  return facesOf(roof.kind, { slope, halfAcross, halfAlong })
    .map(({ plane, halfplanes }) => ({
      plane,
      polygons: intersectPolygons(plan, [{ outer: regionRing(frame, halfplanes), holes: [] }]),
    }))
    .filter(face => face.polygons.length > 0);
}

/**
 * The lines where two slopes meet, in plan metres: the ridge, and — on a hip
 * roof — the four hips running down to the corners. A roof plan without them
 * says nothing about which way the water runs.
 */
export function roofCreases(frame: RoofFrame, roof: PitchedRoof): readonly RoofCrease[] {
  const halfAcross = frame.acrossMeters / 2;
  const halfAlong = frame.alongMeters / 2;
  const toPlan = (u: number, v: number): Vector2 => rectangleLocalToPlan(frame, { x: u, y: v });

  switch (roof.kind) {
    case 'shed':
      return [];
    case 'gable':
      return [{ from: toPlan(-halfAlong, 0), to: toPlan(halfAlong, 0), isRidge: true }];
    case 'hip': {
      const [start, end] = hipRidgeEnds(halfAlong, halfAcross);

      return [
        { from: toPlan(start.x, start.y), to: toPlan(end.x, end.y), isRidge: true },
        // Each corner is drained by the hip running up to the nearer ridge end.
        ...CORNER_SIGNS.map(([signU, signV]) => {
          const corner = { x: signU * halfAlong, y: signV * halfAcross };
          const ridgeEnd = nearerPoint(corner, start, end);

          return {
            from: toPlan(corner.x, corner.y),
            to: toPlan(ridgeEnd.x, ridgeEnd.y),
            isRidge: false,
          };
        }),
      ];
    }
    default:
      return assertNever(roof.kind);
  }
}

function nearerPoint(point: Vector2, first: Vector2, second: Vector2): Vector2 {
  return Math.hypot(point.x - first.x, point.y - first.y) <=
    Math.hypot(point.x - second.x, point.y - second.y)
    ? first
    : second;
}

const CORNER_SIGNS: readonly (readonly [number, number])[] = [
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 1],
];

/**
 * Where the ridge of a hip roof begins and ends: it shrinks from both ends of
 * the longer axis by half the shorter one, and collapses to a point over a
 * square plan — the pyramid.
 */
function hipRidgeEnds(halfAlong: number, halfAcross: number): readonly [Vector2, Vector2] {
  return halfAlong >= halfAcross
    ? [
        { x: -(halfAlong - halfAcross), y: 0 },
        { x: halfAlong - halfAcross, y: 0 },
      ]
    : [
        { x: 0, y: -(halfAcross - halfAlong) },
        { x: 0, y: halfAcross - halfAlong },
      ];
}

/** `dot(normal, point) <= offset` — one side of a line in the roof's frame. */
interface Halfplane {
  readonly normal: Vector2;
  readonly offset: number;
}

interface FaceDefinition {
  readonly plane: RoofPlane;
  readonly halfplanes: readonly Halfplane[];
}

function facesOf(
  kind: PitchedRoofKind,
  {
    slope,
    halfAcross,
    halfAlong,
  }: { readonly slope: number; readonly halfAcross: number; readonly halfAlong: number }
): readonly FaceDefinition[] {
  switch (kind) {
    case 'shed':
      // One plane climbing across the whole span, from the low eave to the high one.
      return [{ plane: { du: 0, dv: slope, c: slope * halfAcross }, halfplanes: [] }];
    case 'gable':
      return [
        {
          plane: { du: 0, dv: -slope, c: slope * halfAcross },
          halfplanes: [{ normal: { x: 0, y: -1 }, offset: 0 }],
        },
        {
          plane: { du: 0, dv: slope, c: slope * halfAcross },
          halfplanes: [{ normal: { x: 0, y: 1 }, offset: 0 }],
        },
      ];
    case 'hip': {
      // Each slope governs the stretch of plan it is the NEAREST eave to; the
      // boundaries between them are the 45° lines the hips run along.
      const across = halfAcross - halfAlong;

      return [
        {
          plane: { du: 0, dv: -slope, c: slope * halfAcross },
          halfplanes: [
            { normal: { x: 0, y: -1 }, offset: 0 },
            { normal: { x: 1, y: -1 }, offset: -across },
            { normal: { x: -1, y: -1 }, offset: -across },
          ],
        },
        {
          plane: { du: 0, dv: slope, c: slope * halfAcross },
          halfplanes: [
            { normal: { x: 0, y: 1 }, offset: 0 },
            { normal: { x: 1, y: 1 }, offset: -across },
            { normal: { x: -1, y: 1 }, offset: -across },
          ],
        },
        {
          plane: { du: -slope, dv: 0, c: slope * halfAlong },
          halfplanes: [
            { normal: { x: -1, y: 0 }, offset: 0 },
            { normal: { x: -1, y: 1 }, offset: across },
            { normal: { x: -1, y: -1 }, offset: across },
          ],
        },
        {
          plane: { du: slope, dv: 0, c: slope * halfAlong },
          halfplanes: [
            { normal: { x: 1, y: 0 }, offset: 0 },
            { normal: { x: 1, y: 1 }, offset: across },
            { normal: { x: 1, y: -1 }, offset: across },
          ],
        },
      ];
    }
    default:
      return assertNever(kind);
  }
}

/** A far-reaching convex region, clipped down by each halfplane in turn. */
function regionRing(frame: RoofFrame, halfplanes: readonly Halfplane[]): Ring {
  let ring: readonly Vector2[] = [
    { x: -FAR_METERS, y: -FAR_METERS },
    { x: FAR_METERS, y: -FAR_METERS },
    { x: FAR_METERS, y: FAR_METERS },
    { x: -FAR_METERS, y: FAR_METERS },
  ];

  for (const halfplane of halfplanes) {
    ring = clipByHalfplane(ring, halfplane);
  }

  return ring.map(point => rectangleLocalToPlan(frame, point));
}

/** Sutherland–Hodgman against one line; the ring stays convex throughout. */
function clipByHalfplane(ring: readonly Vector2[], { normal, offset }: Halfplane): Vector2[] {
  const clipped: Vector2[] = [];
  const distanceOf = (point: Vector2): number => normal.x * point.x + normal.y * point.y - offset;

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const currentDistance = distanceOf(current);
    const nextDistance = distanceOf(next);

    if (currentDistance <= 0) {
      clipped.push(current);
    }

    if (currentDistance * nextDistance < 0) {
      const ratio = currentDistance / (currentDistance - nextDistance);

      clipped.push({
        x: current.x + (next.x - current.x) * ratio,
        y: current.y + (next.y - current.y) * ratio,
      });
    }
  }

  return clipped;
}
