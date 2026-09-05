import type { Vector2 } from '@frozik/utils/math/vector2';

import type { StairInstance, StairKind } from '../model/stairs';
import type { Meters } from '../units';
import { DEGREES_TO_RADIANS } from '../units';
import { isPointInMultiPolygon } from './polygon-booleans';
import type { MultiPolygon, PolygonWithHoles, Ring } from './polygon-types';
import { rectangleLocalToPlan } from './polygonize-shape';
import { distanceToSegment } from './segment-distance';

/**
 * The comfort targets the run derives toward (plan §6.1 / O-A1): riser ≈ 17 cm,
 * tread from the 2h+d ≈ 63 cm stride formula. The stair stretches itself to
 * the storey height — the footprint is an OUTPUT of the model, never an input.
 */
const TARGET_RISER_METERS: Meters = 0.17;
const STRIDE_FORMULA_METERS: Meters = 0.63;

/** The advisory bands (§6.5 п.4): outside these the warning layer lights up. */
const RISER_COMFORT_RANGE_METERS = { min: 0.15, max: 0.19 } as const;
const TREAD_COMFORT_RANGE_METERS = { min: 0.25, max: 0.3 } as const;

/** No stair is a single step; two risers is the degenerate floor. */
const MIN_RISER_COUNT = 2;

/** The spiral footprint is drawn as this many segments — plan-readable, cheap. */
const SPIRAL_FOOTPRINT_SEGMENTS = 16;

/**
 * A real spiral turns about this much per step; it is a property of how people
 * climb, not a free parameter. Keeping it FIXED is what makes the going a
 * consequence of the diameter — and therefore something worth checking.
 */
export const SPIRAL_DEGREES_PER_RISER = 30;

/** The pole a spiral's treads are fixed to. */
export const SPIRAL_POLE_RADIUS_METERS: Meters = 0.08;

/**
 * The going a spiral offers underfoot: the arc one step covers on the WALKING
 * LINE — the middle of the tread, where a person's foot lands — rather than at
 * the rim, where the arc flatters the stair, or at the pole, where nothing
 * walks. A ⌀1.6 m spiral turning 30° gives about 0.23 m here: too short,
 * though its rim arc looks generous.
 */
export function spiralGoingMeters(diameterMeters: Meters): Meters {
  const walkingRadius = (SPIRAL_POLE_RADIUS_METERS + diameterMeters / 2) / 2;

  return walkingRadius * SPIRAL_DEGREES_PER_RISER * DEGREES_TO_RADIANS;
}

/**
 * The derived run of one stair: how many risers reach the storey height and
 * what each step measures. Treads count one fewer than risers — the top
 * "tread" is the upper floor itself.
 */
export interface StairRun {
  readonly riserCount: number;
  readonly riserMeters: Meters;
  readonly treadMeters: Meters;
}

export function deriveStairRun(storeyHeightMeters: Meters): StairRun {
  const riserCount = Math.max(
    MIN_RISER_COUNT,
    Math.round(storeyHeightMeters / TARGET_RISER_METERS)
  );
  const riserMeters = storeyHeightMeters / riserCount;

  return {
    riserCount,
    riserMeters,
    treadMeters: STRIDE_FORMULA_METERS - 2 * riserMeters,
  };
}

/**
 * Whether the run is comfortable underfoot — the §6.5 п.4 advisory.
 *
 * A spiral must be judged by its OWN going, measured on the walking line, and
 * by the narrow end of its winders. Reading the straight-flight `treadMeters`
 * for it — as this check first did — passed a ⌀1.6 m spiral whose real going
 * is 0.21 m: a false green exactly where the risk is highest.
 */
export function isStairRunComfortable(
  run: StairRun,
  stair?: { readonly kind: StairKind; readonly widthMeters: Meters }
): boolean {
  const isRiserComfortable =
    run.riserMeters >= RISER_COMFORT_RANGE_METERS.min &&
    run.riserMeters <= RISER_COMFORT_RANGE_METERS.max;

  if (!isRiserComfortable) {
    return false;
  }

  if (stair?.kind === 'spiral') {
    const going = spiralGoingMeters(stair.widthMeters);

    return going >= TREAD_COMFORT_RANGE_METERS.min;
  }

  return (
    run.treadMeters >= TREAD_COMFORT_RANGE_METERS.min &&
    run.treadMeters <= TREAD_COMFORT_RANGE_METERS.max
  );
}

