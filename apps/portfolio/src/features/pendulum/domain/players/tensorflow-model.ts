import type { LayersModel } from '@tensorflow/tfjs';
import { layers, sequential, setBackend } from '@tensorflow/tfjs';

import { OBSERVATION_SIZE } from './observation';

const TF_BACKEND = 'cpu';

const HIDDEN_UNITS = 16;
// One output: the cart acceleration command.
const OUTPUT_UNITS = 1;

let backendReady: Promise<void> | undefined;

/** Awaited once before the first model is built; a synchronous constructor must not race the backend switch. */
export function ensureTensorflowBackend(): Promise<void> {
  backendReady ??= setBackend(TF_BACKEND).then(() => undefined);
  return backendReady;
}

/**
 * One bounded hidden layer: `tanh` units keep responding under the gaussian
 * weight noise evolution applies, where `relu` units die and stay dead, and a
 * single layer is all a swing-up-and-balance policy needs.
 */
export function createInitialModel(): LayersModel {
  const model = sequential();

  model.add(
    layers.dense({ inputShape: [OBSERVATION_SIZE], units: HIDDEN_UNITS, activation: 'tanh' })
  );
  model.add(layers.dense({ units: OUTPUT_UNITS, activation: 'tanh' }));

  return model;
}

/** Whether a stored model reads the current observation; older topologies cannot drive the cart. */
export function acceptsObservation(model: LayersModel): boolean {
  return model.inputs[0]?.shape.at(-1) === OBSERVATION_SIZE;
}
