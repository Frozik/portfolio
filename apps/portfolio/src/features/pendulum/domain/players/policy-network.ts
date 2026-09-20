import { createDenseNetwork } from '../neural-network/createDenseNetwork';
import type { DenseNetwork } from '../neural-network/DenseNetwork';
import { OBSERVATION_SIZE } from './observation';

const HIDDEN_UNITS = 16;
// One output: the cart acceleration command.
const OUTPUT_UNITS = 1;

/**
 * One bounded hidden layer: `tanh` units keep responding under the gaussian
 * weight noise evolution applies, where `relu` units die and stay dead, and a
 * single layer is all a swing-up-and-balance policy needs.
 */
export function createPolicyNetwork(): DenseNetwork {
  return createDenseNetwork([OBSERVATION_SIZE, HIDDEN_UNITS, OUTPUT_UNITS]);
}

/** Whether a stored network reads the current observation; older topologies cannot drive the cart. */
export function acceptsObservation(network: DenseNetwork): boolean {
  return network.inputSize === OBSERVATION_SIZE;
}