/**
 * One straight stretch of the stair in the instance's local frame: the climb
 * runs along +y, `start` is the stretch's low end on the centreline. Landings
 * carry no risers but occupy plan area.
 */
interface StairFlight {
  readonly start: Vector2;
  /** Unit direction of climb in the local frame. */
  readonly direction: Vector2;
  readonly lengthMeters: Meters;
  readonly widthMeters: Meters;
  /** Risers climbed over this stretch; 0 for a landing. */
  readonly riserCount: number;
  /** Risers already climbed when the stretch begins. */
  readonly riserOffset: number;
}

/**
 * The stair unfolded into flights and landings, still in the local frame with
 * the bbox centred on the origin — the shared input of the plan footprint, the
 * 3D mesh and the exit-zone derivation.
 */
export interface StairLayout {
  readonly run: StairRun;
  readonly flights: readonly StairFlight[];
  /** Local axis-aligned bbox half-sizes before the instance turn. */
  readonly halfSize: Vector2;
  /** Where the climb tops out, local frame — the exit the O-A2 rule projects. */
  readonly exitPoint: Vector2;
}

function straightLayout(run: StairRun, width: Meters): StairLayout {
  const treads = run.riserCount - 1;
  const length = treads * run.treadMeters;
  const halfSize = { x: width / 2, y: length / 2 };

  return {
    run,
    flights: [
      {
        start: { x: 0, y: -halfSize.y },
        direction: { x: 0, y: 1 },
        lengthMeters: length,
        widthMeters: width,
        riserCount: run.riserCount,
        riserOffset: 0,
      },
    ],
    halfSize,
    exitPoint: { x: 0, y: halfSize.y },
  };
}

/**
 * A quarter turn: flight up along +y, a square landing, then a flight along
 * +x. Risers split evenly, the landing counts as one riser's height gained.
 */
function lShapedLayout(run: StairRun, width: Meters): StairLayout {
  const lowerRisers = Math.floor(run.riserCount / 2);
  const upperRisers = run.riserCount - lowerRisers - 1;
  // A flight ending on the landing or the upper floor puts its last foot
  // THERE, so it carries one tread fewer than the risers it climbs.
  const lowerLength = Math.max(0, lowerRisers - 1) * run.treadMeters;
  const upperLength = Math.max(0, upperRisers - 1) * run.treadMeters;
  const sizeX = width + upperLength;
  const sizeY = lowerLength + width;
  const half = { x: sizeX / 2, y: sizeY / 2 };
  const landingCentre = { x: -half.x + width / 2, y: half.y - width / 2 };

  return {
    run,
    flights: [
      {
        start: { x: landingCentre.x, y: -half.y },
        direction: { x: 0, y: 1 },
        lengthMeters: lowerLength,
        widthMeters: width,
        riserCount: lowerRisers,
        riserOffset: 0,
      },
      {
        start: landingCentre,
        direction: { x: 0, y: 1 },
        lengthMeters: 0,
        widthMeters: width,
        riserCount: 1,
        riserOffset: lowerRisers,
      },
      {
        start: { x: landingCentre.x + width / 2, y: landingCentre.y },
        direction: { x: 1, y: 0 },
        lengthMeters: upperLength,
        widthMeters: width,
        riserCount: upperRisers,
        riserOffset: lowerRisers + 1,
      },
    ],
    halfSize: half,
    exitPoint: { x: half.x, y: landingCentre.y },
  };
}

/**
 * A half turn: flight up along +y, a landing across both flights, then a
 * flight back down along −y beside the first. The landing gains one riser.
 */
