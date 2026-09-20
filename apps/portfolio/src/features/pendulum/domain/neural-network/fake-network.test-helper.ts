import type { INetworkSnapshot } from './DenseNetwork';

/** A structurally valid one-layer snapshot for tests that only need some network. */
export function fakeNetworkSnapshot(): INetworkSnapshot {
  return {
    layers: [
      {
        inputSize: 1,
        outputSize: 1,
        weights: Float32Array.of(1),
        biases: Float32Array.of(0),
      },
    ],
  };
}
