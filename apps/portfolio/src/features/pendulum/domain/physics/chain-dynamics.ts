import { ROD_LENGTH } from '../constants';
import type { IPoint } from '../types';
import { solveSymmetricPositiveDefinite } from './linear-solve';

export interface IChainState {
  readonly angles: readonly number[];
  readonly angularVelocities: readonly number[];
}

/**
 * Lagrangian dynamics of a chain of equal point masses on equal massless rods
 * in the pivot's frame: `M(θ)·θ̈ = Q(θ, a) − C(θ)·θ̇²`. External influences
 * enter as an acceleration per bob (gravity, pushes, drag), so the common
 * mass cancels and never appears. `μ_ij`, the number of bobs hanging from the
 * lower of joints i and j, weights every pairwise term.
 */
export function angularAccelerations(
  { angles, angularVelocities }: IChainState,
  bobAccelerations: readonly IPoint[]
): readonly number[] {
  const count = angles.length;
  const rightHandSide = generalizedForces(angles, bobAccelerations);

  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      rightHandSide[row] -=
        hangingBobs(count, row, column) *
        ROD_LENGTH *
        ROD_LENGTH *
        Math.sin(angles[row] - angles[column]) *
        angularVelocities[column] *
        angularVelocities[column];
    }
  }

  return solveSymmetricPositiveDefinite(massMatrix(angles), rightHandSide);
}

/**
 * Rigid rods pass a sudden pivot velocity change on as an impulse: the
 * tangential bob velocities stay continuous, the radial parts jump with the
 * pivot. Solving `M·Δθ̇ = Q_impulse` gives the chain's new angular velocities.
 */
export function angularVelocitiesAfterPivotKick(
  { angles, angularVelocities }: IChainState,
  deltaPivotVelocity: number
): readonly number[] {
  if (deltaPivotVelocity === 0) {
    return angularVelocities;
  }

  const impulse = generalizedForces(
    angles,
    angles.map(() => ({ x: -deltaPivotVelocity, y: 0 }))
  );
  const deltas = solveSymmetricPositiveDefinite(massMatrix(angles), impulse);

  return angularVelocities.map((velocity, index) => velocity + deltas[index]);
}

function massMatrix(angles: readonly number[]): number[][] {
  const count = angles.length;

  return angles.map((rowAngle, row) =>
    angles.map(
      (columnAngle, column) =>
        hangingBobs(count, row, column) * ROD_LENGTH * ROD_LENGTH * Math.cos(rowAngle - columnAngle)
    )
  );
}

/** Torque on every joint from Cartesian accelerations of the bobs below it. */
function generalizedForces(
  angles: readonly number[],
  bobAccelerations: readonly IPoint[]
): number[] {
  return angles.map((angle, joint) => {
    let torque = 0;
    for (let bob = joint; bob < bobAccelerations.length; bob++) {
      const { x, y } = bobAccelerations[bob];
      torque += x * Math.cos(angle) - y * Math.sin(angle);
    }
    return torque * ROD_LENGTH;
  });
}

function hangingBobs(count: number, row: number, column: number): number {
  return count - Math.max(row, column);
}
