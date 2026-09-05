import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';
import { isNil } from 'lodash-es';

import type { Meters } from '../units';
import type { UtilitySystem } from './foundation';
import { defaultEntryDepth, ENTRY_SYSTEMS } from './foundation';

export type UtilityRouteId = Opaque<'UtilityRouteId', string>;

/**
 * One site trench — the outdoor half of a utility system, drawn on the plot
 * from a building's entry towards the source or the septic
 *. The polyline is what the user draws; everything
 * below grade — depth, slope, volume — DERIVES from the system's norms
 * against the terrain (`terrain/trench-profile.ts`).
 */
export interface UtilityRoute {
  readonly id: UtilityRouteId;
  readonly system: UtilitySystem;
  readonly points: readonly Vector2[];
  /** Pipe bore where the norms read it (a sewer's slope); nothing for cables. */
  readonly diameterMeters: Meters | undefined;
}

/** The systems a site trench can carry — the same set that enters a building. */
export const TRENCH_SYSTEMS: readonly UtilitySystem[] = ENTRY_SYSTEMS;

export function parseTrenchSystem(value: string): UtilitySystem | undefined {
  return TRENCH_SYSTEMS.find(system => system === value);
}

export const DEFAULT_TRENCH_SYSTEM: UtilitySystem = 'water';

/** The household standard: Ø110 to the septic, Ø50 inside branches. */
export const DEFAULT_SEWER_DIAMETER_METERS: Meters = 0.11;

/** СП 62.13330: an underground gas line keeps at least 0.8 m of cover. */
const GAS_TRENCH_DEPTH_METERS: Meters = 0.8;

/**
 * The norm-derived burial depth of a system's trench. Every entering system
 * digs to the depth its foundation entry sits at — the trench and the sleeve
 * meet — except gas, whose entry rides the facade while its site line runs
 * underground at the СП 62 cover.
 */
export function trenchDepthMeters(system: UtilitySystem, frostDepthMeters: Meters): Meters {
  return system === 'gas' ? GAS_TRENCH_DEPTH_METERS : defaultEntryDepth(system, frostDepthMeters);
}

/**
 * СП 42.13330 табл. 12.6 — horizontal separation between PARALLEL underground
 * networks, in plan. Crossings are allowed; only runs that keep close company
 * violate. The table is per network pair; the rows here are the well-known
 * household ones, kept as data so the warning pass special-cases nothing (R18).
 */
const PARALLEL_SEPARATIONS: readonly {
  readonly pair: readonly [UtilitySystem, UtilitySystem];
  readonly minMeters: Meters;
}[] = [
  { pair: ['water', 'sewer'], minMeters: 1.5 },
  { pair: ['water', 'gas'], minMeters: 1 },
  { pair: ['water', 'power'], minMeters: 0.5 },
  { pair: ['water', 'network'], minMeters: 0.5 },
  { pair: ['sewer', 'gas'], minMeters: 1 },
  { pair: ['sewer', 'power'], minMeters: 0.5 },
  { pair: ['sewer', 'network'], minMeters: 0.5 },
  { pair: ['power', 'gas'], minMeters: 1 },
  { pair: ['power', 'network'], minMeters: 0.5 },
  { pair: ['network', 'gas'], minMeters: 1 },
];

/** The required plan separation of two parallel systems; nothing when unruled. */
export function parallelSeparationMeters(
  first: UtilitySystem,
  second: UtilitySystem
): Meters | undefined {
  return PARALLEL_SEPARATIONS.find(
    ({ pair }) =>
      (pair[0] === first && pair[1] === second) || (pair[0] === second && pair[1] === first)
  )?.minMeters;
}

export interface SewerSlopeRule {
  readonly diameterMeters: Meters;
  readonly min: number;
  readonly recommended: number;
}

/**
 * СП 30.13330 slope per pipe bore, as fall per metre of run. Steeper than the
 * maximum silts the pipe — water outruns the solids — so the cap is shared.
 */
const SEWER_SLOPE_RULES: readonly SewerSlopeRule[] = [
  { diameterMeters: 0.05, min: 0.02, recommended: 0.03 },
  { diameterMeters: 0.11, min: 0.012, recommended: 0.02 },
];

/** The slope rule for a bore: the largest tabled pipe that fits inside it. */
export function sewerSlopeFor(diameterMeters: Meters): SewerSlopeRule {
  const fitting = [...SEWER_SLOPE_RULES]
    .reverse()
    .find(rule => rule.diameterMeters <= diameterMeters);

  return fitting ?? SEWER_SLOPE_RULES[0];
}

/** A polyline is a trench only once it has a segment; a lone bend is not one. */
export const MIN_ROUTE_POINTS = 2;

/** A typical hand-dug utility trench; what the earthworks volume is priced at. */
export const TRENCH_WIDTH_METERS: Meters = 0.6;

/** СП 42.13330: cover under a driveable surface never thins below this. */
export const MIN_DRIVEABLE_COVER_METERS: Meters = 0.7;

export function createUtilityRoute({
  system,
  points,
}: {
  readonly system: UtilitySystem;
  readonly points: readonly Vector2[];
}): UtilityRoute {
  return {
    id: crypto.randomUUID() as UtilityRouteId,
    system,
    points,
    diameterMeters: system === 'sewer' ? DEFAULT_SEWER_DIAMETER_METERS : undefined,
  };
}

/** The trench's plan length — what the profile and the volume run over. */
export function routeLengthMeters(points: readonly Vector2[]): Meters {
  let length = 0;

  for (let index = 0; index + 1 < points.length; index += 1) {
    length += Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].y - points[index].y
    );
  }

  return length;
}

/** The route's sewer bore, defaulted for routes whose diameter was never set. */
export function routeDiameterMeters(route: UtilityRoute): Meters {
  return isNil(route.diameterMeters) ? DEFAULT_SEWER_DIAMETER_METERS : route.diameterMeters;
}
