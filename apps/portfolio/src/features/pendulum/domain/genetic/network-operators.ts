import type { IDenseLayer } from '../neural-network/DenseNetwork';
import { DenseNetwork } from '../neural-network/DenseNetwork';
import { standardNormal } from '../neural-network/gaussian';

/**
 * Signals that two parents cannot be crossed over because their networks do not
 * line up. Breeding treats it as an expected outcome (fall back to a mutation);
 * every other failure stays fatal.
 */
export class IncompatibleNetworkTopologyError extends Error {}

function withNoise(values: Float32Array, mutationRate: number): Float32Array {
  const mutated = new Float32Array(values.length);

  for (let index = 0; index < values.length; index += 1) {
    mutated[index] = values[index] + standardNormal() * mutationRate;
  }

  return mutated;
}

export function mutateNetwork(parent: DenseNetwork, mutationRate: number): DenseNetwork {
  return new DenseNetwork(
    parent.layers.map(layer => ({
      ...layer,
      weights: withNoise(layer.weights, mutationRate),
      biases: withNoise(layer.biases, mutationRate),
    }))
  );
}

/** Father up to the cut, mother from it on. */
function spliceAt(father: Float32Array, mother: Float32Array, cut: number): Float32Array {
  const child = new Float32Array(father.length);

  child.set(father.subarray(0, cut));
  child.set(mother.subarray(cut), cut);

  return child;
}

function crossoverLayers(father: IDenseLayer, mother: IDenseLayer): IDenseLayer {
  const { inputSize, outputSize } = father;

  if (inputSize !== mother.inputSize || outputSize !== mother.outputSize) {
    throw new IncompatibleNetworkTopologyError('Parent layers have different shapes');
  }

  return {
    inputSize,
    outputSize,
    // Whole input rows are inherited together, so a unit keeps receiving a
    // coherent set of edges rather than a per-weight blend of two policies.
    weights: spliceAt(
      father.weights,
      mother.weights,
      Math.trunc(Math.random() * inputSize) * outputSize
    ),
    biases: spliceAt(father.biases, mother.biases, Math.trunc(Math.random() * outputSize)),
  };
}

export function crossoverNetworks(father: DenseNetwork, mother: DenseNetwork): DenseNetwork {
  if (father.layers.length !== mother.layers.length) {
    throw new IncompatibleNetworkTopologyError('Parents have a different number of layers');
  }

  return new DenseNetwork(
    father.layers.map((layer, index) => crossoverLayers(layer, mother.layers[index]))
  );
}
