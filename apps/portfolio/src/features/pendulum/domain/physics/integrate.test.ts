import type { IChainState } from './chain-dynamics';
import { rungeKutta4Step } from './integrate';

describe('rungeKutta4Step', () => {
  it('follows a harmonic oscillator to fourth-order accuracy', () => {
    const frequency = 0.01;
    const step = 5;
    const derivative = ({ angles, angularVelocities }: IChainState): IChainState => ({
      angles: angularVelocities,
      angularVelocities: angles.map(angle => -frequency * frequency * angle),
    });
    let state: IChainState = { angles: [1], angularVelocities: [0] };

    for (let elapsed = 0; elapsed < 1000; elapsed += step) {
      state = rungeKutta4Step(state, elapsed, step, derivative);
    }

    expect(state.angles[0]).toBeCloseTo(Math.cos(frequency * 1000), 6);
    expect(state.angularVelocities[0]).toBeCloseTo(-frequency * Math.sin(frequency * 1000), 6);
  });

  it('hands the derivative the time inside the tick', () => {
    const times: number[] = [];
    const derivative = (state: IChainState, elapsed: number): IChainState => {
      times.push(elapsed);
      return { angles: state.angularVelocities, angularVelocities: [0] };
    };

    rungeKutta4Step({ angles: [0], angularVelocities: [0] }, 100, 4, derivative);

    expect(times).toEqual([100, 102, 102, 104]);
  });
});
