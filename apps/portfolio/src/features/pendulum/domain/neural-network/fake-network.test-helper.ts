import { OBSERVATION_SIZE } from '../players/observation';
import type { INetworkSnapshot } from './DenseNetwork';

/** A structurally valid one-layer snapshot that reads the current observation, for tests that only need some network. */
export function fakeNetworkSnapshot(): INetworkSnapshot {
  return {
    layers: [
      {
        inputSize: OBSERVATION_SIZE,
        outputSize: 1,
        weights: new Float32Array(OBSERVATION_SIZE).fill(1),
        biases: Float32Array.of(0),
      },
    ],
  };
}
