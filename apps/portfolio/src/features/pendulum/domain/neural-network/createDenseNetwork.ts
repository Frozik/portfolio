import { assert } from '@frozik/utils/assert/assert';

import type { IDenseLayer } from './DenseNetwork';
import { DenseNetwork } from './DenseNetwork';
import { truncatedNormal } from './gaussian';

const GLOROT_SCALE = 1;

/** Glorot normal over the average fan, which is what tf.js gave a dense layer by default. */
function createLayer(inputSize: number, outputSize: number): IDenseLayer {
  const standardDeviation = Math.sqrt(GLOROT_SCALE / ((inputSize + outputSize) / 2));
  const weights = new Float32Array(inputSize * outputSize);

  for (let index = 0; index < weights.length; index += 1) {
    weights[index] = truncatedNormal(standardDeviation);
  }

  return { inputSize, outputSize, weights, biases: new Float32Array(outputSize) };
}

/** `layerSizes` starts with the input width and continues with one width per dense layer. */
export function createDenseNetwork(layerSizes: readonly number[]): DenseNetwork {
  assert(layerSizes.length >= 2, 'A network needs an input width and at least one layer');

  return new DenseNetwork(
    layerSizes.slice(1).map((outputSize, index) => createLayer(layerSizes[index], outputSize))
  );
}
