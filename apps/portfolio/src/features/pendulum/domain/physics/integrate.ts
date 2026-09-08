import type { IChainState } from './chain-dynamics';

/** Time derivative of the chain state at a moment `elapsed` ms into the tick. */
export type TChainDerivative = (state: IChainState, elapsed: DOMHighResTimeStamp) => IChainState;

/** Classic fourth-order Runge–Kutta step over angles and angular velocities. */
export function rungeKutta4Step(
  state: IChainState,
  elapsed: DOMHighResTimeStamp,
  step: DOMHighResTimeStamp,
  derivative: TChainDerivative
): IChainState {
  const half = step / 2;
  const slope1 = derivative(state, elapsed);
  const slope2 = derivative(shifted(state, slope1, half), elapsed + half);
  const slope3 = derivative(shifted(state, slope2, half), elapsed + half);
  const slope4 = derivative(shifted(state, slope3, step), elapsed + step);

  const weighted = (index: number, pick: (slope: IChainState) => readonly number[]): number =>
    (pick(slope1)[index] +
      2 * pick(slope2)[index] +
      2 * pick(slope3)[index] +
      pick(slope4)[index]) /
    6;

  return {
    angles: state.angles.map(
      (angle, index) => angle + step * weighted(index, slope => slope.angles)
    ),
    angularVelocities: state.angularVelocities.map(
      (velocity, index) => velocity + step * weighted(index, slope => slope.angularVelocities)
    ),
  };
}

function shifted(state: IChainState, slope: IChainState, step: DOMHighResTimeStamp): IChainState {
  return {
    angles: state.angles.map((angle, index) => angle + step * slope.angles[index]),
    angularVelocities: state.angularVelocities.map(
      (velocity, index) => velocity + step * slope.angularVelocities[index]
    ),
  };
}
