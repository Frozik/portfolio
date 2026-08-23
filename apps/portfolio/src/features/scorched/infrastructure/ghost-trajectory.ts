import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallisticsEnvironment } from '../domain/ballistics';
import { getLaunchVelocity, simulateTrajectory } from '../domain/ballistics';
import {
  GHOST_TRAJECTORY_SAMPLE_STRIDE_TICKS,
  GHOST_TRAJECTORY_SECONDS,
  TICKS_PER_SECOND,
} from '../domain/constants';
import type { Heightfield } from '../domain/terrain/heightfield';
import type { AimState } from '../domain/types';

export interface GhostSample {
  readonly position: Vector2;
  /** 1 at the muzzle, fading to nothing at the far end of the shown arc. */
  readonly alpha: number;
}

export interface GhostTrajectoryRequest {
  readonly origin: Vector2;
  readonly aim: AimState;
  readonly environment: BallisticsEnvironment;
  readonly field: Heightfield | undefined;
}

const GHOST_MAX_TICKS = Math.round(GHOST_TRAJECTORY_SECONDS * TICKS_PER_SECOND);
const FIRST_SAMPLE_ALPHA = 1;

/**
 * [§12.2] The dotted ghost that follows a drag: the first ~1.5 s of the shot the player is
 * currently dialling, under the wind they actually have. It fades out along its length on purpose
 * — the ghost is an aid, not an oracle, and a long shot still has to be earned.
 */
export function sampleGhostTrajectory(request: GhostTrajectoryRequest): readonly GhostSample[] {
  const { path } = simulateTrajectory(
    request.origin,
    getLaunchVelocity(request.aim),
    request.environment,
    request.field,
    GHOST_MAX_TICKS
  );
  const samples: GhostSample[] = [];

  for (
    let index = GHOST_TRAJECTORY_SAMPLE_STRIDE_TICKS;
    index < path.length;
    index += GHOST_TRAJECTORY_SAMPLE_STRIDE_TICKS
  ) {
    samples.push({ position: path[index], alpha: FIRST_SAMPLE_ALPHA - index / GHOST_MAX_TICKS });
  }

  return samples.filter(sample => sample.alpha > 0);
}