function uShapedLayout(run: StairRun, width: Meters): StairLayout {
  const lowerRisers = Math.floor(run.riserCount / 2);
  const upperRisers = run.riserCount - lowerRisers - 1;
  const flightLength = Math.max(
    Math.max(0, lowerRisers - 1) * run.treadMeters,
    Math.max(0, upperRisers - 1) * run.treadMeters
  );
  const sizeX = width * 2;
  const sizeY = flightLength + width;
  const half = { x: sizeX / 2, y: sizeY / 2 };
  const lowerCentreX = -width / 2;
  const upperCentreX = width / 2;

  return {
    run,
    flights: [
      {
        start: { x: lowerCentreX, y: -half.y },
        direction: { x: 0, y: 1 },
        lengthMeters: Math.max(0, lowerRisers - 1) * run.treadMeters,
        widthMeters: width,
        riserCount: lowerRisers,
        riserOffset: 0,
      },
      {
        start: { x: 0, y: half.y - width / 2 },
        direction: { x: 0, y: 1 },
        lengthMeters: 0,
        widthMeters: width * 2,
        riserCount: 1,
        riserOffset: lowerRisers,
      },
      {
        start: { x: upperCentreX, y: half.y - width },
        direction: { x: 0, y: -1 },
        lengthMeters: Math.max(0, upperRisers - 1) * run.treadMeters,
        widthMeters: width,
        riserCount: upperRisers,
        riserOffset: lowerRisers + 1,
      },
    ],
    halfSize: half,
    exitPoint: {
      x: upperCentreX,
      y: half.y - width - Math.max(0, upperRisers - 1) * run.treadMeters,
    },
  };
}

/** The spiral: a circular footprint, the exit at the rim after the full turn. */
function spiralLayout(run: StairRun, diameter: Meters): StairLayout {
  const radius = diameter / 2;
  const exitAngle =
    ((run.riserCount * SPIRAL_DEGREES_PER_RISER) % 360) * DEGREES_TO_RADIANS + Math.PI / 2;

  return {
    run,
    flights: [
      {
        start: { x: 0, y: 0 },
        direction: { x: 0, y: 1 },
        lengthMeters: 0,
        widthMeters: diameter,
        riserCount: run.riserCount,
        riserOffset: 0,
      },
    ],
    halfSize: { x: radius, y: radius },
    exitPoint: { x: Math.cos(exitAngle) * radius, y: Math.sin(exitAngle) * radius },
  };
}

export function stairLayout(
  kind: StairKind,
  storeyHeightMeters: Meters,
  widthMeters: Meters
): StairLayout {
  const run = deriveStairRun(storeyHeightMeters);

  switch (kind) {
    case 'straight':
      return straightLayout(run, widthMeters);
    case 'l-shaped':
      return lShapedLayout(run, widthMeters);
    case 'u-shaped':
      return uShapedLayout(run, widthMeters);
    case 'spiral':
      return spiralLayout(run, widthMeters);
  }
}

function flightLocalRing(flight: StairFlight): Ring {
  const across = { x: flight.direction.y, y: -flight.direction.x };
  const halfWidth = flight.widthMeters / 2;
  const end = {
    x: flight.start.x + flight.direction.x * flight.lengthMeters,
    y: flight.start.y + flight.direction.y * flight.lengthMeters,
  };
  // A landing has zero length along the climb; give it its width as depth so
  // the ring still bounds the square it occupies.
  const depth = flight.lengthMeters === 0 ? flight.widthMeters / 2 : 0;
  const startBack = {
    x: flight.start.x - flight.direction.x * depth,
    y: flight.start.y - flight.direction.y * depth,
  };
  const endForward = {
    x: end.x + flight.direction.x * depth,
    y: end.y + flight.direction.y * depth,
  };

  return [
    { x: startBack.x - across.x * halfWidth, y: startBack.y - across.y * halfWidth },
    { x: endForward.x - across.x * halfWidth, y: endForward.y - across.y * halfWidth },
    { x: endForward.x + across.x * halfWidth, y: endForward.y + across.y * halfWidth },
    { x: startBack.x + across.x * halfWidth, y: startBack.y + across.y * halfWidth },
  ];
}

function spiralLocalRing(radius: number): Ring {
  const ring: Vector2[] = [];

  for (let index = 0; index < SPIRAL_FOOTPRINT_SEGMENTS; index += 1) {
    const angle = (index / SPIRAL_FOOTPRINT_SEGMENTS) * Math.PI * 2;

    ring.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }

  return ring;
}

/**
 * The stair's plan footprint in world metres — one polygon per flight/landing
 * (they overlap at the joints, which every consumer treats as material). The
 * ceiling cutout of the storey above IS this footprint (§6.6: the conscious
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
