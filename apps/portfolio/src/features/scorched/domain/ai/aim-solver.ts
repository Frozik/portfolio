import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';

import type { BallisticsEnvironment } from '../ballistics';
import { getLaunchOrigin, getLaunchVelocity, simulateTrajectory } from '../ballistics';
import {
  AIM_HIT_TOLERANCE_WU,
  AIM_SOLVER_PREFERRED_ELEVATION_DEGREES,
  AIM_SOLVER_REFINEMENT_PASSES,
  AIM_SOLVER_SCAN_STEP_DEGREES,
  BANK_SHOT_MIRROR_COUNT,
  MAX_ELEVATION_DEGREES,
  MIN_ELEVATION_DEGREES,
  MIN_POWER,
  POWER_TO_SPEED_WU_PER_TICK,
  TANK_CENTER_OFFSET_WU,
  TOSSER_REFINEMENT_GAIN,
} from '../constants';
import type { Heightfield } from '../terrain/heightfield';
import type { AimState } from '../types';

const DEGREES_TO_RADIANS = Math.PI / 180;
/** Elevations flatter or steeper than this are never worth solving for. */
const ELEVATION_SCAN_MIN_DEGREES = MIN_ELEVATION_DEGREES + AIM_SOLVER_SCAN_STEP_DEGREES;
const ELEVATION_SCAN_MAX_DEGREES = MAX_ELEVATION_DEGREES - AIM_SOLVER_SCAN_STEP_DEGREES;

/**
 * Closed-form no-drag solution for a chosen elevation:
 * `v² = g·dx² / (2·cos²θ·(dx·tanθ − dy))`. Undefined when the elevation cannot reach the
 * target at any speed, which is the flat-shot-at-a-hilltop case.
 */
export function solveSpeedForElevation(
  delta: Vector2,
  elevationDegrees: number,
  gravityWuPerTickSquared: number
): number | undefined {
  const horizontalDistance = Math.abs(delta.x);
  const radians = elevationDegrees * DEGREES_TO_RADIANS;
  const cosine = Math.cos(radians);

  if (horizontalDistance === 0 || cosine === 0 || gravityWuPerTickSquared <= 0) {
    return undefined;
  }

  const denominator = 2 * cosine * cosine * (horizontalDistance * Math.tan(radians) - delta.y);

  if (denominator <= 0) {
    return undefined;
  }

  return Math.sqrt(
    (gravityWuPerTickSquared * horizontalDistance * horizontalDistance) / denominator
  );
}

function toPower(speedWuPerTick: number): number {
  return speedWuPerTick / POWER_TO_SPEED_WU_PER_TICK;
}

/**
 * Scans the elevations for the cheapest shot that reaches the target: a lower muzzle speed
 * leaves more headroom under the health-capped power ceiling and lands sooner.
 */
export function solveNoDragAim(
  origin: Vector2,
  target: Vector2,
  gravityWuPerTickSquared: number,
  maxPower: number
): AimState | undefined {
  const facing = target.x - origin.x < 0 ? 'left' : 'right';
  const elevations = [AIM_SOLVER_PREFERRED_ELEVATION_DEGREES];

  for (
    let elevation = ELEVATION_SCAN_MIN_DEGREES;
    elevation <= ELEVATION_SCAN_MAX_DEGREES;
    elevation += AIM_SOLVER_SCAN_STEP_DEGREES
  ) {
    elevations.push(elevation);
  }

  let best: AimState | undefined;

  for (const elevationDegrees of elevations) {
    // The shell leaves the muzzle, whose position depends on the elevation being considered.
    const muzzle = getLaunchOrigin(origin.x, origin.y - TANK_CENTER_OFFSET_WU, {
      facing,
      elevationDegrees,
    });
    const delta: Vector2 = { x: target.x - muzzle.x, y: target.y - muzzle.y };
    const speed = solveSpeedForElevation(delta, elevationDegrees, gravityWuPerTickSquared);

    if (speed === undefined) {
      continue;
    }

    const power = toPower(speed);

    if (power > maxPower || (best !== undefined && power >= best.power)) {
      continue;
    }

    best = { facing, elevationDegrees, power };
  }

  return best;
}

export interface ShotMeasurement {
  /** Signed horizontal miss; negative means the shell came down short of the target. */
  readonly errorWu: number;
  /** False when the shell was swallowed by a wall or flew off the field without landing. */
  readonly didLand: boolean;
}

/**
 * How a simulated shot did. A shot that never lands still reports its closest approach, which
 * is what keeps the wind refinement converging instead of stalling on an unusable reading.
 * `origin` is the tank centre; the simulation launches from the muzzle exactly as the round does.
 */
