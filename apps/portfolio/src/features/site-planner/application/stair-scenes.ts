import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { isPointInMultiPolygon } from '../domain/geometry/polygon-booleans';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import {
  stairCutout,
  stairExitPoint,
  stairFootprint,
  stairRotationGrip,
} from '../domain/geometry/stair-footprint';
import type { StairStep } from '../domain/geometry/stair-mesh';
import { stairStepPolygons } from '../domain/geometry/stair-mesh';
import type { StairRun } from '../domain/geometry/stair-run';
import { deriveStairRun, isStairRunComfortable } from '../domain/geometry/stair-run';
import { floorToFloorMeters } from '../domain/geometry/storey-plates';
import type { StairInstance } from '../domain/model/stairs';
import type { Storey } from '../domain/model/storeys';
import { stairsOf } from '../domain/model/storeys';
import type { Meters } from '../domain/units';

/** The stairs of a storey resolved against its floor: runs, steps, stairwells and the porch case. */
/**
 * The shortest climb an external stair is modelled with. A porch onto a floor
 * barely above grade is still a step, and a zero rise would divide by nothing.
 */
const MIN_EXTERNAL_STAIR_RISE_METERS: Meters = 0.15;

/**
 * How far past its exit a stair's turn grip stands. In metres rather than in
 * pixels because the grip belongs to the scene: the plan draws it and the
 * pointer tests against it, and those two must not drift apart.
 */
const STAIR_ROTATION_GRIP_METERS: Meters = 0.8;

/** One stair resolved for drawing: its run, its steps and where it tops out. */
export interface StairScene {
  readonly stair: StairInstance;
  readonly run: StairRun;
  readonly steps: readonly StairStep[];
  readonly footprint: MultiPolygon;
  readonly exitPoint: Vector2;
  /** Whether the derived run is comfortable underfoot — the comfort advisory. */
  readonly isComfortable: boolean;
  /** Where the turn grip sits: drawn on the plan and hit-tested by the same value. */
  readonly rotationGrip: Vector2;
  /** What it opens in the ceiling above it — the derived stairwell. */
  readonly cutout: MultiPolygon;
  /** A porch: it stands outside the storey and climbs from the ground. */
  readonly isExternal: boolean;
  /** What the steps stand on: the storey floor, or the ground for a porch. */
  readonly baseElevation: Meters | undefined;
}

/**
 * The stairs of one storey resolved for drawing and climbing. A stair standing
 * OUTSIDE its storey's footprint is an external one — the porch every house
 * with a цоколь needs — and climbs from the ground under it to the floor it serves.
 */
export function deriveStairScenes(
  storey: Storey,
  footprint: MultiPolygon,
  ownFloor: Meters | undefined,
  groundElevationAtPoint: (point: Vector2) => Meters
): readonly StairScene[] {
  return stairsOf(storey).map(stair => {
    // A stair standing OUTSIDE its storey's footprint is an external one —
    // the porch every house with a цоколь needs, and the reason a front door
    // otherwise opens onto a drop. Its climb is the real one: from the
    // ground under it up to the floor it serves.
    const isExternal = !isPointInMultiPolygon(footprint, stair.position);
    const climb =
      isExternal && !isNil(ownFloor)
        ? Math.max(
            MIN_EXTERNAL_STAIR_RISE_METERS,
            ownFloor - groundElevationAtPoint(stair.position)
          )
        : floorToFloorMeters(storey.heightMeters);
    const steps = stairStepPolygons(stair, climb);

    return {
      stair,
      run: deriveStairRun(climb),
      steps,
      footprint: stairFootprint(stair, climb),
      exitPoint: stairExitPoint(stair, climb),
      rotationGrip: stairRotationGrip(
        stair,
        stairExitPoint(stair, climb),
        STAIR_ROTATION_GRIP_METERS
      ),
      isComfortable: isStairRunComfortable(deriveStairRun(climb), stair),
      // An external stair pierces nothing: it climbs to the floor, not
      // through it.
      cutout: isExternal ? [] : stairCutout(stair, climb, { steps }),
      isExternal,
      baseElevation: isExternal && !isNil(ownFloor) ? ownFloor - climb : ownFloor,
    };
  });
}
