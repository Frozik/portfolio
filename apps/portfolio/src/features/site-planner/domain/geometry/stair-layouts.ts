import type { Vector2 } from '@frozik/utils/math/vector2';

import type { StairKind } from '../model/stairs';
import type { Meters } from '../units';
import { DEGREES_TO_RADIANS } from '../units';
import type { Ring } from './polygon-types';
import type { StairRun } from './stair-run';
import { SPIRAL_DEGREES_PER_RISER, deriveStairRun } from './stair-run';

/** The flights a stair of each kind is laid out in, and the rings those flights trace on the floor. */
/** The spiral footprint is drawn as this many segments — plan-readable, cheap. */
const SPIRAL_FOOTPRINT_SEGMENTS = 16;

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

export function flightLocalRing(flight: StairFlight): Ring {
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

export function spiralLocalRing(radius: number): Ring {
  const ring: Vector2[] = [];

  for (let index = 0; index < SPIRAL_FOOTPRINT_SEGMENTS; index += 1) {
    const angle = (index / SPIRAL_FOOTPRINT_SEGMENTS) * Math.PI * 2;

    ring.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }

  return ring;
}