export function measureShot(
  origin: Vector2,
  aim: AimState,
  environment: BallisticsEnvironment,
  field: Heightfield | undefined,
  target: Vector2
): ShotMeasurement {
  const launch = getLaunchOrigin(origin.x, origin.y - TANK_CENTER_OFFSET_WU, aim);
  const result = simulateTrajectory(launch, getLaunchVelocity(aim), environment, field);
  const closest = result.path.reduce((nearest, point) =>
    Math.hypot(point.x - target.x, point.y - target.y) <
    Math.hypot(nearest.x - target.x, nearest.y - target.y)
      ? point
      : nearest
  );

  return {
    errorWu: (result.impact ?? closest).x - target.x,
    didLand: result.impact !== undefined,
  };
}

export function isOnTarget(measurement: ShotMeasurement): boolean {
  return measurement.didLand && Math.abs(measurement.errorWu) <= AIM_HIT_TOLERANCE_WU;
}

/**
 * Wind-corrected refinement: the closed-form solution ignores the wind, so the solver aims at
 * a virtual target displaced against the observed miss and re-solves until the drift is gone.
 */
export function refineAimForWind(
  origin: Vector2,
  target: Vector2,
  environment: BallisticsEnvironment,
  field: Heightfield | undefined,
  maxPower: number
): AimState | undefined {
  let aim = solveNoDragAim(origin, target, environment.gravityWuPerTickSquared, maxPower);
  let virtualTarget = target;

  if (aim === undefined) {
    return undefined;
  }

  for (let pass = 0; pass < AIM_SOLVER_REFINEMENT_PASSES; pass++) {
    const measurement = measureShot(origin, aim, environment, field, target);

    if (isOnTarget(measurement)) {
      return aim;
    }

    virtualTarget = { x: virtualTarget.x - measurement.errorWu, y: virtualTarget.y };

    const refined = solveNoDragAim(
      origin,
      virtualTarget,
      environment.gravityWuPerTickSquared,
      maxPower
    );

    if (refined === undefined) {
      return aim;
    }

    aim = refined;
  }

  return aim;
}

function mirrorTargets(target: Vector2, environment: BallisticsEnvironment): readonly Vector2[] {
  const mirrors: Vector2[] = [];

  const width = environment.fieldWidthWu;

  for (let bounce = 1; bounce <= BANK_SHOT_MIRROR_COUNT; bounce++) {
    mirrors.push({ x: 2 * bounce * width - target.x, y: target.y });
    mirrors.push({ x: -2 * (bounce - 1) * width - target.x, y: target.y });
  }

  mirrors.push({ x: target.x, y: 2 * environment.fieldHeightWu - target.y });

  return mirrors;
}

/**
 * Poolshark's bank shot: aim at the target's mirror image behind the wall, then check by
 * simulation that the real shot really does come back and land on the target.
 */
export function findBankShotAim(
  origin: Vector2,
  target: Vector2,
  environment: BallisticsEnvironment,
  field: Heightfield | undefined,
  maxPower: number
): AimState | undefined {
  for (const mirror of mirrorTargets(target, environment)) {
    const aim = solveNoDragAim(origin, mirror, environment.gravityWuPerTickSquared, maxPower);

    if (aim === undefined) {
      continue;
    }

    if (isOnTarget(measureShot(origin, aim, environment, field, target))) {
      return aim;
    }
  }

  return undefined;
}

/**
 * Tosser's walk: nudge the power a fixed fraction of the way towards closing the last miss,
 * so repeated shots converge on the target without ever solving the trajectory.
 */
export function refineFromMiss(
  previousAim: AimState,
  origin: Vector2,
  impact: Vector2,
  target: Vector2,
  maxPower: number
): AimState {
  const targetDistance = Math.abs(target.x - origin.x);
  const impactDistance = Math.abs(impact.x - origin.x);

  if (targetDistance === 0) {
    return previousAim;
  }

  const correction = (targetDistance - impactDistance) / targetDistance;
  const power = clamp(
    previousAim.power * (1 + TOSSER_REFINEMENT_GAIN * correction),
    MIN_POWER,
    maxPower
  );

  return { ...previousAim, facing: target.x < origin.x ? 'left' : 'right', power };
}

/** Whether nothing but air sits between the muzzle and the target. */
export function hasClearLineOfFire(
  origin: Vector2,
  target: Vector2,
  isSolidAtPoint: (position: Vector2) => boolean
): boolean {
  const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
  const stepCount = Math.max(1, Math.ceil(distance));

  for (let step = 1; step < stepCount; step++) {
    const progress = step / stepCount;
    const probe: Vector2 = {
      x: origin.x + (target.x - origin.x) * progress,
      y: origin.y + (target.y - origin.y) * progress,
    };

    if (isSolidAtPoint(probe)) {
      return false;
    }
  }

  return true;
}
