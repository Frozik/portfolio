import { ROD_LENGTH } from '../constants';
import type { IChainState } from './chain-dynamics';
import { AIR_DRAG } from './medium';

/**
 * The chain equations collapse for a single rod: the mass matrix is `[[L²]]`,
 * the Coriolis term carries `sin(0)`, and no linear system is left to solve.
 * The bob's position is never needed either — it only feeds the pointer push,
 * which this path excludes. Measured at 0.58 µs a tick against 10.87 µs for
 * the general path, which is what makes training practical;
 * `single-rod-step.test.ts` pins the two against each other.
 */
export function advanceSingleRod(
  state: IChainState,
  deltaTime: DOMHighResTimeStamp,
  substeps: number,
  pivotVelocity: number,
  deltaPivotVelocity: number,
  gravity: number
): IChainState {
  let angle = state.angles[0];
  let angularVelocity = state.angularVelocities[0];

  if (deltaPivotVelocity !== 0) {
    angularVelocity += (-deltaPivotVelocity * Math.cos(angle)) / ROD_LENGTH;
  }

  const step = deltaTime / substeps;
  const half = step / 2;

  for (let index = 0; index < substeps; index += 1) {
    const slope1 = angularAcceleration(angle, angularVelocity, pivotVelocity, gravity);
    const velocity2 = angularVelocity + half * slope1;
    const slope2 = angularAcceleration(
      angle + half * angularVelocity,
      velocity2,
      pivotVelocity,
      gravity
    );
    const velocity3 = angularVelocity + half * slope2;
    const slope3 = angularAcceleration(angle + half * velocity2, velocity3, pivotVelocity, gravity);
    const velocity4 = angularVelocity + step * slope3;
    const slope4 = angularAcceleration(angle + step * velocity3, velocity4, pivotVelocity, gravity);

    angle += (step * (angularVelocity + 2 * velocity2 + 2 * velocity3 + velocity4)) / 6;
    angularVelocity += (step * (slope1 + 2 * slope2 + 2 * slope3 + slope4)) / 6;
  }

  return { angles: [angle], angularVelocities: [angularVelocity] };
}

/** `θ̈ = (a_x·cosθ − a_y·sinθ) / L` with gravity and air drag as the only accelerations. */
function angularAcceleration(
  angle: number,
  angularVelocity: number,
  pivotVelocity: number,
  gravity: number
): number {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const tangentialSpeed = ROD_LENGTH * angularVelocity;
  const velocityX = pivotVelocity + tangentialSpeed * cos;
  const velocityY = -tangentialSpeed * sin;
  const speed = Math.hypot(velocityX, velocityY);

  const accelerationX = -AIR_DRAG * speed * velocityX;
  const accelerationY = gravity - AIR_DRAG * speed * velocityY;

  return (accelerationX * cos - accelerationY * sin) / ROD_LENGTH;
}
